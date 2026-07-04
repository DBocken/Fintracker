import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/useI18n';
import { getAccounts } from '../../services/account-service';
import type { Account, Category } from '../../types';
import {
  DASHBOARD_RANGE_OPTIONS,
  PERIOD_RANGES,
  type ContractFilter,
  type DashboardGranularity,
  type DashboardRange,
  type EssentialFilter,
  type AusgabenklasseFilter,
} from './filter-constants';
import type { PeriodOption } from './period-utils';
import { AusgabenklasseFilterComponent } from './AusgabenklasseFilter';

// Die Options-WERTE bleiben deutsche Literale (State/URL-Encoding, siehe
// filter-constants.ts) – übersetzt wird nur das angezeigte Label.
const RANGE_LABEL_KEYS: Record<DashboardRange, string> = {
  'Gesamt': 'dashboard.ranges.total',
  'Jahr': 'dashboard.ranges.year',
  'Quartal': 'dashboard.ranges.quarter',
  'Monat': 'dashboard.ranges.month',
  '7 Tage': 'dashboard.ranges.days7',
  '30 Tage': 'dashboard.ranges.days30',
  '90 Tage': 'dashboard.ranges.days90',
  '6 Monate': 'dashboard.ranges.months6',
  '1 Jahr': 'dashboard.ranges.year1',
  'Benutzerdefiniert': 'dashboard.ranges.custom',
};

interface TransactionFiltersProps {
  filterCat: string;
  setFilterCat: (value: string) => void;
  filterAccount: string;
  setFilterAccount: (value: string) => void;
  searchInput: string;
  setSearchInput: (value: string) => void;
  range: DashboardRange;
  setRange: (value: DashboardRange) => void;
  customDays: number;
  setCustomDays: (value: number) => void;
  customGran: DashboardGranularity;
  setCustomGran: (value: DashboardGranularity) => void;
  customPeriod: string;
  setCustomPeriod: (value: string) => void;
  /** Verfügbare Perioden (Jahr/Quartal/Monat) je nach gewählter Granularität. */
  periodOptions: PeriodOption[];
  categories: Category[];
  filterContract: ContractFilter;
  setFilterContract: (v: ContractFilter) => void;
  filterEssential: EssentialFilter;
  setFilterEssential: (v: EssentialFilter) => void;
  filterAusgabenklasse: AusgabenklasseFilter;
  setFilterAusgabenklasse: (v: AusgabenklasseFilter) => void;
  showSearch?: boolean;
  /**
   * `true` rendert die Filter als aufgeräumtes, beschriftetes 2-Spalten-Raster
   * (für Dialoge). `false` (Default) ist die kompakte Toolbar-Leiste.
   */
  stacked?: boolean;
}

export function TransactionFilters({
  filterCat,
  setFilterCat,
  filterAccount,
  setFilterAccount,
  searchInput,
  setSearchInput,
  range,
  setRange,
  customDays,
  setCustomDays,
  customGran,
  setCustomGran,
  customPeriod,
  setCustomPeriod,
  periodOptions,
  categories,
  filterContract,
  setFilterContract,
  filterEssential,
  setFilterEssential,
  filterAusgabenklasse,
  setFilterAusgabenklasse,
  showSearch = true,
  stacked = false,
}: TransactionFiltersProps) {
  const { t } = useI18n();
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
  });

  // Im Stacked-Modus füllen die Trigger die Spalte; in der Toolbar feste Breiten.
  const triggerClass = (barWidth: string) =>
    cn(stacked ? 'w-full' : barWidth, 'bg-background/50 backdrop-blur-sm');

  /** Beschriftetes Feld – nur im Stacked-Modus mit sichtbarem Label. */
  const Field = ({ label, children }: { label: string; children: ReactNode }) =>
    stacked ? (
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
        {children}
      </div>
    ) : (
      <>{children}</>
    );

  return (
    <div className={cn(stacked ? 'grid grid-cols-1 gap-3 sm:grid-cols-2' : 'flex flex-wrap items-center gap-2')}>
      <Field label={t('dashboard.account', 'Konto')}>
        <Select value={filterAccount} onValueChange={setFilterAccount}>
          <SelectTrigger aria-label={t('dashboard.filterAccountAria', 'Konto filtern')} className={triggerClass('w-48')}>
            <SelectValue placeholder={t('dashboard.allAccounts', 'Alle Konten')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('dashboard.allAccounts', 'Alle Konten')}</SelectItem>
            <SelectItem value="budget-pool">{t('dashboard.budgetPool', 'Budget-Pool')}</SelectItem>
            {accounts.map((account: Account) => (
              <SelectItem key={account.id} value={account.id}>
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: account.color }}
                    aria-hidden="true"
                  />
                  <span aria-hidden="true">{account.icon}</span>
                  <span>{account.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label={t('dashboard.category', 'Kategorie')}>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger aria-label={t('dashboard.filterCategoryAria', 'Kategorie filtern')} className={triggerClass('w-48')}>
            <SelectValue placeholder={t('dashboard.allCategories', 'Alle Kategorien')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('dashboard.allCategories', 'Alle Kategorien')}</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label={t('dashboard.contracts', 'Verträge')}>
        <Select value={filterContract} onValueChange={setFilterContract}>
          <SelectTrigger aria-label={t('dashboard.filterContractAria', 'Vertragsstatus filtern')} className={triggerClass('w-40')}>
            <SelectValue placeholder={t('dashboard.contracts', 'Verträge')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('dashboard.all', 'Alle')}</SelectItem>
            <SelectItem value="vertrag">{t('dashboard.contractsOnly', 'Nur Verträge')}</SelectItem>
            <SelectItem value="kein_vertrag">{t('dashboard.withoutContracts', 'Ohne Verträge')}</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field label={t('dashboard.essential', 'Essenziell')}>
        <Select value={filterEssential} onValueChange={setFilterEssential}>
          <SelectTrigger aria-label={t('dashboard.filterEssentialAria', 'Essenziell-Status filtern')} className={triggerClass('w-44')}>
            <SelectValue placeholder={t('dashboard.essential', 'Essenziell')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('dashboard.all', 'Alle')}</SelectItem>
            <SelectItem value="ess">{t('dashboard.essentialOnly', 'Nur essenziell')}</SelectItem>
            <SelectItem value="nicht">{t('dashboard.notEssential', 'Nicht essenziell')}</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field label={t('dashboard.expenseClass', 'Ausgabenklasse')}>
        <AusgabenklasseFilterComponent
          value={filterAusgabenklasse}
          onChange={setFilterAusgabenklasse}
          categories={categories}
          className={stacked ? 'w-full' : undefined}
        />
      </Field>

      <Field label={t('dashboard.timeRange', 'Zeitraum')}>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger aria-label={t('dashboard.filterRangeAria', 'Zeitraum filtern')} className={triggerClass('w-40')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DASHBOARD_RANGE_OPTIONS.map((value) => (
              <SelectItem key={value} value={value}>{t(RANGE_LABEL_KEYS[value], value)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {PERIOD_RANGES.has(range) && (
        <Field label={t('dashboard.period', 'Periode')}>
          <Select value={customPeriod} onValueChange={setCustomPeriod}>
            <SelectTrigger aria-label={t('dashboard.selectPeriodAria', 'Periode auswählen')} className={triggerClass('w-40')}>
              <SelectValue placeholder={t('dashboard.selectPeriodPlaceholder', 'Periode wählen…')} />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.length === 0 ? (
                <SelectItem value="__none" disabled>{t('dashboard.noData', 'Keine Daten')}</SelectItem>
              ) : (
                periodOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </Field>
      )}

      {range === 'Benutzerdefiniert' && (
        <>
          <Field label={`${t('dashboard.days', 'Tage')}: ${customDays}`}>
            <div className="flex items-center gap-2">
              {!stacked && <Label id="custom-days-label" className="text-sm">{t('dashboard.days', 'Tage')}: {customDays}</Label>}
              <Slider
                aria-label={stacked ? `${t('dashboard.days', 'Tage')}: ${customDays}` : undefined}
                aria-labelledby={stacked ? undefined : 'custom-days-label'}
                value={[customDays]}
                onValueChange={([value]: number[]) => setCustomDays(value)}
                min={1}
                max={365}
                className={stacked ? 'w-full' : 'w-32'}
              />
            </div>
          </Field>

          <Field label={t('dashboard.granularity', 'Granularität')}>
            <Select value={customGran} onValueChange={setCustomGran}>
              <SelectTrigger aria-label={t('dashboard.granularityAria', 'Diagramm-Granularität auswählen')} className={triggerClass('w-28')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">{t('dashboard.daily', 'Täglich')}</SelectItem>
                <SelectItem value="weekly">{t('dashboard.weekly', 'Wöchentlich')}</SelectItem>
                <SelectItem value="monthly">{t('dashboard.monthly', 'Monatlich')}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </>
      )}

      {showSearch && (
        <Field label={t('dashboard.searchLabel', 'Suche')}>
          <div className="relative">
            <Label htmlFor="transaction-search" className="sr-only">{t('dashboard.searchTransactions', 'Transaktionen suchen')}</Label>
            <Input
              id="transaction-search"
              type="search"
              placeholder={t('dashboard.search', 'Suche...')}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className={triggerClass('w-48')}
            />
          </div>
        </Field>
      )}
    </div>
  );
}
