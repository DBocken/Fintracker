/**
 * Szenen-Geometrie der 3D-Finanzstadt (WP-C1) — die EINZIGE Quelle der
 * Layout-Wahrheit. `presentation/` (WP-C3) liest ausschließlich `LayoutBox[]`
 * aus `buildCityLayout` und baut daraus three.js-Meshes; keine Geometrie-
 * Entscheidung darf dort neu getroffen werden (README-Architekturtabelle).
 *
 * Reine Funktionen, kein React/three.js/Browser-Bezug.
 */

import type { CityDistrict, CityModel, CitySubcategory, Vec3 } from './city-model';
import { scaleHeight, scaleFloors } from './city-scaling';

export type CityLevel = 'city' | 'district' | 'subcategory';
export type LayoutBoxKind = 'plot' | 'hull' | 'bar' | 'floor' | 'ground';

export type LayoutBox = {
  /** Stabil: `districtId` (Hülle) | `districtId/subId` (Balken) | `districtId/subId/contractId` (Etage). Nicht-pickable Hilfsboxen (plot/ground) hängen einen `:kind`-Suffix an. */
  id: string;
  kind: LayoutBoxKind;
  /** Mittelpunkt der Box (y = Boden(0) + Höhe/2 — Fußpunkt auf dem Grundstück). */
  center: Vec3;
  size: Vec3;
  color: string;
  opacity: number;
  /** Dezente Kanten nur für Hüllen. */
  edges: boolean;
  /** Raycast-Ziel: Hüllen in city-Level, Balken in district-Level, Etagen in subcategory-Level. */
  pickable: boolean;
  /** Oberkante der Box, für HTML-Label-Projektion (README: Labels sind DOM-Overlays, keine 3D-Sprites). */
  labelAnchor?: Vec3;
};

export type CityLayout = { boxes: LayoutBox[]; center: Vec3; boundingRadius: number };

export type CityView = { level: CityLevel; focusDistrictId?: string; focusSubcategoryId?: string };

// ---------------------------------------------------------------------------
// Konstanten (alle Werte sind bewusste, dokumentierte Design-Entscheidungen
// dieses WP — Spec gibt Verfahren vor, nicht immer exakte Zahlen).
// ---------------------------------------------------------------------------

/** "Bodenhöhe" (Fußpunkt-Referenz): alle Gebäude stehen mit ihrer Unterkante hier. */
const GROUND_LEVEL = 0;

/** Grundstücksgröße w=d = Basis + k * Anzahl Unterkategorien. */
const PLOT_BASE_SIZE = 2;
const PLOT_SIZE_PER_SUBCATEGORY = 1.2;
/** Abstand vom Grundstücksrand zum inneren Balken-Mini-Grid. */
const PLOT_INNER_MARGIN = 0.6;
/** Fester Gap zwischen den 4 Vierteln im 2x2-Makro-Grid. */
const DISTRICT_GRID_GAP = 3;

/** Balken-Footprint (w=d) und Gap im Mini-Grid innerhalb eines Grundstücks. */
const BAR_FOOTPRINT = 0.9;
const BAR_GRID_GAP = 0.5;
/** Referenzhöhe für den höchsten Balken der ganzen Stadt (scaleHeight-maxHeight). */
const MAX_BAR_HEIGHT = 6;

/** Marge zwischen äußerstem Balken und Hüllen-Wand (x/z). */
const HULL_MARGIN = 0.8;
/**
 * Kopffreiheit der Hülle ÜBER dem höchsten Balken ihres Viertels — als ANTEIL
 * der Balkenhöhe, NICHT als fester additiver Abstand. Nutzer-Befund: der innere
 * Balken wirkte beim Reinzoomen (Fokus) viel kleiner als in der Stadtübersicht.
 * Ursache war die früher FESTE Kopffreiheit (+0.6): für den Stadt-Höchstbalken
 * (6.0) sind das nur 9 %, für ein kleines Gebäude (Balken 0.6) aber 50 % — die
 * Hülle stand dann halb leer über dem Balken, und die nahe Fokus-Vogelperspektive
 * blies diese leere Kopfzone zusätzlich auf. Ein proportionaler Anteil gibt JEDEM
 * Gebäude denselben Füllgrad (Balken/Hülle konstant über alle Gebäudegrößen und
 * Zoom-Ebenen). Bewusst 10 %, damit die Hülle des Stadt-Höchstbalken-Viertels
 * exakt gleich bleibt (6.0 * 1.1 = 6.6 = altes 6.0 + 0.6) — der Fix betrifft nur
 * kleinere Gebäude. `computeFocusBounds` rahmt weiterhin nur die soliden Balken,
 * die Kamera bleibt also unberührt.
 */
const HULL_HEIGHT_HEADROOM_RATIO = 0.1;

const PLOT_THICKNESS = 0.05;
const GROUND_THICKNESS = 0.1;
const GROUND_MARGIN = 2;
/** Neutrale Bodenfarbe (Domain kennt keine Theming-Palette, bewusst ein fester Ton). */
const GROUND_COLOR = '#94a3b8';

// ---------------------------------------------------------------------------
// Etagen-Shading (WP-C8): reine Hex->HSL->Hex-Arithmetik (kein three.js
// `Color`, `domain/` bleibt three.js-frei, README-Architekturtabelle) — jede
// Etage bekommt eine leicht andere Helligkeit ihrer Distrikt-Basisfarbe, damit
// benachbarte Etagen (Stapelreihenfolge aus `scaleFloors`) optisch
// unterscheidbar bleiben, ohne die Distrikt-Farbidentität zu verlieren.
// ---------------------------------------------------------------------------

/** Lightness-Delta (Prozentpunkte) je Etagen-Index-"Stufe" — klein/dezent gehalten. */
const FLOOR_SHADE_STEP_PERCENT = 6;
/** Deckelt die Gesamt-Abweichung von der Basisfarbe, damit hohe Etagenzahlen nicht fast schwarz/weiß werden. */
const FLOOR_SHADE_MAX_DELTA_PERCENT = 18;

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const int = parseInt(match[1], 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: h / 6, s, l };
}

function hue2rgb(p: number, q: number, t: number): number {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  };
}

function toHexByte(n: number): string {
  return Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
}

/**
 * Passt die Helligkeit (Lightness) einer 6-stelligen Hex-Farbe um
 * `deltaPercent` Prozentpunkte an (positiv = heller, negativ = dunkler),
 * geclamped auf [0, 100]. Ungültige Hex-Eingaben geben die Eingabe
 * unverändert zurück — dezente Degradation statt Absturz (Farbe ist Pflicht,
 * siehe `LayoutBox.color`).
 */
export function adjustHexLightness(hex: string, deltaPercent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const nextL = Math.max(0, Math.min(1, l + deltaPercent / 100));
  const { r, g, b } = hslToRgb(h, s, nextL);
  return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
}

/**
 * Lightness-Delta je Etagen-Index: Vorzeichen alterniert (jede Etage
 * unterscheidet sich dadurch IMMER von ihrer direkten Nachbarin, auch bei
 * gedeckelter Magnitude), die Magnitude wächst alle 2 Etagen um eine Stufe
 * und wird bei `FLOOR_SHADE_MAX_DELTA_PERCENT` gedeckelt. Rein indexbasiert
 * -> deterministisch bei identischer Eingabe.
 */
function floorShadeDelta(index: number): number {
  const sign = index % 2 === 0 ? 1 : -1;
  const magnitude = Math.min(FLOOR_SHADE_MAX_DELTA_PERCENT, FLOOR_SHADE_STEP_PERCENT * (Math.floor(index / 2) + 1));
  return sign * magnitude;
}

// Opazitäten je Ebene/Fokus-Stufe (Spec-Vorgabe: "Stadt = Hülle ~0.12 + Balken
// ~0.35; Fokus: +Stufe; district-Level: Hülle ~0.04, Balken 1.0; floors voll").
const HULL_OPACITY_CITY = 0.12;
const HULL_OPACITY_CITY_FOCUSED = 0.35; // "+Stufe": eine Stufe höher als die City-Baseline.
const BAR_OPACITY_CITY = 0.35;
const BAR_OPACITY_CITY_FOCUSED = 0.6; // "+Stufe" analog zur Hülle.
const HULL_OPACITY_DISTRICT = 0.04;
const BAR_OPACITY_DISTRICT = 1.0;
/** Andere Balken im selben Viertel, während einer in Etagen aufgelöst ist. */
const BAR_OPACITY_DIMMED_SUBCATEGORY = 0.35;
const FLOOR_OPACITY = 1.0;
/** Eigene Ergänzung (Spec nennt keinen Wert für "plot"): dezente Boden-Einfärbung je Distrikt. */
const PLOT_OPACITY = 0.08;
const GROUND_OPACITY = 1.0;

type PositionedBar = {
  subcategory: CitySubcategory;
  center: Vec3;
  height: number;
  /** Tatsächlicher Footprint (w=d) dieses Balkens — meist `BAR_FOOTPRINT`, nur bei sehr vielen Unterkategorien pro Grundstück (`PLOT_INNER_MARGIN`-Sicherheitsnetz) kleiner skaliert. */
  footprint: number;
};

type DistrictGeometry = { plotCenter: { x: number; z: number }; plotSize: number };

/** Grundstücksgröße: Basis + k * Anzahl Unterkategorien (deterministisch). */
function computePlotSize(district: CityDistrict): number {
  return PLOT_BASE_SIZE + PLOT_SIZE_PER_SUBCATEGORY * district.subcategories.length;
}

/**
 * Positioniert alle Distrikt-Grundstücke auf einem deterministischen
 * 2x2(-artigen)-Makro-Grid mit festem Gap. Generalisiert auf
 * `ceil(sqrt(n))` Spalten, damit die Funktion auch bei != 4 Distrikten nicht
 * bricht — für die Spec-Daten (4 Distrikte) ergibt das exakt 2x2.
 */
function computeDistrictGrid(districts: CityDistrict[]): Map<string, DistrictGeometry> {
  const geometry = new Map<string, DistrictGeometry>();
  if (districts.length === 0) return geometry;

  const columns = Math.max(1, Math.ceil(Math.sqrt(districts.length)));
  const plotSizes = districts.map((d) => computePlotSize(d));

  const rows: { districtIndices: number[]; depth: number }[] = [];
  for (let i = 0; i < districts.length; i += columns) {
    const indices = districts.slice(i, i + columns).map((_, j) => i + j);
    const depth = Math.max(...indices.map((idx) => plotSizes[idx]));
    rows.push({ districtIndices: indices, depth });
  }

  const totalGridDepth = rows.reduce((sum, r) => sum + r.depth, 0) + DISTRICT_GRID_GAP * (rows.length - 1);

  let zCursor = 0;
  for (const row of rows) {
    const rowZCenter = zCursor + row.depth / 2 - totalGridDepth / 2;
    const rowWidth =
      row.districtIndices.reduce((sum, idx) => sum + plotSizes[idx], 0) +
      DISTRICT_GRID_GAP * (row.districtIndices.length - 1);

    let xCursor = -rowWidth / 2;
    for (const idx of row.districtIndices) {
      const size = plotSizes[idx];
      const centerX = xCursor + size / 2;
      geometry.set(districts[idx].id, { plotCenter: { x: centerX, z: rowZCenter }, plotSize: size });
      xCursor += size + DISTRICT_GRID_GAP;
    }

    zCursor += row.depth + DISTRICT_GRID_GAP;
  }

  return geometry;
}

/**
 * Positioniert die Balken einer Unterkategorien-Liste in einem
 * deterministischen Mini-Grid innerhalb eines Grundstücks — größter Betrag
 * vorn-links (kleinster Index = Zeile 0/Spalte 0 = -x/-z-Ecke).
 * Höhen nutzen `maxAmount` der GANZEN Stadt (Vergleichbarkeit über Viertel
 * hinweg), nicht nur dieses Distrikts.
 */
function buildBarsForDistrict(
  district: CityDistrict,
  geometry: DistrictGeometry,
  cityWideMaxAmount: number,
): PositionedBar[] {
  const sorted = [...district.subcategories].sort((a, b) => b.amount - a.amount);
  const n = sorted.length;
  if (n === 0) return [];

  const columns = Math.max(1, Math.ceil(Math.sqrt(n)));
  const rows = Math.ceil(n / columns);

  // Sicherheitsnetz: das Grundstück wächst zwar mit n (`computePlotSize`),
  // aber bei sehr vielen Unterkategorien pro Distrikt könnte das Mini-Grid
  // (bei fixem BAR_FOOTPRINT/BAR_GRID_GAP) trotzdem über den inneren
  // Rasterbereich (Grundstücksgröße minus `PLOT_INNER_MARGIN` je Seite)
  // hinausragen. In diesem Fall werden Footprint und Gap gleichmäßig
  // gestaucht, bis das Grid wieder hineinpasst — im Normalfall (Spec-Daten,
  // <= 6 Unterkategorien je Distrikt) bleibt `scale === 1`.
  const gridWidthAtFullSize = columns * BAR_FOOTPRINT + (columns - 1) * BAR_GRID_GAP;
  const gridDepthAtFullSize = rows * BAR_FOOTPRINT + (rows - 1) * BAR_GRID_GAP;
  const maxInnerSize = Math.max(0, geometry.plotSize - 2 * PLOT_INNER_MARGIN);
  const largestGridDimension = Math.max(gridWidthAtFullSize, gridDepthAtFullSize);
  const scale =
    maxInnerSize > 0 && largestGridDimension > maxInnerSize ? maxInnerSize / largestGridDimension : 1;

  const footprint = BAR_FOOTPRINT * scale;
  const gap = BAR_GRID_GAP * scale;
  const pitch = footprint + gap;
  const gridWidth = columns * footprint + (columns - 1) * gap;
  const gridDepth = rows * footprint + (rows - 1) * gap;

  return sorted.map((subcategory, i) => {
    const row = Math.floor(i / columns);
    const col = i % columns;
    const localX = -gridWidth / 2 + col * pitch + footprint / 2;
    const localZ = -gridDepth / 2 + row * pitch + footprint / 2;

    const height = scaleHeight(subcategory.amount, cityWideMaxAmount, MAX_BAR_HEIGHT);

    return {
      subcategory,
      center: {
        x: geometry.plotCenter.x + localX,
        y: GROUND_LEVEL + height / 2,
        z: geometry.plotCenter.z + localZ,
      },
      height,
      footprint,
    };
  });
}

function buildPlotBox(district: CityDistrict, geometry: DistrictGeometry, opacity: number): LayoutBox {
  const size: Vec3 = { x: geometry.plotSize, y: PLOT_THICKNESS, z: geometry.plotSize };
  const center: Vec3 = { x: geometry.plotCenter.x, y: GROUND_LEVEL + PLOT_THICKNESS / 2, z: geometry.plotCenter.z };
  return {
    id: `${district.id}:plot`,
    kind: 'plot',
    center,
    size,
    color: district.color,
    opacity,
    edges: false,
    pickable: false,
  };
}

function buildHullBox(district: CityDistrict, bars: PositionedBar[], opacity: number): LayoutBox {
  if (bars.length === 0) {
    // Degenerierter Fall (Distrikt ohne Unterkategorien): flache Nullbox am Grundstückszentrum.
    return {
      id: district.id,
      kind: 'hull',
      center: { x: 0, y: GROUND_LEVEL, z: 0 },
      size: { x: 0, y: 0, z: 0 },
      color: district.color,
      opacity,
      edges: true,
      pickable: false,
      labelAnchor: { x: 0, y: GROUND_LEVEL, z: 0 },
    };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let maxHeight = 0;

  for (const bar of bars) {
    minX = Math.min(minX, bar.center.x - bar.footprint / 2);
    maxX = Math.max(maxX, bar.center.x + bar.footprint / 2);
    minZ = Math.min(minZ, bar.center.z - bar.footprint / 2);
    maxZ = Math.max(maxZ, bar.center.z + bar.footprint / 2);
    maxHeight = Math.max(maxHeight, bar.height);
  }

  const sizeX = maxX - minX + 2 * HULL_MARGIN;
  const sizeZ = maxZ - minZ + 2 * HULL_MARGIN;
  const sizeY = maxHeight * (1 + HULL_HEIGHT_HEADROOM_RATIO);
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const centerY = GROUND_LEVEL + sizeY / 2;

  return {
    id: district.id,
    kind: 'hull',
    center: { x: centerX, y: centerY, z: centerZ },
    size: { x: sizeX, y: sizeY, z: sizeZ },
    color: district.color,
    opacity,
    edges: true,
    pickable: false, // wird vom Aufrufer für city-Level überschrieben.
    labelAnchor: { x: centerX, y: GROUND_LEVEL + sizeY, z: centerZ },
  };
}

function buildBarBox(
  district: CityDistrict,
  bar: PositionedBar,
  opacity: number,
  pickable: boolean,
): LayoutBox {
  const size: Vec3 = { x: bar.footprint, y: bar.height, z: bar.footprint };
  return {
    id: `${district.id}/${bar.subcategory.id}`,
    kind: 'bar',
    center: bar.center,
    size,
    color: district.color,
    opacity,
    edges: false,
    pickable,
    labelAnchor: { x: bar.center.x, y: bar.center.y + size.y / 2, z: bar.center.z },
  };
}

function buildFloorBoxes(district: CityDistrict, bar: PositionedBar): LayoutBox[] {
  const subcategory = bar.subcategory;
  if (!subcategory.contracts || subcategory.contracts.length === 0) return [];

  const floors = scaleFloors(subcategory.contracts, bar.height);
  return floors.map((floor, index) => {
    const size: Vec3 = { x: bar.footprint, y: floor.height, z: bar.footprint };
    const center: Vec3 = { x: bar.center.x, y: GROUND_LEVEL + floor.y, z: bar.center.z };
    return {
      id: `${district.id}/${subcategory.id}/${floor.id}`,
      kind: 'floor',
      center,
      size,
      // Etagen-Shading (WP-C8): dezente Helligkeitsvariation der Distrikt-
      // Basisfarbe je Etagen-Index, damit gestapelte Etagen visuell
      // gegeneinander abgegrenzt bleiben (`adjustHexLightness`/`floorShadeDelta` oben).
      color: adjustHexLightness(district.color, floorShadeDelta(index)),
      opacity: FLOOR_OPACITY,
      edges: false,
      pickable: true,
      labelAnchor: { x: center.x, y: center.y + size.y / 2, z: center.z },
    };
  });
}

function buildGroundBox(plotBoxes: LayoutBox[]): LayoutBox | null {
  if (plotBoxes.length === 0) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const plot of plotBoxes) {
    minX = Math.min(minX, plot.center.x - plot.size.x / 2);
    maxX = Math.max(maxX, plot.center.x + plot.size.x / 2);
    minZ = Math.min(minZ, plot.center.z - plot.size.z / 2);
    maxZ = Math.max(maxZ, plot.center.z + plot.size.z / 2);
  }

  const sizeX = maxX - minX + 2 * GROUND_MARGIN;
  const sizeZ = maxZ - minZ + 2 * GROUND_MARGIN;
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;

  return {
    id: 'ground',
    kind: 'ground',
    center: { x: centerX, y: GROUND_LEVEL - GROUND_THICKNESS / 2, z: centerZ },
    size: { x: sizeX, y: GROUND_THICKNESS, z: sizeZ },
    color: GROUND_COLOR,
    opacity: GROUND_OPACITY,
    edges: false,
    pickable: false,
  };
}

function computeCityWideMaxSubcategoryAmount(model: CityModel): number {
  let max = 0;
  for (const district of model.districts) {
    for (const subcategory of district.subcategories) {
      if (subcategory.amount > max) max = subcategory.amount;
    }
  }
  return max;
}

export function computeBounds(boxes: LayoutBox[]): { center: Vec3; boundingRadius: number } {
  if (boxes.length === 0) return { center: { x: 0, y: 0, z: 0 }, boundingRadius: 0 };

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const box of boxes) {
    minX = Math.min(minX, box.center.x - box.size.x / 2);
    maxX = Math.max(maxX, box.center.x + box.size.x / 2);
    minY = Math.min(minY, box.center.y - box.size.y / 2);
    maxY = Math.max(maxY, box.center.y + box.size.y / 2);
    minZ = Math.min(minZ, box.center.z - box.size.z / 2);
    maxZ = Math.max(maxZ, box.center.z + box.size.z / 2);
  }

  const center: Vec3 = { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2 };
  const boundingRadius = Math.sqrt(
    ((maxX - minX) / 2) ** 2 + ((maxY - minY) / 2) ** 2 + ((maxZ - minZ) / 2) ** 2,
  );

  return { center, boundingRadius };
}

/**
 * WP-C4: Bounding-Sphere (Center + Radius) aller Boxen eines Fokus-Ziels
 * innerhalb eines bereits gebauten Layouts — für den Kamera-Controller
 * (`presentation/city-camera-controller.ts`), der beim Fokuswechsel/
 * Eintauchen (Kamera-Regeln „focus-district"/„enter-district"/„enter-
 * subcategory") eine passende Fokus-Distanz braucht (`fitCameraDistance`).
 *
 * Matcht per exakter id-Gleichheit ODER `id` beginnt mit `${focusId}/`
 * (city-layout.ts-Id-Konvention oben): deckt sowohl "Distrikt-Hülle + ihre
 * Balken" (`focusId` = Distrikt-Id) als auch "Unterkategorie-Balken bzw.
 * dessen Etagen, falls bereits aufgelöst" (`focusId` =
 * `${districtId}/${subcategoryId}`) ab, OHNE die Layout-Ebene zu kennen.
 *
 * Gerahmt werden die SICHTBAREN Baukörper (`bar`/`floor`) — NICHT die Hülle
 * (`hull`) und nicht `plot`/`ground` (reine Hilfsgeometrie). Grund
 * (Nutzer-Befund): Die Distrikt-Hülle ist so breit wie das ganze Grundstück,
 * aber beim Eintauchen nahezu unsichtbar (Opazität ~0.04). Rahmte die Kamera
 * sie mit, würde sie das breite, leere Grundstück einfangen und die Balken
 * wirkten viel zu klein. Fallback auf hüllen-inklusive Bounds nur, wenn
 * ausnahmsweise gar kein Baukörper existiert (degenerierter Distrikt).
 * `null`, wenn keine passende Box existiert.
 */
export function computeFocusBounds(layout: CityLayout, focusId: string): { center: Vec3; radius: number } | null {
  const matchesFocus = (box: LayoutBox) => box.id === focusId || box.id.startsWith(`${focusId}/`);
  const solidBoxes = layout.boxes.filter((box) => matchesFocus(box) && (box.kind === 'bar' || box.kind === 'floor'));
  const boxes =
    solidBoxes.length > 0
      ? solidBoxes
      : layout.boxes.filter((box) => matchesFocus(box) && box.kind !== 'plot' && box.kind !== 'ground');
  if (boxes.length === 0) return null;

  const { center, boundingRadius } = computeBounds(boxes);
  return { center, radius: boundingRadius };
}

/**
 * Baut den Layout-Deskriptor für eine Ebene der Stadt. Die EINZIGE Quelle
 * der Szenen-Geometrie — `presentation/` liest nur `LayoutBox[]`.
 */
export function buildCityLayout(model: CityModel, view: CityView): CityLayout {
  const cityWideMaxAmount = computeCityWideMaxSubcategoryAmount(model);

  const districtsToRender =
    view.level === 'city'
      ? model.districts
      : model.districts.filter((d) => d.id === view.focusDistrictId);

  const geometryByDistrict = computeDistrictGrid(model.districts);

  const boxes: LayoutBox[] = [];
  const plotBoxes: LayoutBox[] = [];

  for (const district of districtsToRender) {
    const geometry = geometryByDistrict.get(district.id);
    if (!geometry) continue;

    const isCityFocused = view.level === 'city' && view.focusDistrictId === district.id;
    const isSubcategoryFocusDistrict = view.level === 'subcategory' && view.focusDistrictId === district.id;

    const bars = buildBarsForDistrict(district, geometry, cityWideMaxAmount);

    const plotBox = buildPlotBox(district, geometry, PLOT_OPACITY);
    boxes.push(plotBox);
    plotBoxes.push(plotBox);

    const hullOpacity =
      view.level === 'city'
        ? isCityFocused
          ? HULL_OPACITY_CITY_FOCUSED
          : HULL_OPACITY_CITY
        : HULL_OPACITY_DISTRICT;
    const hullBox = buildHullBox(district, bars, hullOpacity);
    hullBox.pickable = view.level === 'city';
    boxes.push(hullBox);

    for (const bar of bars) {
      const isFocusedSubcategory =
        isSubcategoryFocusDistrict && bar.subcategory.id === view.focusSubcategoryId;

      if (isFocusedSubcategory) {
        const floorBoxes = buildFloorBoxes(district, bar);
        if (floorBoxes.length > 0) {
          boxes.push(...floorBoxes);
          continue;
        }
        // Fokussiertes Gebäude OHNE erkannte Etagen (die meisten Unterkategorien
        // haben keine wiederkehrenden Verträge): das Gebäude selbst VOLL sichtbar
        // rendern statt es wie einen nicht-fokussierten Nachbarn auf
        // BAR_OPACITY_DIMMED_SUBCATEGORY auszuwaschen — sonst wirkt das
        // Eintauchen wie eine tote, verwaschene Sackgasse. Nicht pickbar (es gibt
        // nichts, in das man weiter eintauchen könnte).
        boxes.push(buildBarBox(district, bar, BAR_OPACITY_DISTRICT, false));
        continue;
      }

      const barOpacity =
        view.level === 'city'
          ? isCityFocused
            ? BAR_OPACITY_CITY_FOCUSED
            : BAR_OPACITY_CITY
          : view.level === 'district'
            ? BAR_OPACITY_DISTRICT
            : BAR_OPACITY_DIMMED_SUBCATEGORY;
      const barPickable = view.level === 'district';

      boxes.push(buildBarBox(district, bar, barOpacity, barPickable));
    }
  }

  const groundBox = buildGroundBox(plotBoxes);
  if (groundBox) boxes.push(groundBox);

  const { center, boundingRadius } = computeBounds(boxes);

  return { boxes, center, boundingRadius };
}
