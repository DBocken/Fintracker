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
  range: 'Gesamt' as DashboardRange,
  customDays: DEFAULT_CUSTOM_DAYS,
  customGranularity: DEFAULT_CUSTOM_GRANULARITY,
  customPeriod: DEFAULT_CUSTOM_PERIOD,
};

export interface DashboardFilterState {
  category: string;
  account: string;
  contract: ContractFilter;
  essential: EssentialFilter;
  ausgabenklasse: AusgabenklasseFilter;
  search: string;
  range: DashboardRange;
  customDays: number;
  /** Konkrete Periode für Jahr/Quartal/Monat (z.B. `2026-Q2`); sonst leer. */
  customPeriod?: string;
}
