/**
 * Filter-Modell des Dashboards: Bereichsoptionen, Filter-Achsen und der
 * Zustand, den Dashboard, Transaktionen und die Auswertungen gemeinsam lesen.
 *
 * Liegt in `features/shared/domain`, weil ihn mehr als ein Slice braucht
 * (AGENTS.md §3). Zuvor stand `DashboardFilterState` in
 * `components/dashboard/filter-utils.ts` — die Feature-Domänen mussten dafür
 * entgegen der Schichtrichtung nach oben in `components/` importieren.
 */
import type { DashboardGranularity } from '@/features/dashboard/domain/overview-types';

export const DASHBOARD_RANGE_OPTIONS = [
  'Gesamt',
  'Jahr',
  'Quartal',
  'Monat',
  '7 Tage',
  '30 Tage',
  '90 Tage',
  '6 Monate',
  '1 Jahr',
  'Benutzerdefiniert',
] as const;

export type DashboardRange = (typeof DASHBOARD_RANGE_OPTIONS)[number];

/**
 * Der Token für den benutzerdefinierten Zeitraum — als **Konstante**, damit
 * ihn niemand mehr gegen einen ANZEIGETEXT vergleicht.
 *
 * Genau das stand in `TransactionFilters.tsx`:
 * `values.range === t('transactionFilters.customRange')`. Der Zustand hält
 * den Token `'Benutzerdefiniert'`, die Übersetzung liefert „Custom" bzw.
 * „Произвольный" — der Vergleich war also **nur auf Deutsch** wahr, und auf
 * Englisch und Russisch erschienen Tageszahl-Regler und Granularität nach
 * der Auswahl NIE. Kein Fehler, kein leerer Zustand, nichts wurde rot: die
 * Bedingung war schlicht immer falsch.
 *
 * Dieselbe Falle nennt AGENTS.md §6 („Matching über den Anzeigenamen statt
 * der ID"). Entitäten werden über ihre stabile ID adressiert; ein
 * Anzeigetext ist keine ID.
 */
export const CUSTOM_RANGE: DashboardRange = 'Benutzerdefiniert';
// Kanonische Definition lebt in der Domain-Schicht (overview-types.ts) —
// hier nur Re-Export, damit bestehende Importeure unverändert funktionieren.
export type { DashboardGranularity };

/**
 * Granularitäten, bei denen zusätzlich eine konkrete Periode (Jahr/Quartal/Monat)
 * gewählt werden muss. Die Periode wird in `DashboardFilterState.customPeriod`
 * gehalten (z.B. `2026`, `2026-Q2`, `2026-06`).
 */
export const PERIOD_RANGES: ReadonlySet<DashboardRange> = new Set<DashboardRange>(['Jahr', 'Quartal', 'Monat']);
export type ContractFilter = 'all' | 'vertrag' | 'kein_vertrag';
export type EssentialFilter = 'all' | 'ess' | 'nicht';
export type AusgabenklasseFilter = 'all' | 'essenziell' | 'diskretionaer' | 'sparen' | 'einkommen' | 'unkategorisiert';

export const DEFAULT_CUSTOM_DAYS = 30;
export const DEFAULT_CUSTOM_GRANULARITY: DashboardGranularity = 'daily';
export const DEFAULT_CUSTOM_PERIOD = '';

export const DEFAULT_DASHBOARD_FILTERS = {
  category: 'all',
  account: 'all',
  contract: 'all' as ContractFilter,
  essential: 'all' as EssentialFilter,
  ausgabenklasse: 'all' as AusgabenklasseFilter,
  search: '',
  merchant: '',
  range: 'Gesamt' as DashboardRange,
  customDays: DEFAULT_CUSTOM_DAYS,
  customGranularity: DEFAULT_CUSTOM_GRANULARITY,
  customPeriod: DEFAULT_CUSTOM_PERIOD,
};

export interface DashboardFilterState {
  category: string;
  /**
   * Kategorien-MENGE (WP-G) — gesetzt, wenn eine Frage einen Oberbegriff
   * auflöst („Essen" = Lebensmittel ∪ Essen & Trinken ∪ …). Additiv und
   * optional wie `merchant`: Ein Pflichtfeld berührte über hundert Stellen,
   * und ein fehlendes Feld bedeutet hier schlicht „keine Mengenauswahl" —
   * die richtige Vorgabe.
   *
   * Vorrang vor `category`, wenn nichtleer. Beide zugleich zu setzen wäre
   * zwei Wahrheiten für dieselbe Frage; `aktiveKategorien()` ist die eine
   * Stelle, die das auflöst.
   */
  categories?: readonly string[];
  account: string;
  contract: ContractFilter;
  essential: EssentialFilter;
  ausgabenklasse: AusgabenklasseFilter;
  search: string;
  /**
   * Händlerfamilie (normalisierter Händlername, z. B. `lidl sagt danke`).
   *
   * Eigene Achse neben `search`, weil `search` bewusst breit sucht — auch in
   * Beschreibung, Originaltext und Notizen. Für eine Freitextsuche ist dieser
   * Übertreffer richtig; als Antwort auf „Wieviel habe ich bei Lidl
   * ausgegeben?" wäre er eine falsche Zahl mit vollem Selbstbewusstsein.
   *
   * Der Wert ist der normalisierte NAME, nicht der Fingerprint: `iban:de89…|out`
   * wäre eine IBAN in einer teilbaren URL und zusätzlich richtungsgebunden.
   *
   * Optional wie `customPeriod` — eine meist abwesende Achse, und ein
   * fehlender Wert bedeutet genau die richtige Vorgabe: kein Händlerfilter.
   */
  merchant?: string;
  range: DashboardRange;
  customDays: number;
  /** Konkrete Periode für Jahr/Quartal/Monat (z.B. `2026-Q2`); sonst leer. */
  customPeriod?: string;
}
