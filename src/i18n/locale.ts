/**
 * Sprach-Identität — bewusst OHNE jede Abhängigkeit von Übersetzungsinhalt.
 *
 * Ausgelagert aus `translations.ts` (WP 4.5 / PERF-3): Produktionscode, der
 * nur wissen muss, WELCHE Sprachen es gibt (Sprachwähler, `resolveInitialLocale`,
 * die Lade-Registry), importiert von HIER — nicht von `translations.ts`. Jener
 * Barrel bindet weiterhin (für Tests und Typ-Herleitung) alle vier
 * Sprachbäume statisch ein; ein Import von dort würde die Trennung sofort
 * wieder aufheben, weil ein Bundler das ganze Modul inklusive `en`/`ru`/`tlh`
 * mitzöge, sobald irgendein tatsächlich genutzter Wert (nicht nur ein Typ)
 * von dort verlangt wird.
 */

export type Locale = 'de' | 'en' | 'tlh' | 'ru';

/**
 * Auswählbare Sprachen — zugleich die Menge, die paritätspflichtig gegen `de`
 * ist (siehe `__tests__/locale-parity.test.ts`).
 */
export const SUPPORTED_LOCALES: Locale[] = ['de', 'en', 'ru'];

/**
 * Im Baum vorhanden, aber bis auf Weiteres nicht wählbar. Die Übersetzungen
 * bleiben vollständig erhalten, damit ein Reaktivieren nur bedeutet, den
 * Eintrag hierher zu entfernen — deshalb wird `tlh` nicht gelöscht.
 * Wer die Sprache früher gewählt hatte, fällt auf `DEFAULT_LOCALE` zurück
 * (`resolveInitialLocale` akzeptiert nur `SUPPORTED_LOCALES`).
 */
export const INACTIVE_LOCALES: Locale[] = ['tlh'];

export const DEFAULT_LOCALE: Locale = 'de';
