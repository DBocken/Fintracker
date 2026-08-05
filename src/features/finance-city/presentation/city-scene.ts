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
 * WP-C6 (Aufbau-Animationen): `applyLayout` setzt die Ziel-Transform/Opazität
 * NICHT mehr zwingend sofort, sondern startet (wenn `setAnimationsEnabled(true)`,
 * Default `false`) pro Box einen IST→ZIEL-Tween, den `advanceAnimations(nowMs)`
 * pro Frame fortschreibt — getickt vom BESTEHENDEN Render-Loop in
 * `CityCanvas.tsx` (Single-rAF-Invariante, siehe dortiger Kommentar), kein
 * eigener Timer. Zwei Tween-Arten: Höhen-Wachstum (`bar`/`floor`/`cap`,
 * fußpunkt-verankert über `scale.y`/`position.y`) und Opazitäts-Fade (alle
 * Kinds, IMMER über eine PRO-MESH-Materialklon-Instanz — die geteilte
 * `materialRegistry`-Instanz darf während eines Tweens nie mutiert werden,
 * sonst faden alle anderen Boxen mit demselben
 * `${color}|${opacity}|${bucket}|${texture}`-Schlüssel unbeabsichtigt mit).
 *
 * WP-E1 (Visual-Polish: Himmel/Boden/Tiefe) — alles statisch, strikt
 * Render-on-Demand, KEINE Schatten-Maps, DPR-Cap unverändert:
 * - Himmel: vertikale Gradient-`CanvasTexture` je Theme als `scene.background`
 *   (Palette `skyTop`/`skyHorizon`); der Fog trägt den HORIZONT-Ton, damit
 *   der Stadtrand in den Himmel übergeht statt gegen eine Wand aus Farbe.
 * - Boden: prozedurale Straßen-Raster-Textur (je Theme) als `map` NUR auf dem
 *   `ground`-Material; Repeat folgt der Bodengröße (gleiche Straßen-Dichte
 *   auf jeder Ebene). Grundstücke bekommen ihre Farbkante aus der Domain
 *   (`edges: true`, generischer Kanten-Pfad).
 * - Kontaktschatten: EINE geteilte Radial-Gradient-Textur + EINE geteilte
 *   PlaneGeometry; pro Grundstück und pro Balken-/Etagen-Stapel-Fuß eine
 *   Ebene (`depthWrite: false`, Render-Order zwischen plot und bar) — fake
 *   Grounding ohne Shadow-Pass. Lebenszyklus folgt dem `applyLayout`-Diff.
 * - Fassade: EINE geteilte Graustufen-Textur (vertikaler AO-Gradient +
 *   zartes Fenster-Raster, albedo-only) als `map` auf allen `solid`-
 *   Materialien — Distrikt-Tint bleibt `material.color`, eine Textur für
 *   alle Farben. Bewusst KEINE Emissive-Fenster in v1 (Theme-Wechsel bleibt
 *   billig: Himmel/Boden-Textur + Fog tauschen, kein Registry-Rebuild).
 * - Caps: `cap`-Boxen (Domain) laufen im `solid`-Bucket mit Balken-Render-
 *   Order und wachsen im Höhen-Tween (Fuß = Balken-Oberkante).
 * - Aufbau: gestaffelte Kaskade (`BUILD_STAGGER_MS` je höhenanimierter Box,
 *   deaktiviert bei reduced-motion, da dort ohnehin sofort angewendet wird).
 */

import * as THREE from 'three';
import type { CityLayout, LayoutBox, LayoutBoxKind } from '../domain/city-layout';
import type { Vec3 } from '../domain/city-model';
import { easeInOutCubic } from '../domain/camera-math';
import { MOTION_DURATIONS } from '@/lib/motion-tokens';

export type CityCameraPose = { position: Vec3; target: Vec3 };

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
   * injizierter Zeit aufgerufen (kein `Date.now()` hier, analog
   * `city-camera-controller.ts#tick`) — KEIN zweiter `requestAnimationFrame`/
   * `setInterval` (Single-rAF-Invariante). Interpoliert alle laufenden Höhen-
   * und Opazitäts-Tweens mit `easeInOutCubic` und wendet sie auf die Meshes
   * an. Liefert `true`, solange mindestens ein Tween noch läuft (Aufrufer
   * ORt das in `changed`/hält den Loop wach), sonst `false`. Der erste Aufruf
   * NACH dem Start eines Tweens definiert dessen `t=0` (Tween-lokal, nicht
   * global — mehrere zeitlich versetzt gestartete Tweens laufen unabhängig);
   * WP-E1: bei Höhen-Tweens kommt der Kaskaden-Startversatz
   * (`staggerIndex × BUILD_STAGGER_MS`) auf diesen ersten Tick obendrauf.
   */
  advanceAnimations(nowMs: number): boolean;
  /**
   * WP-C6: `false` (Default) = Sofort-Endzustand bei `applyLayout` (kein
   * Tween, `prefers-reduced-motion`). `true` = künftige `applyLayout`-Aufrufe
   * starten Tweens. Beim Umschalten auf `false` werden alle GERADE laufenden
   * Tweens sofort auf ihren Zielwert gesprungen (Mesh-Transform/-Opazität)
   * und die zugehörigen Klon-Materialien entsorgt — kein "eingefrorener"
   * Zwischenzustand.
   */
  setAnimationsEnabled(enabled: boolean): void;
  /** Raycast auf pickable Boxen → `box.id`, oder `null` bei Boden/Leere. */
  pick(clientX: number, clientY: number): string | null;
  /**
   * WP-D3 (Hover-Kopplung Label↔Box): hebt GENAU EINE Box visuell hervor
   * (`null` = keine). Lambert-Baukörper (Balken/Etagen) bekommen ein dezentes
   * Emissive-Glühen, transparente Hüllen einen Opazitäts-Schub — jeweils über
   * eine EIGENE Klon-Material-Instanz (Invariante 2 von WP-C6: die geteilte
   * `materialRegistry`-Instanz wird NIE mutiert, sonst leuchten alle Boxen mit
   * demselben Material-Schlüssel mit). Aufrufer muss danach einen Frame
   * anfordern (`invalidate`) — diese Methode rendert nicht selbst.
   */
  setHighlight(id: string | null): void;
  setSize(width: number, height: number, dpr: number): void;
  /** Erst ab WP-C4 mit echten Werten befüllt — hier no-op-fähig (near/far nicht endlich → Fog aus). */
  setFog(near: number, far: number): void;
  /** WP-C9: Light/Dark umschalten (Hintergrund, Beleuchtung, Fog-Farbe). Initial aus der `dark`-Klasse am `<html>` abgeleitet; `CityCanvas` spiegelt spätere Theme-Wechsel per `subscribeToDarkModeChanges`. */
  setTheme(theme: 'light' | 'dark'): void;
  /** WP-4.3: Atmosphäre-Preset — subtile Lichtmodulation basierend auf Finanzzustand. */
  setAtmospherePreset(preset: 'stable' | 'neutral' | 'risk'): void;
  render(): void;
  /** Räumt ALLES auf: geteilte Geometrien, Material-/Edge-Material-Registry, Renderer. */
  dispose(): void;
  /**
   * WP-C4-Andockpunkt: setzt Kamera-Position + Orbit-Target direkt (kein
   * Easing/Flug — das übernimmt der Kamera-Controller in WP-C4). `CityCanvas`
   * nutzt das nur für die statische Startpose (WP-C3); C4 ruft dieselbe
   * Methode pro Animationsframe mit interpolierten Werten auf, ohne
   * `CityCanvas.tsx` anzufassen.
   */
  applyCameraPose(pose: CityCameraPose): void;
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
  /** Tests injizieren einen Fake-Renderer (setSize/render/dispose/domElement-Stubs), damit der Szenengraph ohne echten WebGL-Kontext (jsdom) testbar bleibt. */
  createRenderer?: (canvas: HTMLCanvasElement) => THREE.WebGLRenderer;
};

/** Vertikales FOV der Stadt-Kamera — von `CityCanvas`/`CityPage` für `fitCameraDistance` wiederverwendet, damit Kamera-FOV und Distanz-Mathematik nie auseinanderlaufen. */
export const CAMERA_FOV_Y_DEG = 50;

/**
 * Theme-abhängige Szenen-Farben/-Beleuchtung (WP-C9). three.js rendert außerhalb
 * des DOM-Stylesheet-Kontexts, hat also keinen Zugriff auf CSS-Variablen —
 * deshalb bewusst dokumentierte feste Werte je Theme statt einer CSS-Anbindung.
 * `dark` orientiert sich am App-Dark-`--background` (190 22% 8%), `light` an
 * einem hellen neutralen Slate-Ton, damit die (mittelhelle) Distrikt-Palette
 * auf beiden Hintergründen lesbar bleibt.
 */
type CityTheme = 'light' | 'dark';

type ThemePalette = {
  /** WP-E1 Himmel-Verlauf: `skyTop` = tiefer Ton oben, `skyHorizon` = helles Horizontband (zugleich Fog-Farbe). */
  skyTop: number;
  skyHorizon: number;
  /** Hemisphären-Licht (Himmel/Boden) + Intensität. */
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  /** Gerichtetes Licht (Modellierung/Schattierung der Baukörper) — WP-E1 warm eingefärbt (Gegenlicht bleibt kühl). */
  dirColor: number;
  dirIntensity: number;
};

/** Exportiert für die Szenen-Tests (Fog-/Licht-Assertions gegen die kanonischen Töne statt duplizierter Literale). */
export const THEME_PALETTES: Record<CityTheme, ThemePalette> = {
  dark: {
    skyTop: 0x0a1013,
    skyHorizon: 0x1c2a30,
    hemiSky: 0xdfe8ea,
    hemiGround: 0x14181b,
    hemiIntensity: 1.15,
    dirColor: 0xfff2e2,
    dirIntensity: 0.85,
  },
  light: {
    skyTop: 0xc8dae4,
    skyHorizon: 0xf3f7f8,
    hemiSky: 0xffffff,
    hemiGround: 0xd3dce0,
    hemiIntensity: 1.0,
    dirColor: 0xfff8ec,
    dirIntensity: 0.55, // schwächer: auf hellem Hintergrund würde starkes Direktlicht die Baukörper ausbleichen.
  },
};

function initialTheme(): CityTheme {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 1000;

/** Dezente Kanten-Opazität für Hüllen-Wireframes (Kamera-Regel-neutral, reiner Stil-Wert). */
const EDGE_OPACITY = 0.35;

/**
 * WP-D6 (Premium-Look): dezentes Eigenleuchten der soliden Baukörper in ihrer
 * EIGENEN Farbe — hebt Sättigung/Präsenz auf der dunklen Szene, ohne Bloom/
 * Post-Processing (Render-on-Demand + Mobil-Akku bleiben unberührt).
 */
const SOLID_EMISSIVE_INTENSITY = 0.16;

// ---------------------------------------------------------------------------
// WP-E1: Prozedurale Canvas-Texturen (alle ≤ 256 px, EINMAL erzeugt und
// gecacht, keine Render-Passes). jsdom-Sicherheit: ohne 2D-Canvas-Kontext
// (jsdom ohne node-canvas) liefern die Fabriken `null` und die Szene fällt
// still auf un-texturierte Materialien/Farben zurück — gleiche Degradation
// wie der WebGL-Fallback in `CityCanvas.tsx`.
// ---------------------------------------------------------------------------

/** 2D-Canvas + Kontext, oder `null` wo kein 2D-Kontext existiert (jsdom). */
function createCanvas2d(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  return { canvas, ctx };
}

function hexCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/** Himmel: 1×256 vertikaler Verlauf (als Hintergrund-Textur bildschirmfüllend gestreckt). */
const SKY_TEXTURE_HEIGHT = 256;

function createSkyGradientTexture(palette: ThemePalette): THREE.CanvasTexture | null {
  const target = createCanvas2d(1, SKY_TEXTURE_HEIGHT);
  if (!target) return null;
  const { canvas, ctx } = target;
  // Canvas-y=0 ist der BILDSCHIRM-Oben: tiefer Ton oben, helles Horizontband unten.
  const gradient = ctx.createLinearGradient(0, 0, 0, SKY_TEXTURE_HEIGHT);
  gradient.addColorStop(0, hexCss(palette.skyTop));
  gradient.addColorStop(1, hexCss(palette.skyHorizon));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1, SKY_TEXTURE_HEIGHT);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Boden: 256×256 "Stadtblock"-Kachel (feines Raster + kräftigere Straßenlinien), RepeatWrapping. */
const GROUND_TEXTURE_SIZE = 256;
/** Feine Rasterzellen pro Kachel; jede N-te Linie ist eine (kräftigere) Straße. */
const GROUND_GRID_LINES = 8;
const GROUND_STREET_EVERY = 4;
/** Weltgröße einer Boden-Kachel — Repeat wird aus der Bodengröße abgeleitet, damit die Straßen-Dichte auf jeder Ebene gleich bleibt. */
const GROUND_TILE_WORLD_SIZE = 3;

/**
 * Kachel-Farbwerte je Theme: die Basis ist nahezu weiß, weil `material.color`
 * (Domain-`GROUND_COLOR`) weiterhin multipliziert — die Theme-Führung liegt
 * nur im Linien-Kontrast (dark = asphalt-betonter, light = feiner/neutraler).
 */
const GROUND_TEXTURE_STYLES: Record<CityTheme, { base: string; fineLine: string; streetLine: string }> = {
  dark: { base: '#e9e9e9', fineLine: 'rgba(0,0,0,0.16)', streetLine: 'rgba(0,0,0,0.30)' },
  light: { base: '#ffffff', fineLine: 'rgba(0,0,0,0.08)', streetLine: 'rgba(0,0,0,0.16)' },
};

function createGroundTexture(theme: CityTheme): THREE.CanvasTexture | null {
  const target = createCanvas2d(GROUND_TEXTURE_SIZE, GROUND_TEXTURE_SIZE);
  if (!target) return null;
  const { canvas, ctx } = target;
  const style = GROUND_TEXTURE_STYLES[theme];
  ctx.fillStyle = style.base;
  ctx.fillRect(0, 0, GROUND_TEXTURE_SIZE, GROUND_TEXTURE_SIZE);

  const cell = GROUND_TEXTURE_SIZE / GROUND_GRID_LINES;
  // Feine Rasterlinien: je Zellgrenze 1 px (am Kachelrand nur INNEN zeichnen,
  // die nächste Kachel setzt nahtlos fort).
  ctx.fillStyle = style.fineLine;
  for (let i = 0; i < GROUND_GRID_LINES; i += 1) {
    const p = Math.round(i * cell);
    ctx.fillRect(p, 0, 1, GROUND_TEXTURE_SIZE);
    ctx.fillRect(0, p, GROUND_TEXTURE_SIZE, 1);
  }
  // Straßenlinien: 3 px, mittig auf jeder N-ten Zellgrenze — an beiden
  // Kachelrändern gezeichnet, damit sie nahtlos über den Kachelübergang laufen.
  ctx.fillStyle = style.streetLine;
  for (let i = 0; i <= GROUND_GRID_LINES; i += GROUND_STREET_EVERY) {
    const p = Math.round(i * cell);
    ctx.fillRect(p - 1, 0, 3, GROUND_TEXTURE_SIZE);
    ctx.fillRect(0, p - 1, GROUND_TEXTURE_SIZE, 3);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Fassade: 256×256 Graustufen — dominanter vertikaler AO-Gradient (streckungs-tolerant) + zartes Fenster-Raster (Textur-Charakter, keine wörtlichen Fenster). */
const FACADE_TEXTURE_SIZE = 256;
const FACADE_AO_MAX_ALPHA = 0.3;
/** Anteil der Texturhöhe (von unten), über den der AO-Gradient abklingt. */
const FACADE_AO_FADE_HEIGHT_RATIO = 0.55;
const FACADE_WINDOW_COLS = 6;
const FACADE_WINDOW_ROWS = 12;
const FACADE_WINDOW_ALPHA = 0.07;

function createFacadeTexture(): THREE.CanvasTexture | null {
  const target = createCanvas2d(FACADE_TEXTURE_SIZE, FACADE_TEXTURE_SIZE);
  if (!target) return null;
  const { canvas, ctx } = target;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, FACADE_TEXTURE_SIZE, FACADE_TEXTURE_SIZE);

  // AO-Gradient: dunkler Sockel -> nach ~55 % Höhe transparent. Canvas-y=0
  // ist über `flipY` (three.js-Standard) der Gebäude-OBERKANTE zugeordnet,
  // der dunkle Anteil liegt also am UNTEREN Canvas-Rand.
  const ao = ctx.createLinearGradient(
    0,
    FACADE_TEXTURE_SIZE,
    0,
    FACADE_TEXTURE_SIZE * (1 - FACADE_AO_FADE_HEIGHT_RATIO),
  );
  ao.addColorStop(0, `rgba(0,0,0,${FACADE_AO_MAX_ALPHA})`);
  ao.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = ao;
  ctx.fillRect(0, 0, FACADE_TEXTURE_SIZE, FACADE_TEXTURE_SIZE);

  const cellW = FACADE_TEXTURE_SIZE / FACADE_WINDOW_COLS;
  const cellH = FACADE_TEXTURE_SIZE / FACADE_WINDOW_ROWS;
  ctx.fillStyle = `rgba(0,0,0,${FACADE_WINDOW_ALPHA})`;
  for (let row = 0; row < FACADE_WINDOW_ROWS; row += 1) {
    for (let col = 0; col < FACADE_WINDOW_COLS; col += 1) {
      ctx.fillRect(col * cellW + cellW * 0.25, row * cellH + cellH * 0.3, cellW * 0.5, cellH * 0.45);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Kontaktschatten: 256×256 radialer Alpha-Verlauf (weicher Kern -> transparent). */
const CONTACT_SHADOW_TEXTURE_SIZE = 256;
const CONTACT_SHADOW_CORE_ALPHA = 0.42;
const CONTACT_SHADOW_MID_ALPHA = 0.18;
/** Radiale Position des Übergangs zum Auslaufen (0..1). */
const CONTACT_SHADOW_MID_STOP = 0.55;

function createContactShadowTexture(): THREE.CanvasTexture | null {
  const target = createCanvas2d(CONTACT_SHADOW_TEXTURE_SIZE, CONTACT_SHADOW_TEXTURE_SIZE);
  if (!target) return null;
  const { canvas, ctx } = target;
  const center = CONTACT_SHADOW_TEXTURE_SIZE / 2;
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, `rgba(0,0,0,${CONTACT_SHADOW_CORE_ALPHA})`);
  gradient.addColorStop(CONTACT_SHADOW_MID_STOP, `rgba(0,0,0,${CONTACT_SHADOW_MID_ALPHA})`);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CONTACT_SHADOW_TEXTURE_SIZE, CONTACT_SHADOW_TEXTURE_SIZE);
  return new THREE.CanvasTexture(canvas);
}

/** Kontaktschatten-Ausdehnung: Grundstück × Faktor, Balken-Footprint + fester Margin. */
const CONTACT_SHADOW_PLOT_SCALE = 1.15;
const CONTACT_SHADOW_BAR_MARGIN = 0.25;
/**
 * y-Offsets knapp ÜBER der Grundstücks-Oberkante (PLOT_THICKNESS = 0.05,
 * `city-layout.ts`) — gestaffelt (Balken-Schatten über Plot-Schatten), damit
 * sich überlappende Ebenen nicht beißen (kein Z-Fighting trotz `depthWrite: false`).
 */
const CONTACT_SHADOW_PLOT_Y = 0.058;
const CONTACT_SHADOW_BAR_Y = 0.072;
/** Zeichenreihenfolge zwischen Grundstück (0) und Balken (1). */
const CONTACT_SHADOW_RENDER_ORDER = 0.5;
/** Fußpunkt-Toleranz: nur Baukörper, die auf dem Boden stehen (nicht Etagen auf Etagen oder Caps auf Dächern), werfen einen Schatten. */
const CONTACT_SHADOW_FOOT_EPSILON = 0.001;

/**
 * Zwei Material-„Buckets": undurchsichtige Baukörper (Balken/Etagen/Boden)
 * nutzen `MeshLambertMaterial` (reagiert auf Licht, `flatShading` bewusst
 * NICHT gesetzt = glatte Flächen), Hüllen/Grundstücke sind `MeshBasicMaterial`
 * mit `transparent`+`depthWrite=false` (Balken dahinter bleiben sichtbar).
 */
function materialBucketFor(kind: LayoutBoxKind): 'solid' | 'transparent' {
  return kind === 'hull' || kind === 'plot' ? 'transparent' : 'solid';
}

/**
 * Zeichenreihenfolge: Boden zuerst, dann Grundstücke, dann Balken/Etagen/
 * Caps, Hüllen zuletzt ("Hüllen NACH Balken" — sonst würde die transparente
 * Hülle Balken dahinter beim Alpha-Blending verdecken können).
 */
function renderOrderFor(kind: LayoutBoxKind): number {
  switch (kind) {
    case 'ground':
      return -1;
    case 'plot':
      return 0;
    case 'bar':
    case 'floor':
    case 'cap':
      return 1;
    case 'hull':
      return 2;
    default:
      return 0;
  }
}

export function createCityScene(opts: CreateCitySceneOptions): CitySceneHandle {
  const { canvas } = opts;

  let theme: CityTheme = initialTheme();
  let palette = THEME_PALETTES[theme];
  /** Horizontton des aktiven Themes — Fog-Farbe (WP-E1: der Stadtrand löst sich im Himmel-Horizontband auf statt gegen eine flache Wand aus Farbe). */
  let horizonColor = palette.skyHorizon;

  // WP-E1: alle Texturen EINMALIG bei Szenen-Erstellung erzeugen (prozedural,
  // ≤ 256 px) — `setTheme` tauscht danach nur noch Referenzen, kein Neuaufbau.
  // `null` in Umgebungen ohne 2D-Canvas (jsdom) → stiller Farb-/Basis-Fallback.
  const skyTextures: Record<CityTheme, THREE.CanvasTexture | null> = {
    dark: createSkyGradientTexture(THEME_PALETTES.dark),
    light: createSkyGradientTexture(THEME_PALETTES.light),
  };
  const groundTextures: Record<CityTheme, THREE.CanvasTexture | null> = {
    dark: createGroundTexture('dark'),
    light: createGroundTexture('light'),
  };
  const facadeTexture = createFacadeTexture(); // theme-tolerant (Graustufen-Albedo), kein Swap nötig.
  const contactShadowTexture = createContactShadowTexture(); // theme-tolerant (Alpha-Matte), kein Swap nötig.

  const scene = new THREE.Scene();
  scene.background = skyTextures[theme] ?? new THREE.Color(horizonColor);

  const camera = new THREE.PerspectiveCamera(CAMERA_FOV_Y_DEG, 1, CAMERA_NEAR, CAMERA_FAR);
  camera.position.set(0, 10, 16);
  const target = new THREE.Vector3(0, 0, 0);
  camera.lookAt(target);
  // Kamera als Szenen-Kind: nicht renderrelevant (`renderer.render(scene,
  // camera)` funktioniert unabhängig von der Parent-Beziehung), gibt Tests
  // aber über `camera.parent` einen Weg, den Szenengraphen zu inspizieren,
  // ohne eine zusätzliche Debug-only-API auf `CitySceneHandle` zu brauchen.
  scene.add(camera);

  // Kein Schatten (README/Akzeptanzkriterium: Render-on-Demand + Mobil-Akku
  // — Schatten-Maps kosten zusätzliche Passes, die hier nicht nötig sind).
  // Farben/Intensitäten kommen aus der Theme-Palette (WP-C9, `setTheme`).
  const hemisphereLight = new THREE.HemisphereLight(palette.hemiSky, palette.hemiGround, palette.hemiIntensity);
  scene.add(hemisphereLight);
  const directionalLight = new THREE.DirectionalLight(palette.dirColor, palette.dirIntensity);
  directionalLight.position.set(8, 14, 6);
  scene.add(directionalLight);
  // WP-D6 (Premium-Look): kühles Gegen-/Kantenlicht von schräg hinten —
  // modelliert die dem Hauptlicht abgewandten Baukörper-Kanten (mehr Tiefe),
  // bewusst OHNE Schatten-Maps (README-Akzeptanzkriterium: Render-on-Demand/
  // Akku). Fester, themenneutraler Stil-Wert wie `EDGE_OPACITY`.
  const rimLight = new THREE.DirectionalLight(0xbfd8ff, 0.35);
  rimLight.position.set(-8, 10, -10);
  scene.add(rimLight);

  // DPR bei Renderer-Erstellung: Antialiasing nur, wenn der (gedeckelte)
  // Device-Pixel-Ratio niedrig genug ist (hohe DPR + MSAA verdoppelt die
  // Fragment-Last unnötig, das eigentliche Downsampling durch die Pixeldichte
  // übernimmt dort schon einen Teil der Kantenglättung).
  const initialDpr =
    typeof window !== 'undefined' && typeof window.devicePixelRatio === 'number'
      ? Math.min(window.devicePixelRatio, 2)
      : 1;
  const renderer =
    opts.createRenderer?.(canvas) ??
    new THREE.WebGLRenderer({
      canvas,
      antialias: initialDpr <= 1.5,
      alpha: false,
      // 'high-performance': die Stadt ist eine dedizierte 3D-Vollflächen-
      // Ansicht — auf Dual-GPU-Geräten soll der schnelle Chip ran. Den
      // Akku schont bereits der Render-on-Demand-Loop (CityCanvas.tsx),
      // nicht die GPU-Wahl.
      powerPreference: 'high-performance',
    });

  // WP-D6 (Premium-Look): filmisches ACES-Tone-Mapping — tiefere Kontraste und
  // sattere Farben OHNE zusätzliche Render-Passes (kein Post-Processing, die
  // Render-on-Demand-/Akku-Vorgabe bleibt unberührt). Exposure leicht angehoben,
  // weil ACES die Mitten sonst etwas absenkt.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  // EINE geteilte Box-Geometrie für ALLE Boxen (Balken/Etagen/Hüllen/
  // Grundstücke/Boden) — Größe kommt ausschließlich über `mesh.scale`
  // (LayoutBox.size), Position über `mesh.position` (LayoutBox.center).
  const sharedBoxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const sharedEdgesGeometry = new THREE.EdgesGeometry(sharedBoxGeometry);

  const materialRegistry = new Map<string, THREE.Material>();
  const edgeMaterialRegistry = new Map<string, THREE.LineBasicMaterial>();
  const meshesById = new Map<string, THREE.Mesh>();
  const edgesById = new Map<string, THREE.LineSegments>();

  // --- WP-E1: Kontaktschatten (fake Grounding, KEINE Schatten-Maps) --------
  // EINE geteilte Geometrie/Material/Textur für alle Schatten-Ebenen; der
  // Lebenszyklus der Ebenen folgt dem `applyLayout`-Diff (mit der Box
  // entfernt, in `dispose()` komplett geräumt). Statisch — null Loop-Kosten.
  const contactShadowGeometry = new THREE.PlaneGeometry(1, 1);
  const contactShadowMaterial = contactShadowTexture
    ? new THREE.MeshBasicMaterial({ map: contactShadowTexture, transparent: true, depthWrite: false })
    : null; // jsdom-Fallback ohne 2D-Canvas: keine Schatten, Rest unverändert.
  const contactShadowsById = new Map<string, THREE.Mesh>();

  type ContactShadowSpec = { width: number; depth: number; y: number };

  /**
   * Welche Box bekommt eine Schatten-Ebene und in welcher Ausdehnung/Höhe?
   * - Grundstück: × `CONTACT_SHADOW_PLOT_SCALE`, tiefer gestaffelt.
   * - Balken / UNTERSTE Etage eines Stapels (Fuß auf Bodenhöhe): Footprint +
   *   Margin, über dem Grundstücks-Schatten. Obere Etagen und Caps (Fuß auf
   *   einer Box darunter) werfen keinen eigenen Schatten — ein Schatten je
   *   Stapel, nicht je Etage.
   */
  function contactShadowSpecFor(box: LayoutBox): ContactShadowSpec | null {
    if (box.kind === 'plot') {
      return {
        width: box.size.x * CONTACT_SHADOW_PLOT_SCALE,
        depth: box.size.z * CONTACT_SHADOW_PLOT_SCALE,
        y: CONTACT_SHADOW_PLOT_Y,
      };
    }
    if (box.kind === 'bar' || box.kind === 'floor') {
      const foot = box.center.y - box.size.y / 2;
      if (foot > CONTACT_SHADOW_FOOT_EPSILON) return null;
      return {
        width: box.size.x + 2 * CONTACT_SHADOW_BAR_MARGIN,
        depth: box.size.z + 2 * CONTACT_SHADOW_BAR_MARGIN,
        y: CONTACT_SHADOW_BAR_Y,
      };
    }
    return null;
  }

  /**
   * Boden-Textur-Repeat: die Straßen-Dichte soll auf jeder Ebene gleich
   * bleiben (eine Kachel = `GROUND_TILE_WORLD_SIZE` Welt-Einheiten) — Repeat
   * folgt der aktuellen Bodengröße. Beide Theme-Texturen werden synchron
   * gehalten, damit ein Theme-Wechsel die Dichte nicht zurücksetzt.
   */
  function syncGroundTextureRepeat(groundBox: LayoutBox): void {
    const repeatX = Math.max(1, Math.round(groundBox.size.x / GROUND_TILE_WORLD_SIZE));
    const repeatY = Math.max(1, Math.round(groundBox.size.z / GROUND_TILE_WORLD_SIZE));
    for (const texture of [groundTextures.light, groundTextures.dark]) {
      texture?.repeat.set(repeatX, repeatY);
    }
  }

  // --- WP-C6: Aufbau-Animationen ------------------------------------------
  // Default `false`: bewusst dasselbe Sofort-Verhalten wie vor WP-C6, bis
  // `CityCanvas` explizit `setAnimationsEnabled(!reducedMotion)` aufruft
  // (Mount-Reihenfolge dokumentiert dort) — hält alle bestehenden
  // `city-scene.test.ts`-Erwartungen (Sofort-Werte nach `applyLayout`) ohne
  // Änderung gültig.
  let animationsEnabled = false;

  /** Balken-/Etagen-/Cap-Wachstum: `scale.y`/`position.y` fußpunkt-verankert. */
  const BAR_GROWTH_DURATION_MS = MOTION_DURATIONS.slow;
  /** Opazitäts-Fade (Hüllen-Ebenenwechsel, Balken-Opazitätsstufen etc.). */
  const OPACITY_FADE_DURATION_MS = MOTION_DURATIONS.default;
  /**
   * WP-E1: Staffel-Schritt der Aufbau-Kaskade — der n-te höhenanimierte
   * Baukörper eines `applyLayout`-Batchs startet `n × BUILD_STAGGER_MS`
   * später (kurze Settle-Kaskade statt All-at-once). Bei ≤ ~20 Höhen-Tweens
   * bleibt die Zusatzzeit < 1 s; bei deaktivierten Animationen
   * (`prefers-reduced-motion`) greift sie nie, weil dort sofort angewendet
   * wird. KEINE Ambient-/Idle-Animation — die Tweens laufen im bestehenden
   * Render-on-Demand-Loop und enden dort.
   */
  const BUILD_STAGGER_MS = 50;

  type HeightTween = {
    /** `null` = noch nicht getickt — der ERSTE `advanceAnimations`-Aufruf danach definiert `t=0` (wie `city-camera-controller.ts#tick`), zzgl. `staggerIndex × BUILD_STAGGER_MS` (WP-E1-Kaskade). */
    startMs: number | null;
    durationMs: number;
    fromHeight: number;
    toHeight: number;
    /** Fixer Ziel-Fußpunkt (`box.center.y - box.size.y / 2`) — bei einem Balken auf Bodenebene ist das exakt 0 ("Fuß bleibt bei y=0"), bei einer Etage die kumulierte Stapelhöhe darunter, bei einem Cap die Balken-Oberkante. NICHT selbst interpoliert (Scope-Cut, siehe Report): ändert sich der Fußpunkt zwischen zwei Layouts ausnahmsweise (z. B. Etagen-Reihenfolge), springt die Box beim Tween-Start auf den neuen Fuß. */
    foot: number;
    /** WP-E1: Position im `applyLayout`-Batch — Startversatz der Kaskade. */
    staggerIndex: number;
  };
  const heightTweensById = new Map<string, HeightTween>();

  type OpacityTween = {
    startMs: number | null;
    durationMs: number;
    fromOpacity: number;
    toOpacity: number;
    /** EIGENE Klon-Instanz für die Tween-Dauer (Invariante 2: NIE die geteilte `materialRegistry`-Instanz mutieren — sonst faden alle Boxen mit demselben `${color}|${opacity}|${bucket}`-Schlüssel mit). */
    material: THREE.Material;
    /** Geteilte Ziel-Instanz aus `materialRegistry` (via `getMaterial`) — wird bei Tween-Ende wieder eingesetzt, der Klon oben wird disposed. */
    finalMaterial: THREE.Material;
  };
  const opacityTweensById = new Map<string, OpacityTween>();

  function isHeightAnimatableKind(kind: LayoutBoxKind): boolean {
    // WP-E1: Caps wachsen wie ihre Balken (Fuß = Balken-Oberkante).
    return kind === 'bar' || kind === 'floor' || kind === 'cap';
  }

  /** `mesh.material` ist typisiert als `Material | Material[]` (three.js-Generics-Default) — hier werden aber nie Material-Arrays zugewiesen, nur einzelne Instanzen. */
  function materialOpacityOf(material: THREE.Material | THREE.Material[]): number {
    return Array.isArray(material) ? (material[0]?.opacity ?? 1) : material.opacity;
  }

  function getMaterial(box: LayoutBox): THREE.Material {
    const bucket = materialBucketFor(box.kind);
    // WP-E1: Boden bekommt die (theme-abhängige) Straßen-Textur, alle anderen
    // soliden Baukörper die (theme-tolerante) Fassaden-Textur — beide
    // multiplizieren `material.color`, das 1:1-Farbmapping aus der Domain
    // bleibt erhalten. Die Textur-Art ist Teil des Registry-Schlüssels, damit
    // Boden und ein zufällig gleichfarbiger Balken nie dieselbe Instanz
    // teilen (und `setTheme` gezielt NUR Boden-Materialien ummappen kann).
    const textureKey = box.kind === 'ground' ? 'ground' : bucket === 'solid' ? 'facade' : 'none';
    const key = `${box.color}|${box.opacity}|${bucket}|${textureKey}`;
    const cached = materialRegistry.get(key);
    if (cached) return cached;

    const material: THREE.Material =
      bucket === 'transparent'
        ? new THREE.MeshBasicMaterial({
            color: box.color,
            transparent: true,
            opacity: box.opacity,
            depthWrite: false, // Balken hinter einer Hülle/über einem Grundstück bleiben sichtbar.
          })
        : new THREE.MeshLambertMaterial({
            color: box.color,
            map: box.kind === 'ground' ? groundTextures[theme] : facadeTexture,
            // WP-D6: Eigenleuchten in der Boxfarbe (siehe SOLID_EMISSIVE_INTENSITY)
            // — das Hover-Highlight (`setHighlight`) glüht dagegen WEISS und
            // bleibt dadurch klar unterscheidbar.
            emissive: box.color,
            emissiveIntensity: SOLID_EMISSIVE_INTENSITY,
            transparent: box.opacity < 1,
            opacity: box.opacity,
          });

    materialRegistry.set(key, material);
    return material;
  }

  function getEdgeMaterial(color: string): THREE.LineBasicMaterial {
    const cached = edgeMaterialRegistry.get(color);
    if (cached) return cached;
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: EDGE_OPACITY });
    edgeMaterialRegistry.set(color, material);
    return material;
  }

  /**
   * Höhen-/Fußpunkt-Anteil von `applyLayout` (WP-C6). Nur `bar`/`floor`/`cap`
   * wachsen fußpunkt-verankert; alle anderen Kinds (Hülle/Grundstück/Boden
   * haben ohnehin keine Höhen-Semantik) UND jeder Fall mit deaktivierten
   * Animationen setzen weiterhin sofort die Zielwerte (Alt-Verhalten).
   * x/z sind NIE Teil des Wachstums-Tweens (bewusster Scope-Cut, Report) —
   * Grid-Position/Footprint ändern sich für eine gegebene `box.id` in der
   * Praxis ohnehin nicht zwischen zwei Layouts derselben Box-Art.
   *
   * Rückgabe: der frisch registrierte Tween (WP-E1: `applyLayout` vergibt
   * darauf den `staggerIndex` der Kaskade) oder `null` (Sofort-Pfad/kein
   * Tween nötig).
   */
  function applyBoxHeight(mesh: THREE.Mesh, box: LayoutBox, isNewMesh: boolean): HeightTween | null {
    const targetFoot = box.center.y - box.size.y / 2;

    if (!animationsEnabled || !isHeightAnimatableKind(box.kind)) {
      mesh.position.set(box.center.x, box.center.y, box.center.z);
      mesh.scale.set(box.size.x, box.size.y, box.size.z);
      heightTweensById.delete(box.id);
      return null;
    }

    mesh.scale.x = box.size.x;
    mesh.scale.z = box.size.z;
    mesh.position.x = box.center.x;
    mesh.position.z = box.center.z;

    if (isNewMesh) {
      // Startzustand VOR dem ersten `advanceAnimations`-Tick: Fuß auf
      // Zielposition, Höhe 0 — kein sichtbarer Sprung, weil das Mesh in
      // diesem Frame noch nicht gerendert wurde.
      mesh.scale.y = 0;
      mesh.position.y = targetFoot;
    }

    const fromHeight = isNewMesh ? 0 : mesh.scale.y;
    const currentFoot = isNewMesh ? targetFoot : mesh.position.y - mesh.scale.y / 2;
    const needsTween = fromHeight !== box.size.y || currentFoot !== targetFoot;

    if (!needsTween) {
      heightTweensById.delete(box.id);
      mesh.scale.y = box.size.y;
      // `mesh.position.y` ist die Box-MITTE (BoxGeometry ist ums Zentrum
      // skaliert), NICHT der Fußpunkt — also Fuß + halbe Höhe (= box.center.y).
      // Früher fälschlich `targetFoot`: der Balken sackte dadurch beim erneuten
      // applyLayout (Refetch/Re-Render, gleiche Höhe) um die halbe Höhe unter
      // die Bodenplatte.
      mesh.position.y = targetFoot + box.size.y / 2;
      return null;
    }

    const tween: HeightTween = {
      startMs: null,
      durationMs: BAR_GROWTH_DURATION_MS,
      fromHeight,
      toHeight: box.size.y,
      foot: targetFoot,
      staggerIndex: 0, // wird von `applyLayout` vergeben (Kaskaden-Reihenfolge).
    };
    heightTweensById.set(box.id, tween);
    return tween;
  }

  /**
   * Opazitäts-Anteil von `applyLayout` (WP-C6) — gilt uniform für ALLE Kinds
   * (nicht nur Hüllen): deckt automatisch auch Balken-Opazitätsstufen
   * zwischen Ebenen ab (`city-layout.ts`: 0.35 → 0.6 → 1.0 etc.), ohne
   * separate Kind-Fallunterscheidung. Invariante 2 (KRITISCH): die geteilte
   * `materialRegistry`-Instanz wird NIE für einen Tween mutiert — jede
   * animierte Box bekommt eine EIGENE Klon-Instanz, die am Tween-Ende
   * disposed und durch die geteilte Ziel-Instanz ersetzt wird.
   */
  function applyBoxOpacity(mesh: THREE.Mesh, box: LayoutBox, isNewMesh: boolean): void {
    const targetMaterial = getMaterial(box);
    const pending = opacityTweensById.get(box.id);

    if (!animationsEnabled) {
      if (pending) {
        pending.material.dispose();
        opacityTweensById.delete(box.id);
      }
      mesh.material = targetMaterial;
      return;
    }

    if (isNewMesh) {
      // Neue Box: kein Opazitäts-"Sprung" beobachtbar (existierte vorher
      // nicht) — direkt Zielmaterial, kein Klon/Tween nötig.
      mesh.material = targetMaterial;
      return;
    }

    if (pending && pending.toOpacity === box.opacity) {
      // Bereits ein laufender Tween zu genau diesem Ziel — NICHT neu
      // starten (kein Timer-Reset bei wiederholtem `applyLayout` mit
      // unverändertem Ziel, z. B. React-Re-Render mit äquivalentem Layout).
      return;
    }

    const fromOpacity = materialOpacityOf(mesh.material);

    if (fromOpacity === box.opacity) {
      if (pending) {
        pending.material.dispose();
        opacityTweensById.delete(box.id);
      }
      mesh.material = targetMaterial;
      return;
    }

    // Ziel hat sich geändert (frischer Tween ODER Umlenkung eines laufenden
    // Tweens auf ein neues Ziel) — Klon-Instanz (neu oder wiederverwendet)
    // trägt IMMER `transparent = true`, auch wenn das Endziel `opacity === 1`
    // ist (Bar-Opazitätsstufe `district`-Level): sonst ignoriert three.js die
    // Zwischen-Opazität auf einem `transparent: false`-Material (Invariante-
    // 2-Konsequenz).
    const material = pending ? pending.material : targetMaterial.clone();
    if (!pending) material.opacity = fromOpacity;
    material.transparent = true;

    mesh.material = material;
    opacityTweensById.set(box.id, {
      startMs: null,
      durationMs: OPACITY_FADE_DURATION_MS,
      fromOpacity,
      toOpacity: box.opacity,
      material,
      finalMaterial: targetMaterial,
    });
  }

  function applyLayout(layout: CityLayout): void {
    const seenIds = new Set<string>();
    // WP-E1: Kaskaden-Zähler — vergibt die Startversatz-Position für jeden in
    // DIESEM Batch frisch gestarteten Höhen-Tween (Layout-Reihenfolge).
    let staggerCursor = 0;

    for (const box of layout.boxes) {
      seenIds.add(box.id);

      const isNewMesh = !meshesById.has(box.id);
      let mesh = meshesById.get(box.id);
      if (!mesh) {
        mesh = new THREE.Mesh(sharedBoxGeometry, getMaterial(box));
        mesh.userData.id = box.id;
        scene.add(mesh);
        meshesById.set(box.id, mesh);
      }

      mesh.userData.pickable = box.pickable;
      mesh.userData.kind = box.kind;
      mesh.renderOrder = renderOrderFor(box.kind);

      const startedTween = applyBoxHeight(mesh, box, isNewMesh);
      if (startedTween) {
        startedTween.staggerIndex = staggerCursor;
        staggerCursor += 1;
      }
      applyBoxOpacity(mesh, box, isNewMesh);

      // Degenerierte Nullbox (Distrikt ohne Unterkategorien, city-layout.ts
      // `buildHullBox`-Fallback) hat size 0 in jeder Achse — nicht rendern
      // statt eine unsichtbare, aber pickbare 0x0x0-Box im Raycast zu lassen.
      // Basiert bewusst auf dem ZIEL `box.size`, nicht der ggf. gerade
      // animierten `mesh.scale` (ein wachsender Balken mit `scale.y===0` im
      // ersten Frame bleibt trotzdem sichtbar, sein Ziel ist ja > 0).
      mesh.visible = box.size.x > 0 && box.size.y > 0 && box.size.z > 0;

      // WP-E1: Boden-Textur-Kachelung folgt der aktuellen Bodengröße.
      if (box.kind === 'ground') syncGroundTextureRepeat(box);

      // WP-E1: Kontaktschatten-Ebene (geteilte Geometrie/Material/Textur —
      // hier wird nur positioniert/skalaliert, nichts neu erzeugt außer dem
      // einen Mesh pro Box).
      let contactShadow = contactShadowsById.get(box.id);
      const shadowSpec = contactShadowMaterial ? contactShadowSpecFor(box) : null;
      if (shadowSpec && contactShadowMaterial) {
        if (!contactShadow) {
          contactShadow = new THREE.Mesh(contactShadowGeometry, contactShadowMaterial);
          // PlaneGeometry liegt in der XY-Ebene -> auf den Boden (XZ) drehen;
          // Skalierung wirkt in lokalem Raum: x -> Welt-X, y -> Welt-Z.
          contactShadow.rotation.x = -Math.PI / 2;
          contactShadow.renderOrder = CONTACT_SHADOW_RENDER_ORDER;
          scene.add(contactShadow);
          contactShadowsById.set(box.id, contactShadow);
        }
        contactShadow.position.set(box.center.x, shadowSpec.y, box.center.z);
        contactShadow.scale.set(shadowSpec.width, shadowSpec.depth, 1);
        contactShadow.visible = mesh.visible;
      } else if (contactShadow) {
        scene.remove(contactShadow);
        contactShadowsById.delete(box.id);
      }

      let edgeLine = edgesById.get(box.id);
      if (box.edges) {
        if (!edgeLine) {
          edgeLine = new THREE.LineSegments(sharedEdgesGeometry, getEdgeMaterial(box.color));
          scene.add(edgeLine);
          edgesById.set(box.id, edgeLine);
        } else {
          edgeLine.material = getEdgeMaterial(box.color);
        }
        edgeLine.position.copy(mesh.position);
        edgeLine.scale.copy(mesh.scale);
        edgeLine.visible = mesh.visible;
        edgeLine.renderOrder = renderOrderFor(box.kind);
      } else if (edgeLine) {
        scene.remove(edgeLine);
        edgesById.delete(box.id);
      }
    }

    // Entsorgung: Meshes/Edges, deren id in diesem Layout nicht mehr
    // vorkommt (Ebenenwechsel), aus der Szene entfernen. Materialien/
    // Geometrien bleiben in der Registry (könnten von einer anderen id
    // wiederverwendet werden) — vollständig geräumt wird nur in `dispose()`.
    // Exit-Boxen werden bewusst HART entfernt (kein Fade-out): ein
    // laufender Opazitäts-Tween auf einer gerade entfernten Box würde sonst
    // gegen einen Pick-/Raycast-Konflikt laufen (die Box ist auf der neuen
    // Ebene nicht mehr Teil der Pickability-Matrix) — Priorität liegt laut
    // Auftrag ohnehin auf Wachstum + Hüllen-Fade, nicht auf Exit-Animation.
    for (const [id, mesh] of meshesById) {
      if (seenIds.has(id)) continue;
      // WP-D3: ein Highlight auf einer gerade entsorgten Box aufheben (ihr
      // Klon-Material würde sonst leaken; Restore entfällt, Mesh geht weg).
      if (highlightedId === id) clearHighlight();
      scene.remove(mesh);
      meshesById.delete(id);
      const edgeLine = edgesById.get(id);
      if (edgeLine) {
        scene.remove(edgeLine);
        edgesById.delete(id);
      }
      // WP-E1: Kontaktschatten-Ebene folgt dem Box-Lebenszyklus (geteilte
      // Ressourcen bleiben — geräumt wird nur das eine Mesh).
      const contactShadow = contactShadowsById.get(id);
      if (contactShadow) {
        scene.remove(contactShadow);
        contactShadowsById.delete(id);
      }
      heightTweensById.delete(id);
      const opacityTween = opacityTweensById.get(id);
      if (opacityTween) {
        opacityTween.material.dispose();
        opacityTweensById.delete(id);
      }
    }
  }

  function advanceAnimations(nowMs: number): boolean {
    let stillAnimating = false;

    for (const [id, tween] of heightTweensById) {
      const mesh = meshesById.get(id);
      if (!mesh) {
        heightTweensById.delete(id);
        continue;
      }
      // WP-E1-Kaskade: t=0 des Tweens ist der erste Tick + Staffelversatz.
      // Bis dahin ist `elapsed` negativ -> rawT 0 -> die Box bleibt auf ihrer
      // Starthöhe stehen, `stillAnimating` hält den Loop aber wach.
      if (tween.startMs === null) tween.startMs = nowMs + tween.staggerIndex * BUILD_STAGGER_MS;

      const elapsed = nowMs - tween.startMs;
      const rawT = tween.durationMs <= 0 ? 1 : Math.min(1, Math.max(0, elapsed / tween.durationMs));
      const eased = easeInOutCubic(rawT);
      const height = tween.fromHeight + (tween.toHeight - tween.fromHeight) * eased;
      mesh.scale.y = height;
      mesh.position.y = tween.foot + height / 2;

      if (rawT >= 1) heightTweensById.delete(id);
      else stillAnimating = true;
    }

    for (const [id, tween] of opacityTweensById) {
      const mesh = meshesById.get(id);
      if (!mesh) {
        tween.material.dispose();
        opacityTweensById.delete(id);
        continue;
      }
      if (tween.startMs === null) tween.startMs = nowMs;

      const elapsed = nowMs - tween.startMs;
      const rawT = tween.durationMs <= 0 ? 1 : Math.min(1, Math.max(0, elapsed / tween.durationMs));
      const eased = easeInOutCubic(rawT);
      tween.material.opacity = tween.fromOpacity + (tween.toOpacity - tween.fromOpacity) * eased;

      if (rawT >= 1) {
        // Invariante 2: Klon entsorgen, zurück auf die geteilte Ziel-Instanz
        // — kein dauerhafter Materialduplikat-Ballast nach Tween-Ende.
        mesh.material = tween.finalMaterial;
        tween.material.dispose();
        opacityTweensById.delete(id);
      } else {
        stillAnimating = true;
      }
    }

    // WP-4.3: Light-intensity tween (Atmosphäre-Preset)
    if (lightTween) {
      if (lightTween.startMs === null) lightTween.startMs = nowMs;
      const elapsed = nowMs - lightTween.startMs;
      const rawT = lightTween.durationMs <= 0 ? 1 : Math.min(1, Math.max(0, elapsed / lightTween.durationMs));
      const eased = easeInOutCubic(rawT);
      hemisphereLight.intensity = lightTween.fromHemiIntensity + (lightTween.toHemiIntensity - lightTween.fromHemiIntensity) * eased;
      directionalLight.intensity = lightTween.fromDirIntensity + (lightTween.toDirIntensity - lightTween.fromDirIntensity) * eased;
      if (rawT >= 1) lightTween = null;
      else stillAnimating = true;
    }

    return stillAnimating;
  }

  function setAnimationsEnabled(enabled: boolean): void {
    if (animationsEnabled === enabled) return;
    animationsEnabled = enabled;
    if (enabled) return; // Betrifft nur künftige `applyLayout`-Aufrufe, keine sofortige Wirkung.

    // Deaktivieren (`prefers-reduced-motion` griff zur Laufzeit): laufende
    // Tweens sofort auf ihren Zielwert springen lassen, kein "eingefrorener"
    // Zwischenzustand.
    for (const [id, tween] of heightTweensById) {
      const mesh = meshesById.get(id);
      if (mesh) {
        mesh.scale.y = tween.toHeight;
        mesh.position.y = tween.foot + tween.toHeight / 2;
      }
    }
    heightTweensById.clear();

    for (const [id, tween] of opacityTweensById) {
      const mesh = meshesById.get(id);
      if (mesh) mesh.material = tween.finalMaterial;
      tween.material.dispose();
    }
    opacityTweensById.clear();
  }

  // --- WP-D3: Hover-Highlight ---------------------------------------------
  /** Glüh-Intensität für Lambert-Baukörper (Balken/Etagen) im Hover — WEISS und deutlich über dem farbigen Grund-Eigenleuchten (`SOLID_EMISSIVE_INTENSITY`), damit das Highlight klar absticht. */
  const HIGHLIGHT_EMISSIVE_INTENSITY = 0.5;
  /** Opazitäts-Schub für transparente Hüllen im Hover (geclamped auf 1). */
  const HIGHLIGHT_OPACITY_BOOST = 0.15;

  let highlightedId: string | null = null;
  /** Material der Box VOR dem Highlight — wird bei Aufhebung wieder eingesetzt. */
  let highlightRestoreMaterial: THREE.Material | null = null;
  /** Eigene Klon-Instanz für die Highlight-Dauer (nie die Registry-Instanz mutieren). */
  let highlightMaterial: THREE.Material | null = null;

  function clearHighlight(): void {
    if (highlightedId) {
      const mesh = meshesById.get(highlightedId);
      // Nur zurücksetzen, wenn das Highlight-Material noch aktiv ist — ein
      // zwischenzeitliches applyLayout/Opazitäts-Tween darf nicht überschrieben
      // werden (das Highlight ist dann ohnehin schon visuell weg).
      if (mesh && highlightRestoreMaterial && mesh.material === highlightMaterial) {
        mesh.material = highlightRestoreMaterial;
      }
      highlightMaterial?.dispose();
    }
    highlightedId = null;
    highlightRestoreMaterial = null;
    highlightMaterial = null;
  }

  function setHighlight(id: string | null): void {
    if (id === highlightedId) return;
    clearHighlight();
    if (id === null) return;

    const mesh = meshesById.get(id);
    if (!mesh) return; // Unbekannte/gerade entsorgte id: stilles No-op.

    const base = mesh.material as THREE.Material;
    const clone = base.clone();
    if (clone instanceof THREE.MeshLambertMaterial) {
      clone.emissive = new THREE.Color(0xffffff);
      clone.emissiveIntensity = HIGHLIGHT_EMISSIVE_INTENSITY;
    } else {
      clone.transparent = true;
      clone.opacity = Math.min(1, clone.opacity + HIGHLIGHT_OPACITY_BOOST);
    }

    highlightedId = id;
    highlightRestoreMaterial = base;
    highlightMaterial = clone;
    mesh.material = clone;
  }

  function pick(clientX: number, clientY: number): string | null {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -(((clientY - rect.top) / rect.height) * 2 - 1));
    raycaster.setFromCamera(ndc, camera);

    const pickableMeshes: THREE.Mesh[] = [];
    for (const mesh of meshesById.values()) {
      if (mesh.visible && mesh.userData.pickable) pickableMeshes.push(mesh);
    }
    if (pickableMeshes.length === 0) return null;

    const hits = raycaster.intersectObjects(pickableMeshes, false);
    if (hits.length === 0) return null;

    const id = hits[0].object.userData.id;
    return typeof id === 'string' ? id : null;
  }

  function setSize(width: number, height: number, dpr: number): void {
    if (width <= 0 || height <= 0) return; // ResizeObserver kann während Layout-Übergängen kurzzeitig 0 liefern.
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false); // false: kein CSS-Style-Override — der Container steuert die Canvas-Größe.
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  /** Zuletzt gesetzte Fog-Grenzen — für die Neu-Einfärbung bei Theme-Wechsel (`setTheme`) gemerkt. `null` = Fog aus. */
  let fogRange: { near: number; far: number } | null = null;

  function setFog(near: number, far: number): void {
    // WP-C4 konfiguriert Fog passend zur jeweiligen Ebene. Nicht-endliche
    // Werte (NaN/Infinity) schalten Fog aus — no-op-fähig, wie gefordert.
    if (!Number.isFinite(near) || !Number.isFinite(far)) {
      fogRange = null;
      scene.fog = null;
      return;
    }
    fogRange = { near, far };
    // WP-E1: Fog-Farbe = Horizontton — der Stadtrand löst sich im Himmel auf.
    scene.fog = new THREE.Fog(horizonColor, near, far);
  }

  function setTheme(next: CityTheme): void {
    if (next === theme) return;
    theme = next;
    palette = THEME_PALETTES[theme];
    horizonColor = palette.skyHorizon;

    // WP-E1: Himmel-Textur tauschen (Referenz auf die vorgebaute Textur des
    // Themes — kein Neuaufbau, kein Registry-Rebuild).
    scene.background = skyTextures[theme] ?? new THREE.Color(horizonColor);
    // WP-E1: Boden-Textur ist theme-spezifisch — gezielt NUR die map-Referenz
    // der Boden-Materialien tauschen (Textur-Art steht im Registry-Schlüssel).
    const groundTexture = groundTextures[theme];
    for (const [key, material] of materialRegistry) {
      if (!key.endsWith('|ground')) continue;
      (material as THREE.MeshLambertMaterial).map = groundTexture;
      material.needsUpdate = true;
    }
    hemisphereLight.color.set(palette.hemiSky);
    hemisphereLight.groundColor.set(palette.hemiGround);
    hemisphereLight.intensity = palette.hemiIntensity;
    directionalLight.color.set(palette.dirColor);
    directionalLight.intensity = palette.dirIntensity;
    // Fog trägt den Horizontton — bei Theme-Wechsel mit denselben Grenzen neu setzen.
    if (fogRange) scene.fog = new THREE.Fog(horizonColor, fogRange.near, fogRange.far);
  }

  // --- WP-4.3: Atmosphäre-Preset (subtile Lichtmodulation) ----------------
  /** Lichtintensitäts-Multiplikatoren je Preset — ≤ 5% Abweichung vom Default. */
  const ATMOSPHERE_LIGHT_MULTIPLIER: Record<'stable' | 'neutral' | 'risk', number> = {
    stable: 1.03,
    neutral: 1.0,
    risk: 0.97,
  };

  let currentPreset: 'stable' | 'neutral' | 'risk' = 'neutral';

  /** Light-intensity tween (WP-4.3). */
  type LightTween = {
    startMs: number | null;
    durationMs: number;
    fromHemiIntensity: number;
    toHemiIntensity: number;
    fromDirIntensity: number;
    toDirIntensity: number;
  };
  let lightTween: LightTween | null = null;

  function atmosphereTargetIntensities(preset: 'stable' | 'neutral' | 'risk') {
    const mult = ATMOSPHERE_LIGHT_MULTIPLIER[preset];
    return {
      hemi: palette.hemiIntensity * mult,
      dir: palette.dirIntensity * mult,
    };
  }

  function setAtmospherePreset(preset: 'stable' | 'neutral' | 'risk'): void {
    if (preset === currentPreset && lightTween === null) return;

    const targets = atmosphereTargetIntensities(preset);
    const currentHemi = hemisphereLight.intensity;
    const currentDir = directionalLight.intensity;

    // Bei deaktivierten Animationen: sofort anwenden (reduced-motion).
    if (!animationsEnabled) {
      hemisphereLight.intensity = targets.hemi;
      directionalLight.intensity = targets.dir;
      currentPreset = preset;
      lightTween = null;
      return;
    }

    // Animation starten
    lightTween = {
      startMs: null,
      durationMs: MOTION_DURATIONS.slow,
      fromHemiIntensity: currentHemi,
      toHemiIntensity: targets.hemi,
      fromDirIntensity: currentDir,
      toDirIntensity: targets.dir,
    };
    currentPreset = preset;
  }

  function render(): void {
    renderer.render(scene, camera);
  }

  function applyCameraPose(pose: CityCameraPose): void {
    camera.position.set(pose.position.x, pose.position.y, pose.position.z);
    target.set(pose.target.x, pose.target.y, pose.target.z);
    camera.lookAt(target);
  }

  function dispose(): void {
    // WP-D3: Highlight-Klon gehört (wie die Tween-Klone) NICHT der Registry —
    // ohne diesen Schritt würde er im Registry-Loop unten übersehen/geleakt.
    clearHighlight();
    for (const mesh of meshesById.values()) scene.remove(mesh);
    meshesById.clear();
    for (const edgeLine of edgesById.values()) scene.remove(edgeLine);
    edgesById.clear();

    // WP-C6: laufende Tween-Klon-Materialien gehören NICHT der `materialRegistry`
    // (Invariante 2) — ohne diesen Schritt würden sie beim regulären
    // `materialRegistry`-Loop unten übersehen und geleakt.
    for (const tween of opacityTweensById.values()) tween.material.dispose();
    opacityTweensById.clear();
    heightTweensById.clear();

    sharedBoxGeometry.dispose();
    sharedEdgesGeometry.dispose();

    // WP-E1: Kontaktschatten-Ebenen + deren geteilte Ressourcen.
    for (const contactShadow of contactShadowsById.values()) scene.remove(contactShadow);
    contactShadowsById.clear();
    contactShadowGeometry.dispose();
    contactShadowMaterial?.dispose();

    // WP-E1: prozedurale Texturen (Himmel/Boden je Theme + Fassade/Schatten).
    contactShadowTexture?.dispose();
    facadeTexture?.dispose();
    for (const texture of [skyTextures.light, skyTextures.dark, groundTextures.light, groundTextures.dark]) {
      texture?.dispose();
    }

    for (const material of materialRegistry.values()) material.dispose();
    materialRegistry.clear();
    for (const material of edgeMaterialRegistry.values()) material.dispose();
    edgeMaterialRegistry.clear();

    renderer.dispose();
  }

  return {
    applyLayout,
    advanceAnimations,
    setAnimationsEnabled,
    pick,
    setHighlight,
    setSize,
    setFog,
    setTheme,
    setAtmospherePreset,
    render,
    dispose,
    applyCameraPose,
    target,
    camera,
    domElement: canvas,
  };
}
