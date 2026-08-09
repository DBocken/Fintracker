/**
 * Theme-Zustand der Stadt-Szene (Teilschritt „Rendering" von `createCityScene`,
 * herausgelöst in WP 6.4).
 *
 * three.js rendert außerhalb des DOM-Stylesheet-Kontexts, hat also keinen
 * Zugriff auf CSS-Variablen — deshalb bewusst dokumentierte feste Werte je
 * Theme statt einer CSS-Anbindung. `dark` orientiert sich am App-Dark-
 * `--background` (190 22% 8%), `light` an einem hellen neutralen Slate-Ton,
 * damit die (mittelhelle) Distrikt-Palette auf beiden Hintergründen lesbar
 * bleibt.
 */

export type CityTheme = 'light' | 'dark';

export type ThemePalette = {
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

export function initialTheme(): CityTheme {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

/**
 * Der aktive Theme-Ton als EINE Wahrheitsquelle. Materialien (Boden-Map),
 * Himmel, Licht und Fog lesen ihn — vorher hingen dieselben drei `let`s im
 * 933-Zeilen-Closure von `createCityScene` und waren von überall dort
 * beschreibbar.
 */
export type CityThemeState = {
  readonly theme: CityTheme;
  readonly palette: ThemePalette;
  /** Horizontton des aktiven Themes — zugleich die Fog-Farbe (der Stadtrand löst sich im Himmel auf). */
  readonly horizonColor: number;
  /** `false`, wenn das Theme bereits aktiv war (Aufrufer sparen sich den Rest). */
  set(next: CityTheme): boolean;
};

export function createCityThemeState(): CityThemeState {
  let theme = initialTheme();
  return {
    get theme() {
      return theme;
    },
    get palette() {
      return THEME_PALETTES[theme];
    },
    get horizonColor() {
      return THEME_PALETTES[theme].skyHorizon;
    },
    set(next) {
      if (next === theme) return false;
      theme = next;
      return true;
    },
  };
}
