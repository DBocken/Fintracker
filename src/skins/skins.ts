export type SkinId = 'ruhe' | 'legacy' | 'clean' | 'neon' | 'imperium' | 'sakura';

export type SkinDef = {
  id: SkinId;
  name: string;
  className: string; // CSS class added to <html>
  description: string; // kurze Charakterisierung (im Theme-Selector gezeigt)
  swatch: string; // CSS-Farbe/Gradient für die Vorschau-Kachel im Selector
  isPremium?: boolean; // Platzhalter für spätere Monetarisierung (Kauf-Themes)
  font?: string; // optionaler Anzeigename des Theme-Fonts (informativ)
  /**
   * Vorbereitung für spätere Lottie-/Übergangs-Animationen. NOCH UNGENUTZT.
   * `lottie` mappt einen logischen Slot (z.B. "success", "transition") auf den
   * Pfad einer Animations-JSON unter /public/animations/<theme>/. Ein künftiger
   * ThemeMotion-Player (siehe theme-motion.ts) liest dieses Feld.
   */
  animations?: { transitions?: boolean; lottie?: Record<string, string> };
};

export const SKINS: SkinDef[] = [
  {
    id: 'ruhe',
    name: 'Ruhe',
    className: 'theme-ruhe',
    description: 'Sandfarben & ruhig — der Standard',
    swatch: 'hsl(174 65% 21%)',
  },
  {
    id: 'legacy',
    name: 'Legacy',
    className: 'theme-legacy',
    description: 'Klassisch, neutrale Graustufen',
    swatch: 'hsl(222 47% 11%)',
  },
  {
    id: 'clean',
    name: 'Clean',
    className: 'theme-clean',
    description: 'Klare Kontraste, blauer Akzent',
    swatch: 'hsl(215 100% 50%)',
  },
  {
    id: 'neon',
    name: 'Neon (Stranger-Style)',
    className: 'theme-neon',
    description: 'Dunkle Bühne mit Neon-Akzenten',
    swatch: 'linear-gradient(135deg, hsl(350 100% 54%), hsl(190 100% 50%))',
    font: 'Space Grotesk',
  },
  {
    id: 'imperium',
    name: 'Imperium',
    className: 'theme-imperium',
    description: 'Sci-Fi-Kommandobrücke: Cyan-Glow auf Blauschwarz',
    swatch: 'linear-gradient(135deg, hsl(190 95% 55%), hsl(35 95% 55%))',
    font: 'Orbitron',
  },
  {
    id: 'sakura',
    name: 'Sakura',
    className: 'theme-sakura',
    description: 'Anime-Pastell: weiches Rosé mit Lavendel',
    swatch: 'linear-gradient(135deg, hsl(338 80% 75%), hsl(265 70% 80%))',
    font: 'Quicksand',
  },
];

const THEME_CLASS_PREFIX = 'theme-';

const VALID_SKIN_IDS = new Set<SkinId>(SKINS.map((s) => s.id));

/**
 * Robuste Normalisierung eines (ggf. veralteten/unbekannten) Theme-Werts auf
 * eine gültige SkinId. Einzige Quelle der Wahrheit — von SkinProvider und
 * AppearanceSettings importiert (keine Duplikate mehr).
 */
export function normalizeSkinId(raw?: string | null): SkinId {
  if (!raw) return 'ruhe';
  if (raw.startsWith('clean-')) return 'clean'; // Backward-Compat ältere IDs
  if (VALID_SKIN_IDS.has(raw as SkinId)) return raw as SkinId;
  return 'ruhe';
}

export function getSkin(skinId: SkinId): SkinDef {
  return SKINS.find((s) => s.id === skinId) || SKINS[0];
}

export function applySkinClass(skinId: SkinId) {
  const root = document.documentElement;
  // remove any previous theme-* class
  const toRemove: string[] = [];
  root.classList.forEach((cls) => {
    if (cls.startsWith(THEME_CLASS_PREFIX)) toRemove.push(cls);
  });
  toRemove.forEach((cls) => root.classList.remove(cls));

  root.classList.add(getSkin(skinId).className);
}
