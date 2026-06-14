export const DASHBOARD_RANGE_OPTIONS = [
  'Gesamt',
  '7 Tage',
  '30 Tage',
  '90 Tage',
  '6 Monate',
  '1 Jahr',
  'Benutzerdefiniert',
] as const;

export type DashboardRange = (typeof DASHBOARD_RANGE_OPTIONS)[number];
export type DashboardGranularity = 'daily' | 'weekly' | 'monthly';
export type ContractFilter = 'all' | 'vertrag' | 'kein_vertrag';
export type EssentialFilter = 'all' | 'ess' | 'nicht';
export type UncategorizedFilter = 'all' | 'unkategorisiert' | 'kategorisiert';

export const DEFAULT_CUSTOM_DAYS = 30;
export const DEFAULT_CUSTOM_GRANULARITY: DashboardGranularity = 'daily';

export const DEFAULT_DASHBOARD_FILTERS = {
  category: 'all',
  account: 'all',
  contract: 'all' as ContractFilter,
  essential: 'all' as EssentialFilter,
  uncategorized: 'all' as UncategorizedFilter,
  search: '',
  range: 'Gesamt' as DashboardRange,
  customDays: DEFAULT_CUSTOM_DAYS,
  customGranularity: DEFAULT_CUSTOM_GRANULARITY,
};
