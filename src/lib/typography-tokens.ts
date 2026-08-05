/**
 * Zentrales Typografie-Token-System für FinTracker (WP-2.3).
 *
 * Definiert eine aggressive, dirigistische Hierarchie:
 * - Hero-Kennzahlen dominieren visuell (56px Desktop / 36px Mobile)
 * - Sekundär-Informationen sind deutlich untergeordnet
 * - Alle Werte als CSS-Variablen verfügbar
 *
 * @see docs/aaa-plus/tdd-specs.md — WP-2.3
 */

type TypographyTokenMap = {
  heroDesktop: string;
  heroMobile: string;
  display: string;
  headline: string;
  body: string;
  caption: string;
  weightDisplay: string;
  weightValue: string;
  weightLabel: string;
  weightBody: string;
  toCSSVars: () => Record<string, string>;
};

const TOKENS = {
  heroDesktop: '3.5rem',      // 56px
  heroMobile: '2.25rem',     // 36px
  display: '1.875rem',       // 30px
  headline: '1.25rem',       // 20px
  body: '0.9375rem',         // 15px
  caption: '0.75rem',        // 12px — Minimum, niemals kleiner
  weightDisplay: '700',
  weightValue: '700',
  weightLabel: '500',
  weightBody: '400',
} as const;

/** CSS-Variablen-Mapping für `index.css :root`. */
const CSS_VARS: Record<string, string> = {
  '--font-size-hero': TOKENS.heroDesktop,
  '--font-size-hero-mobile': TOKENS.heroMobile,
  '--font-size-display': TOKENS.display,
  '--font-size-headline': TOKENS.headline,
  '--font-size-body': TOKENS.body,
  '--font-size-caption': TOKENS.caption,
  '--font-weight-display': TOKENS.weightDisplay,
  '--font-weight-value': TOKENS.weightValue,
  '--font-weight-label': TOKENS.weightLabel,
  '--font-weight-body': TOKENS.weightBody,
};

export const TYPOGRAPHY_TOKENS: TypographyTokenMap = {
  ...TOKENS,
  toCSSVars: () => ({ ...CSS_VARS }),
};
