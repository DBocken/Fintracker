import { resolveInitialLocale, lookupWorded } from './I18nProvider';
import { resolveInitialWording } from './wording';

/**
 * Übersetzung für Nicht-React-Code (services/, lib/): Hooks wie useI18n()
 * funktionieren dort nicht, da diese Funktionen außerhalb von React-Renders
 * laufen (z. B. in React-Query queryFn). Liest Sprache UND Sprachstil bei jedem
 * Aufruf frisch (localStorage ist synchron) — Aufrufer müssen `locale` selbst
 * in ihren React-Query queryKey aufnehmen, damit ein Sprachwechsel neu lädt.
 */
export function t(key: string, fallback?: string): string {
  return (
    lookupWorded(resolveInitialLocale(), key, resolveInitialWording()) ?? fallback ?? key
  );
}
