/**
 * Datums-Locale je App-Sprache (herausgelöst aus `CityPage.tsx` in WP 6.4).
 *
 * Es gibt kein zentrales `formatDate` im Repo; `toLocaleDateString`/
 * `Intl.DateTimeFormat` mit einem BCP-47-Tag ist die bestehende Konvention
 * (z. B. `NotificationsBell`). Die Zuordnung stand zweimal in derselben Datei
 * (Monatsleiste und Sheet-Datumsformat) — sie gehört an EINE Stelle, und zwar
 * dorthin, wo beide Seiten sie erreichen.
 */

const DATE_LOCALE_BY_APP_LOCALE: Record<string, string> = {
  de: 'de-DE',
  en: 'en-GB',
  tlh: 'de-DE',
  ru: 'ru-RU',
};

/** BCP-47-Tag für die App-Sprache; unbekannte Sprachen fallen auf `de-DE` zurück. */
export function cityDateLocale(appLocale: string): string {
  return DATE_LOCALE_BY_APP_LOCALE[appLocale] ?? 'de-DE';
}
