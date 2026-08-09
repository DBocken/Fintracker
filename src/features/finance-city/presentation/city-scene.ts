/**
 * Imperativer three.js-Szenengraph der Finanzstadt (WP-C3). Reine
 * Fabrikfunktion + Handle-Objekt, KEIN React — der Lifecycle wird komplett
 * von `CityCanvas.tsx` (ein einziger `useEffect`) verwaltet, nicht vom
 * React-Renderzyklus (README-Architekturtabelle, `presentation/`-Zeile).
 *
 * Liest AUSSCHLIESSLICH `LayoutBox[]` aus `domain/city-layout.ts#buildCityLayout`
 * — hier wird KEINE Geometrie-Entscheidung neu getroffen, nur auf three.js-
 * Primitive abgebildet (Position/Skalierung/Farbe/Opazität/Pickability kommen
 * 1:1 aus der Box).
 *
 * **Aufbau in benannten Teilschritten (WP 6.4, ARCH-5/KOMP-1).** Bis WP 6.4
 * war `createCityScene` eine einzige 933-Zeilen-Fabrik: jede Verantwortung —
 * Texturen, Szenengraph, Material-Registry, Tweens, Layout-Diff, Flusslinien,
 * Highlight, Raycast, Theme/Fog, Atmosphäre — lag in demselben Closure und
 * konnte auf jeden Zustand darin greifen. Sie ist jetzt eine Komposition; jede
 * Zeile unten benennt genau einen Teilschritt, und jeder davon räumt selbst
 * auf:
 *
 * | Teilschritt | Modul |
 * |---|---|
 * | Theme-Ton (Palette, Horizont) | `city-scene-theme.ts` |
 * | Aufbau: prozedurale Texturen | `city-scene-textures.ts` |
 * | Aufbau: Szenengraph, Licht, Renderer | `city-scene-stage.ts` |
 * | Aufbau: Material-Registry | `city-scene-materials.ts` |
 * | Animation: Höhen-/Opazitäts-Tweens | `city-scene-tweens.ts` |
 * | Layout: Box-Diff, Kontaktschatten, Kanten | `city-scene-boxes.ts` |
 * | Interaktion: Raycast, Hover-Highlight | `city-scene-interaction.ts` |
 * | Flusslinien | `city-scene-flow-lines.ts` |
 * | Atmosphäre (Lichtmodulation) | `city-scene-atmosphere.ts` |
 * | Rendering: Größe, Fog, Theme-Wechsel, Kamerapose | `city-scene-view.ts` |
 *
 * Zwei Invarianten gelten über alle Teilschritte hinweg:
 *
 * 1. **Single-rAF.** Kein Modul startet einen eigenen `requestAnimationFrame`
 *    oder `setInterval`; die Zeit kommt ausschließlich als Parameter von
 *    `advanceAnimations(nowMs)`, getickt vom Render-Loop in `CityCanvas.tsx`.
 * 2. **Geteilte Materialien werden nie mutiert.** Wer eine Box vorübergehend
 *    anders aussehen lässt (Tween, Highlight), arbeitet auf einem Klon —
 *    sonst faden bzw. glühen alle Boxen mit demselben Materialschlüssel mit.
 */

import type * as THREE from 'three';
import type { CityLayout } from '../domain/city-layout';
import type { Vec3 } from '../domain/city-model';
import { deriveCityQuality, type CityQualitySettings } from '../domain/city-quality';
import type { CityFlowLine } from '../domain/city-flow-lines';
import { createCityThemeState, type CityTheme } from './city-scene-theme';
import { createCityTextures } from './city-scene-textures';
import { createCitySceneStage } from './city-scene-stage';
import { createCityMaterials } from './city-scene-materials';
import { createCityTweens } from './city-scene-tweens';
import { createCityBoxes } from './city-scene-boxes';
import { createCityInteraction } from './city-scene-interaction';
import { createCityFlowLines } from './city-scene-flow-lines';
import { createCityAtmosphere, type CityAtmospherePreset } from './city-scene-atmosphere';
import { createCitySceneView } from './city-scene-view';

export { THEME_PALETTES } from './city-scene-theme';
export { CAMERA_FOV_Y_DEG } from './city-scene-stage';
export type { CityCameraPose } from './city-scene-view';

export type CitySceneHandle = {
  /**
   * Diff-arm: Meshes nach `box.id` wiederverwenden (Position/Scale/Material-
   * Update), neue anlegen, fehlende entsorgen. WP-C6: wenn Animationen aktiv
   * sind (`setAnimationsEnabled(true)`), wird die Ziel-Transform/-Opazität
   * NICHT sofort gesetzt, sondern ein Tween gestartet (IST → hier übergebenes
   * ZIEL) — `advanceAnimations` schreibt ihn fort. Bei deaktivierten
   * Animationen unverändert das bisherige Sofort-Verhalten.
   */
  applyLayout(layout: CityLayout): void;
  /**
   * WP-C6: vom BESTEHENDEN Render-Loop (`CityCanvas.tsx#tick`) pro Frame mit
   * injizierter Zeit aufgerufen (kein `Date.now()` hier) — KEIN zweiter
   * `requestAnimationFrame`/`setInterval` (Single-rAF-Invariante). Liefert
   * `true`, solange mindestens ein Tween noch läuft (Aufrufer hält den Loop
   * wach), sonst `false`. Der erste Aufruf NACH dem Start eines Tweens
   * definiert dessen `t=0` (Tween-lokal, nicht global); bei Höhen-Tweens kommt
   * der Kaskaden-Startversatz auf diesen ersten Tick obendrauf.
   */
  advanceAnimations(nowMs: number): boolean;
  /**
   * WP-C6: `false` (Default) = Sofort-Endzustand bei `applyLayout` (kein
   * Tween, `prefers-reduced-motion`). `true` = künftige `applyLayout`-Aufrufe
   * starten Tweens. Beim Umschalten auf `false` springen alle GERADE laufenden
   * Tweens sofort auf ihren Zielwert und die Klon-Materialien werden entsorgt.
   */
  setAnimationsEnabled(enabled: boolean): void;
  /** Raycast auf pickable Boxen → `box.id`, oder `null` bei Boden/Leere. */
  pick(clientX: number, clientY: number): string | null;
  /**
   * WP-5.1: Flusslinien für wiederkehrende Zahlungen (`domain/city-flow-lines.ts`).
   * Leere Liste räumt sie ab. Auf Stufen ohne `quality.flowLines` ein No-op —
   * die Aufrufer brauchen dafür keine Fallunterscheidung.
   */
  applyFlowLines(lines: CityFlowLine[]): void;
  /**
   * WP-D3 (Hover-Kopplung Label↔Box): hebt GENAU EINE Box visuell hervor
   * (`null` = keine). Aufrufer muss danach einen Frame anfordern
   * (`invalidate`) — diese Methode rendert nicht selbst.
   */
  setHighlight(id: string | null): void;
  setSize(width: number, height: number, dpr: number): void;
  /** No-op-fähig: near/far nicht endlich → Fog aus. */
  setFog(near: number, far: number): void;
  /** WP-C9: Light/Dark umschalten (Hintergrund, Beleuchtung, Fog-Farbe). Initial aus der `dark`-Klasse am `<html>` abgeleitet. */
  setTheme(theme: CityTheme): void;
  /** WP-4.3: Atmosphäre-Preset — subtile Lichtmodulation basierend auf Finanzzustand. */
  setAtmospherePreset(preset: CityAtmospherePreset): void;
  render(): void;
  /** Räumt ALLES auf: geteilte Geometrien, Material-/Edge-Material-Registry, Texturen, Renderer. */
  dispose(): void;
  /**
   * WP-C4-Andockpunkt: setzt Kamera-Position + Orbit-Target direkt (kein
   * Easing/Flug — das übernimmt der Kamera-Controller). C4 ruft dieselbe
   * Methode pro Animationsframe mit interpolierten Werten auf.
   */
  applyCameraPose(pose: { position: Vec3; target: Vec3 }): void;
  /**
   * Live-Referenz auf das aktuelle Orbit-Target (von `applyCameraPose`
   * mutiert, NICHT neu zugewiesen). `CityCanvas` bindet `OrbitControls.target`
   * an dieselbe Instanz, damit Controls und Szene nie auseinanderlaufen.
   */
  readonly target: THREE.Vector3;
  readonly camera: THREE.PerspectiveCamera;
  readonly domElement: HTMLCanvasElement;
};

export type CreateCitySceneOptions = {
  canvas: HTMLCanvasElement;
  /** Tests injizieren einen Fake-Renderer, damit der Szenengraph ohne echten WebGL-Kontext (jsdom) testbar bleibt. */
  createRenderer?: (canvas: HTMLCanvasElement) => THREE.WebGLRenderer;
  /**
   * WP-5.6: Qualitätsstufe. Fehlt sie, läuft die Szene unverändert auf der
   * höchsten Stufe. `CityCanvas` leitet sie aus dem Gerät ab
   * (`domain/city-quality.ts`) und stuft bei anhaltend niedriger Bildrate
   * herunter. Die Stufe wird EINMAL bei der Erstellung ausgewertet: ein
   * Wechsel zur Laufzeit hieße Materialien/Texturen austauschen, während
   * Tweens laufen — `CityCanvas` baut die Szene beim Herunterstufen deshalb
   * neu auf, statt sie zu mutieren.
   */
  quality?: CityQualitySettings;
};

export function createCityScene(opts: CreateCitySceneOptions): CitySceneHandle {
  // Ohne Angabe die höchste Stufe — der Zustand vor WP-5.6.
  const quality = opts.quality ?? deriveCityQuality({ devicePixelRatio: 2, viewportWidth: 1920 }, 'high');

  const theme = createCityThemeState();
  const textures = createCityTextures(quality);
  const stage = createCitySceneStage({
    canvas: opts.canvas,
    createRenderer: opts.createRenderer,
    quality,
    theme,
    textures,
  });
  const materials = createCityMaterials({ textures, getTheme: () => theme.theme });
  const tweens = createCityTweens({ quality, getMesh: (id) => boxes.meshes.get(id) });
  const boxes = createCityBoxes({
    stage,
    materials,
    textures,
    tweens,
    quality,
    onBoxRemoved: (id) => interaction.forget(id),
  });
  const interaction = createCityInteraction({ stage, meshes: boxes.meshes });
  const flowLines = createCityFlowLines({ scene: stage.scene, quality });
  const atmosphere = createCityAtmosphere({
    hemisphereLight: stage.hemisphereLight,
    directionalLight: stage.directionalLight,
    theme,
  });
  const view = createCitySceneView({ stage, theme, textures, materials, quality });

  return {
    applyLayout: boxes.applyLayout,
    applyFlowLines: flowLines.apply,
    // Beide Anteile laufen IMMER — kein Kurzschluss über `||`, sonst bliebe
    // der Licht-Tween bei laufenden Box-Tweens stehen.
    advanceAnimations: (nowMs) => {
      const boxesRunning = tweens.advance(nowMs);
      const lightRunning = atmosphere.advance(nowMs);
      return boxesRunning || lightRunning;
    },
    setAnimationsEnabled: tweens.setEnabled,
    pick: interaction.pick,
    setHighlight: interaction.setHighlight,
    setSize: view.setSize,
    setFog: view.setFog,
    setTheme: view.setTheme,
    // Bei deaktivierten Animationen sofort anwenden (reduced-motion).
    setAtmospherePreset: (preset) => atmosphere.setPreset(preset, tweens.enabled),
    render: view.render,
    applyCameraPose: view.applyCameraPose,
    dispose() {
      interaction.dispose();
      boxes.dispose();
      flowLines.dispose();
      tweens.dispose();
      textures.dispose();
      materials.dispose();
      stage.dispose();
    },
    target: stage.target,
    camera: stage.camera,
    domElement: stage.canvas,
  };
}
