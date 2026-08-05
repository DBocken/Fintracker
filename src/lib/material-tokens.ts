/**
 * Material-Token-System (WP-3.5).
 *
 * Definiert die materielle Sprache von FinTracker: Schattentiefe,
 * Lichtbrechung und Oberflächenreaktionen als konsistentes physikalisches
 * Modell. Jede Karte reagiert gleich auf Hover/Press/Focus.
 *
 * Designentscheidung:
 * - shadowAmbient: weicher, diffuser Umgebungsschatten (Standard-Karten)
 * - shadowKey: gerichteter Lichtschatten (hover/fokussiert)
 * - shadowContact: harter Kontaktschatten (aktiv/gedrückt)
 * - Surface-Tokens: Farbveränderungen für Interaktionszustände
 *
 * @see docs/aaa-plus/implementation-plan.md — WP-3.5
 */

type MaterialTokenMap = {
  shadowAmbient: string;
  shadowKey: string;
  shadowContact: string;
  surfaceHover: string;
  surfacePress: string;
  surfaceFocus: string;
  toCSSVars: () => Record<string, string>;
};

const TOKENS = {
  /** Weicher, diffuser Umgebungsschatten — Standard-Karten. */
  shadowAmbient: '0 1px 3px hsla(185, 25%, 12%, 0.06), 0 4px 12px hsla(185, 25%, 12%, 0.04)',
  /** Gerichteter Lichtschatten — Hover/Fokussiert. */
  shadowKey: '0 2px 8px hsla(185, 25%, 12%, 0.10), 0 8px 24px hsla(185, 25%, 12%, 0.08)',
  /** Harter Kontaktschatten — Aktiv/Gedrückt. */
  shadowContact: '0 1px 2px hsla(185, 25%, 12%, 0.14), 0 2px 6px hsla(185, 25%, 12%, 0.10)',
  /** Hover-Oberfläche: leichte Aufhellung. */
  surfaceHover: 'hsla(185, 25%, 12%, 0.04)',
  /** Press-Oberfläche: stärkere Verdunkelung. */
  surfacePress: 'hsla(185, 25%, 12%, 0.08)',
  /** Focus-Oberfläche: Brand-Ring-Hintergrund. */
  surfaceFocus: 'hsla(174, 65%, 21%, 0.08)',
} as const;

const CSS_VARS: Record<string, string> = {
  '--shadow-ambient': TOKENS.shadowAmbient,
  '--shadow-key': TOKENS.shadowKey,
  '--shadow-contact': TOKENS.shadowContact,
  '--surface-hover': TOKENS.surfaceHover,
  '--surface-press': TOKENS.surfacePress,
  '--surface-focus': TOKENS.surfaceFocus,
};

export const MATERIAL_TOKENS: MaterialTokenMap = {
  ...TOKENS,
  toCSSVars: () => ({ ...CSS_VARS }),
};
