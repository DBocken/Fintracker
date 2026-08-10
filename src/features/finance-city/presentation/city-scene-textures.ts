/**
 * Prozedurale Canvas-Texturen der Stadt (WP-E1/WP-5.4, herausgelöst aus
 * `city-scene.ts` in WP 6.4 — Teilschritt „Aufbau").
 *
 * Alle ≤ 256 px, EINMAL bei Szenen-Erstellung erzeugt und gecacht, keine
 * Render-Passes. jsdom-Sicherheit: ohne 2D-Canvas-Kontext liefern die Fabriken
 * `null` und die Szene fällt still auf un-texturierte Materialien/Farben
 * zurück — gleiche Degradation wie der WebGL-Fallback in `CityCanvas.tsx`.
 */

import * as THREE from 'three';
import type { CityActivityLevel } from '../domain/city-activity';
import type { CityQualitySettings } from '../domain/city-quality';
import { THEME_PALETTES, type CityTheme, type ThemePalette } from './city-scene-theme';

/** 2D-Canvas + Kontext, oder `null` wo kein 2D-Kontext existiert (jsdom). */
function createCanvas2d(
  width: number,
  height: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
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
export const GROUND_TILE_WORLD_SIZE = 3;

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
/**
 * WP-5.4: Fenster-Dichte und -Deutlichkeit je Aktivitätsstufe.
 * `fillEvery: 1` = jede Zelle trägt ein Fenster (das bisherige Verhalten),
 * höhere Werte lassen entsprechend Zellen aus. `steady` ist bewusst identisch
 * zum Zustand vor WP-5.4 — die mittlere Stufe ist der Bezugspunkt, nach oben
 * und unten wird abgewichen.
 */
const FACADE_WINDOW_ACTIVITY: Record<CityActivityLevel, { alpha: number; fillEvery: number }> = {
  quiet: { alpha: FACADE_WINDOW_ALPHA * 0.6, fillEvery: 3 },
  steady: { alpha: FACADE_WINDOW_ALPHA, fillEvery: 1 },
  busy: { alpha: FACADE_WINDOW_ALPHA * 1.8, fillEvery: 1 },
};

function createFacadeTexture(activity: CityActivityLevel = 'steady'): THREE.CanvasTexture | null {
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

  // WP-5.4: Das Fenster-Raster ist datengetrieben statt dekorativ. Ein
  // belebtes Gebäude (viele Buchungen pro Monat) bekommt mehr und deutlichere
  // Fenster als eines mit einer einzigen Zahlung im Jahr — der Kanal zeigt
  // damit, was die HÖHE nicht kann: ob ein Betrag aus EINER großen Zahlung
  // besteht oder aus vielen kleinen.
  //
  // Der Rasterdurchmesser bleibt derselbe; variiert wird, WIE VIELE Zellen ein
  // Fenster tragen (deterministisch nach einem festen Muster, nicht zufällig —
  // sonst flackerte die Fassade bei jedem Texturaufbau) und wie deutlich sie
  // sind. So bleibt es EINE Textur je Stufe statt einer je Gebäude.
  const { alpha, fillEvery } = FACADE_WINDOW_ACTIVITY[activity];
  const cellW = FACADE_TEXTURE_SIZE / FACADE_WINDOW_COLS;
  const cellH = FACADE_TEXTURE_SIZE / FACADE_WINDOW_ROWS;
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  for (let row = 0; row < FACADE_WINDOW_ROWS; row += 1) {
    for (let col = 0; col < FACADE_WINDOW_COLS; col += 1) {
      if ((row * FACADE_WINDOW_COLS + col) % fillEvery !== 0) continue;
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

export type CityTextures = {
  sky: Record<CityTheme, THREE.CanvasTexture | null>;
  /** Theme-spezifisch — `setTheme` tauscht gezielt NUR die `map` der Boden-Materialien. */
  ground: Record<CityTheme, THREE.CanvasTexture | null>;
  /** WP-5.4: EINE Textur je Aktivitätsstufe (drei), nicht eine je Gebäude — theme-tolerant (Graustufen-Albedo). */
  facade: Record<CityActivityLevel, THREE.CanvasTexture | null>;
  /** Theme-tolerant (Alpha-Matte), kein Swap bei Theme-Wechsel nötig. */
  contactShadow: THREE.CanvasTexture | null;
  /** Straßen-Dichte gleich auf jeder Ebene: Repeat folgt der aktuellen Bodengröße. Beide Theme-Texturen bleiben synchron. */
  syncGroundRepeat(sizeX: number, sizeZ: number): void;
  dispose(): void;
};

/**
 * Baut den vollständigen Texturvorrat einer Szene. Auf sparsamen
 * Qualitätsstufen werden Fassade und Kontaktschatten gar nicht erst erzeugt —
 * `null` ist hier bereits der etablierte Weg (jsdom ohne 2D-Kontext), der Rest
 * der Szene degradiert still darauf. Kein zweiter Sonderfall nötig.
 */
export function createCityTextures(quality: CityQualitySettings): CityTextures {
  const sky: Record<CityTheme, THREE.CanvasTexture | null> = {
    dark: createSkyGradientTexture(THEME_PALETTES.dark),
    light: createSkyGradientTexture(THEME_PALETTES.light),
  };
  const ground: Record<CityTheme, THREE.CanvasTexture | null> = {
    dark: createGroundTexture('dark'),
    light: createGroundTexture('light'),
  };
  const facade: Record<CityActivityLevel, THREE.CanvasTexture | null> = quality.facadeTexture
    ? { quiet: createFacadeTexture('quiet'), steady: createFacadeTexture('steady'), busy: createFacadeTexture('busy') }
    : { quiet: null, steady: null, busy: null };
  const contactShadow = quality.contactShadows ? createContactShadowTexture() : null;

  return {
    sky,
    ground,
    facade,
    contactShadow,
    syncGroundRepeat(sizeX, sizeZ) {
      const repeatX = Math.max(1, Math.round(sizeX / GROUND_TILE_WORLD_SIZE));
      const repeatY = Math.max(1, Math.round(sizeZ / GROUND_TILE_WORLD_SIZE));
      for (const texture of [ground.light, ground.dark]) texture?.repeat.set(repeatX, repeatY);
    },
    dispose() {
      contactShadow?.dispose();
      for (const texture of Object.values(facade)) texture?.dispose();
      for (const texture of [sky.light, sky.dark, ground.light, ground.dark]) texture?.dispose();
    },
  };
}
