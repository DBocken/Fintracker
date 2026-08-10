/**
 * Lightweight-i18n ohne externe Dependency. Übersetzungen sind ein typsicheres,
 * verschachteltes Objekt; Lookup erfolgt über punktierte Schlüssel (z. B.
 * "privacy.title"). Bewusst klein gehalten und nur auf conversion-/vertrauens-
 * kritische Screens angewandt – keine Komplettmigration.
 *
 * Die Sprachwahl wird rein lokal (localStorage) gehalten, damit sie auch auf den
 * übersetzten Screens VOR dem Entsperren der lokalen Verschlüsselung (Login,
 * Privacy, Unlock) funktioniert.
 *
 * **WP 4.5 / PERF-3 — dieses Modul ist NICHT mehr der Laufzeitpfad.** Die
 * vier Sprachbäume liegen seit der Bündel-Aufteilung einzeln unter
 * `src/i18n/translations/{de,en,tlh,ru}.ts`. Dieser Barrel bindet sie hier
 * bewusst weiter alle STATISCH ein — er ist die Quelle für Tests (Locale-
 * Parität, Aufrufstellen-Prüfung, …) und für die Typ-Herleitung
 * `TranslationTree`, die synchronen Zugriff auf ALLE Sprachen gleichzeitig
 * braucht. Genau deshalb darf ihn Produktionscode nicht mehr importieren:
 * `I18nProvider.tsx`/`serviceT.ts` laufen über `translation-registry.ts`
 * (nur `de` statisch, `en`/`ru`/`tlh` per `import()`) und `Locale`/
 * `SUPPORTED_LOCALES`/`DEFAULT_LOCALE`/`INACTIVE_LOCALES` über `locale.ts`
 * (keine Übersetzungsinhalte, keine Bundle-Kosten). Ein Bundler zieht ein
 * ganzes Modul samt aller statischen Importe mit, sobald irgendein
 * tatsächlich genutzter (nicht nur getypter) Export von hier verlangt wird —
 * ein Re-Import dieser Datei aus dem Startpfad würde die Aufteilung sofort
 * wieder aufheben.
 */

import { de } from './translations/de';
import { en } from './translations/en';
import { tlh } from './translations/tlh';
import { ru } from './translations/ru';

export {
  type Locale,
  SUPPORTED_LOCALES,
  INACTIVE_LOCALES,
  DEFAULT_LOCALE,
} from './locale';

/**
 * Vollständig zusammengeführter Baum aller vier Sprachen. NUR für Tests und
 * für die Typ-Herleitung gedacht (siehe Modulkommentar oben) — niemals aus
 * `I18nProvider.tsx`, `serviceT.ts` oder einem anderen vom Startpfad
 * erreichbaren Modul importieren.
 */
export const translations = { de, en, tlh, ru } as const;

export type TranslationTree = (typeof translations)['de'];
