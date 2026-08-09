/**
 * Aufbau-Animationen der Stadt (WP-C6/WP-E1, herausgelöst aus `city-scene.ts`
 * in WP 6.4 — Teilschritt „Interaktion/Animation").
 *
 * Zwei Tween-Arten, je eine eigene Fabrik, zusammengefasst von
 * `createCityTweens`. Beide werden vom BESTEHENDEN Render-Loop getickt
 * (`CityCanvas.tsx#tick`, Single-rAF-Invariante — hier kein eigener Timer und
 * kein `Date.now()`, die Zeit kommt ausschließlich als Parameter):
 *
 * - **Höhen-Wachstum** (`bar`/`floor`/`cap`, fußpunkt-verankert über
 *   `scale.y`/`position.y`), gestaffelt als Aufbau-Kaskade.
 * - **Opazitäts-Fade** (alle Kinds), IMMER über eine PRO-MESH-Klon-Instanz:
 *   die geteilte Registry-Instanz darf während eines Tweens nie mutiert
 *   werden, sonst faden alle Boxen mit demselben Materialschlüssel mit.
 *
 * Default `enabled: false` — dasselbe Sofort-Verhalten wie vor WP-C6, bis
 * `CityCanvas` `setAnimationsEnabled(!reducedMotion)` aufruft.
 */

import * as THREE from 'three';
import type { LayoutBox, LayoutBoxKind } from '../domain/city-layout';
import { easeInOutCubic } from '../domain/camera-math';
import type { CityQualitySettings } from '../domain/city-quality';
import { MOTION_DURATIONS } from '@/lib/motion-tokens';

/** Balken-/Etagen-/Cap-Wachstum. */
const BAR_GROWTH_DURATION_MS = MOTION_DURATIONS.slow;
/** Opazitäts-Fade (Hüllen-Ebenenwechsel, Balken-Opazitätsstufen etc.). */
const OPACITY_FADE_DURATION_MS = MOTION_DURATIONS.default;

type GetMesh = (id: string) => THREE.Mesh | undefined;

/** Fortschritt eines Tweens auf 0..1, robust gegen `durationMs <= 0`. */
function progress(elapsedMs: number, durationMs: number): number {
  return durationMs <= 0 ? 1 : Math.min(1, Math.max(0, elapsedMs / durationMs));
}

function isHeightAnimatableKind(kind: LayoutBoxKind): boolean {
  // WP-E1: Caps wachsen wie ihre Balken (Fuß = Balken-Oberkante).
  return kind === 'bar' || kind === 'floor' || kind === 'cap';
}

/** `mesh.material` ist als `Material | Material[]` typisiert; hier werden nie Arrays zugewiesen. */
function materialOpacityOf(material: THREE.Material | THREE.Material[]): number {
  return Array.isArray(material) ? (material[0]?.opacity ?? 1) : material.opacity;
}

type HeightTween = {
  /** `null` = noch nicht getickt — der ERSTE `advance`-Aufruf danach definiert `t=0`, zzgl. `staggerIndex × buildStaggerMs`. */
  startMs: number | null;
  durationMs: number;
  fromHeight: number;
  toHeight: number;
  /** Fixer Ziel-Fußpunkt (`box.center.y - box.size.y / 2`). NICHT selbst interpoliert (bewusster Scope-Cut). */
  foot: number;
  /** Position im `applyLayout`-Batch — Startversatz der Kaskade. */
  staggerIndex: number;
};

function createHeightTweens(deps: { quality: CityQualitySettings; getMesh: GetMesh }) {
  const tweens = new Map<string, HeightTween>();
  // WP-E1: Staffel-Schritt der Aufbau-Kaskade. WP-5.6: Auf der sparsamsten
  // Stufe 0 — die Kaskade selbst ist billig, aber sie verlängert die
  // Zeitspanne, in der GERENDERT wird; auf einem Gerät am Limit ist das genau
  // die Zeit, in der es sichtbar ruckelt.
  const buildStaggerMs = deps.quality.buildCascade ? 50 : 0;

  return {
    /** Liefert `true`, wenn dabei ein Tween gestartet wurde (Kaskaden-Zähler). */
    apply(mesh: THREE.Mesh, box: LayoutBox, isNewMesh: boolean, staggerIndex: number, animated: boolean): boolean {
      const targetFoot = box.center.y - box.size.y / 2;

      if (!animated || !isHeightAnimatableKind(box.kind)) {
        mesh.position.set(box.center.x, box.center.y, box.center.z);
        mesh.scale.set(box.size.x, box.size.y, box.size.z);
        tweens.delete(box.id);
        return false;
      }

      mesh.scale.x = box.size.x;
      mesh.scale.z = box.size.z;
      mesh.position.x = box.center.x;
      mesh.position.z = box.center.z;

      if (isNewMesh) {
        // Startzustand VOR dem ersten Tick: Fuß auf Zielposition, Höhe 0 — kein
        // sichtbarer Sprung, weil das Mesh in diesem Frame noch nicht
        // gerendert wurde.
        mesh.scale.y = 0;
        mesh.position.y = targetFoot;
      }

      const fromHeight = isNewMesh ? 0 : mesh.scale.y;
      const currentFoot = isNewMesh ? targetFoot : mesh.position.y - mesh.scale.y / 2;

      if (fromHeight === box.size.y && currentFoot === targetFoot) {
        tweens.delete(box.id);
        mesh.scale.y = box.size.y;
        // `mesh.position.y` ist die Box-MITTE (BoxGeometry ist ums Zentrum
        // skaliert), NICHT der Fußpunkt — also Fuß + halbe Höhe. Früher
        // fälschlich `targetFoot`: der Balken sackte dadurch beim erneuten
        // applyLayout um die halbe Höhe unter die Bodenplatte.
        mesh.position.y = targetFoot + box.size.y / 2;
        return false;
      }

      tweens.set(box.id, {
        startMs: null,
        durationMs: BAR_GROWTH_DURATION_MS,
        fromHeight,
        toHeight: box.size.y,
        foot: targetFoot,
        staggerIndex,
      });
      return true;
    },

    advance(nowMs: number): boolean {
      let running = false;
      for (const [id, tween] of tweens) {
        const mesh = deps.getMesh(id);
        if (!mesh) {
          tweens.delete(id);
          continue;
        }
        // Kaskade: t=0 ist der erste Tick + Staffelversatz. Bis dahin ist
        // `elapsed` negativ → rawT 0 → die Box bleibt auf ihrer Starthöhe
        // stehen, der Rückgabewert hält den Loop aber wach.
        if (tween.startMs === null) tween.startMs = nowMs + tween.staggerIndex * buildStaggerMs;
        const rawT = progress(nowMs - tween.startMs, tween.durationMs);
        const height = tween.fromHeight + (tween.toHeight - tween.fromHeight) * easeInOutCubic(rawT);
        mesh.scale.y = height;
        mesh.position.y = tween.foot + height / 2;
        if (rawT >= 1) tweens.delete(id);
        else running = true;
      }
      return running;
    },

    /** Laufende Tweens sofort auf ihren Zielwert springen lassen (Animationen aus). */
    settle(): void {
      for (const [id, tween] of tweens) {
        const mesh = deps.getMesh(id);
        if (mesh) {
          mesh.scale.y = tween.toHeight;
          mesh.position.y = tween.foot + tween.toHeight / 2;
        }
      }
      tweens.clear();
    },

    forget: (id: string) => void tweens.delete(id),
    clear: () => tweens.clear(),
  };
}

type OpacityTween = {
  startMs: number | null;
  durationMs: number;
  fromOpacity: number;
  toOpacity: number;
  /** EIGENE Klon-Instanz für die Tween-Dauer (nie die geteilte Registry-Instanz mutieren). */
  material: THREE.Material;
  /** Geteilte Ziel-Instanz — wird bei Tween-Ende wieder eingesetzt, der Klon disposed. */
  finalMaterial: THREE.Material;
};

function createOpacityTweens(deps: { getMesh: GetMesh }) {
  const tweens = new Map<string, OpacityTween>();

  function drop(id: string, tween: OpacityTween): void {
    tween.material.dispose();
    tweens.delete(id);
  }

  return {
    apply(mesh: THREE.Mesh, box: LayoutBox, isNewMesh: boolean, targetMaterial: THREE.Material, animated: boolean) {
      const pending = tweens.get(box.id);

      if (!animated) {
        if (pending) drop(box.id, pending);
        mesh.material = targetMaterial;
        return;
      }
      if (isNewMesh) {
        // Neue Box: kein Opazitäts-„Sprung" beobachtbar (existierte vorher
        // nicht) — direkt Zielmaterial, kein Klon/Tween nötig.
        mesh.material = targetMaterial;
        return;
      }
      // Bereits ein laufender Tween zu genau diesem Ziel — NICHT neu starten
      // (kein Timer-Reset bei wiederholtem `applyLayout` mit gleichem Ziel).
      if (pending && pending.toOpacity === box.opacity) return;

      const fromOpacity = materialOpacityOf(mesh.material);
      if (fromOpacity === box.opacity) {
        if (pending) drop(box.id, pending);
        mesh.material = targetMaterial;
        return;
      }

      // Ziel hat sich geändert (frischer Tween ODER Umlenkung eines laufenden).
      // Die Klon-Instanz trägt IMMER `transparent = true`, auch wenn das
      // Endziel `opacity === 1` ist: sonst ignoriert three.js die
      // Zwischen-Opazität auf einem `transparent: false`-Material.
      const material = pending ? pending.material : targetMaterial.clone();
      if (!pending) material.opacity = fromOpacity;
      material.transparent = true;

      mesh.material = material;
      tweens.set(box.id, {
        startMs: null,
        durationMs: OPACITY_FADE_DURATION_MS,
        fromOpacity,
        toOpacity: box.opacity,
        material,
        finalMaterial: targetMaterial,
      });
    },

    advance(nowMs: number): boolean {
      let running = false;
      for (const [id, tween] of tweens) {
        const mesh = deps.getMesh(id);
        if (!mesh) {
          drop(id, tween);
          continue;
        }
        if (tween.startMs === null) tween.startMs = nowMs;
        const rawT = progress(nowMs - tween.startMs, tween.durationMs);
        tween.material.opacity = tween.fromOpacity + (tween.toOpacity - tween.fromOpacity) * easeInOutCubic(rawT);
        if (rawT >= 1) {
          // Klon entsorgen, zurück auf die geteilte Ziel-Instanz — kein
          // dauerhafter Materialduplikat-Ballast nach Tween-Ende.
          mesh.material = tween.finalMaterial;
          drop(id, tween);
        } else {
          running = true;
        }
      }
      return running;
    },

    settle(): void {
      for (const [id, tween] of tweens) {
        const mesh = deps.getMesh(id);
        if (mesh) mesh.material = tween.finalMaterial;
        drop(id, tween);
      }
    },

    forget(id: string): void {
      const tween = tweens.get(id);
      if (tween) drop(id, tween);
    },

    dispose(): void {
      for (const [id, tween] of tweens) drop(id, tween);
    },
  };
}

export type CityTweens = {
  readonly enabled: boolean;
  /** Beim Abschalten springen laufende Tweens sofort auf ihren Zielwert — kein „eingefrorener" Zwischenzustand. */
  setEnabled(enabled: boolean): void;
  /** Höhen-/Fußpunkt-Anteil. `true`, wenn dabei ein Tween startete (Kaskaden-Zähler). */
  applyHeight(mesh: THREE.Mesh, box: LayoutBox, isNewMesh: boolean, staggerIndex: number): boolean;
  /** Opazitäts-Anteil, uniform für ALLE Kinds (deckt auch Balken-Opazitätsstufen zwischen Ebenen ab). */
  applyOpacity(mesh: THREE.Mesh, box: LayoutBox, isNewMesh: boolean, targetMaterial: THREE.Material): void;
  /** Schreibt alle laufenden Tweens fort. `true`, solange mindestens einer läuft. */
  advance(nowMs: number): boolean;
  /** Box ist aus dem Layout verschwunden — Tweens vergessen, Klon-Material freigeben. */
  forget(id: string): void;
  dispose(): void;
};

export function createCityTweens(deps: { quality: CityQualitySettings; getMesh: GetMesh }): CityTweens {
  let enabled = false;
  const heights = createHeightTweens(deps);
  const opacities = createOpacityTweens(deps);

  return {
    get enabled() {
      return enabled;
    },
    setEnabled(next) {
      if (enabled === next) return;
      enabled = next;
      if (next) return; // Betrifft nur künftige `applyLayout`-Aufrufe.
      heights.settle();
      opacities.settle();
    },
    applyHeight: (mesh, box, isNewMesh, staggerIndex) => heights.apply(mesh, box, isNewMesh, staggerIndex, enabled),
    applyOpacity: (mesh, box, isNewMesh, target) => opacities.apply(mesh, box, isNewMesh, target, enabled),
    // Beide Anteile laufen IMMER — kein Kurzschluss über `||`, sonst bliebe
    // der zweite bei laufendem erstem stehen.
    advance(nowMs) {
      const heightsRunning = heights.advance(nowMs);
      const opacitiesRunning = opacities.advance(nowMs);
      return heightsRunning || opacitiesRunning;
    },
    forget(id) {
      heights.forget(id);
      opacities.forget(id);
    },
    dispose() {
      opacities.dispose();
      heights.clear();
    },
  };
}
