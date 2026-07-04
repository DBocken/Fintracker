import { resolveInitialLocale, lookupTranslation } from './I18nProvider';

/**
 * Übersetzung für Nicht-React-Code (services/, lib/): Hooks wie useI18n()
 * funktionieren dort nicht, da diese Funktionen außerhalb von React-Renders
 * laufen (z. B. in React-Query queryFn). Liest die aktuelle Sprache bei jedem
 * Aufruf frisch (localStorage ist synchron) — Aufrufer müssen `locale` selbst
 * in ihren React-Query queryKey aufnehmen, damit ein Sprachwechsel neu lädt.
 */
export function t(key: string, fallback?: string): string {
  return lookupTranslation(resolveInitialLocale(), key) ?? fallback ?? key;
}
