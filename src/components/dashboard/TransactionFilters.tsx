import type { ReactNode } from 'react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/useI18n';
import type { Account } from '../../types';
import { DASHBOARD_RANGE_OPTIONS, PERIOD_RANGES, CUSTOM_RANGE, type DashboardRange } from '@/features/shared/domain/dashboard-filters';
import type { FilterViewModel } from '@/features/shared/domain/filter-view-model';
import { AusgabenklasseFilterComponent } from './AusgabenklasseFilter';

interface TransactionFiltersProps {
  /** Werte, Setter, Perioden/Konten/Kategorien in einem Objekt (WP 5.4, KOMP-2). */
  filters: FilterViewModel;
  showSearch?: boolean;
  /**
   * `true` rendert die Filter als aufgeräumtes, beschriftetes 2-Spalten-Raster
   * (für Dialoge). `false` (Default) ist die kompakte Toolbar-Leiste.
   */
  stacked?: boolean;
}

/**
 * Anzeigetext je Zeitraum-Token — mit **literalen** i18n-Keys.
 *
 * Vorher rendert die Auswahlliste den Token selbst als Beschriftung
 * (`<SelectItem>{label}</SelectItem>`), und der Token ist deutsch: In der
 * englischen Oberflaeche stand dort „Gesamt", „Jahr", „7 Tage",
 * „Benutzerdefiniert". Auf dem Geraet nachgesehen war „Gesamt" das einzige
 * deutsche Wort auf dem ganzen englischen Bildschirm.
 *
 * Bewusst ein `switch` mit Literalen und KEINE Token-Key-Tabelle: Eine
 * Tabelle braeuchte einen dynamisch gebauten Key, und `call-site-keys.test.ts`
 * fuehrt darauf eine Ratsche, weil ein solcher Aufruf von keiner statischen
 * Pruefung mehr erreicht wird. Zehn feste Optionen rechtfertigen das nicht.
 */
function useRangeLabel(): (range: DashboardRange) => string {
  const { t } = useI18n();
  return (range) => {
    switch (range) {
      case 'Gesamt': return t('transactionFilters.rangeAll');
      case 'Jahr': return t('transactionFilters.rangeYear');
      case 'Quartal': return t('transactionFilters.rangeQuarter');
      case 'Monat': return t('transactionFilters.rangeMonth');
      case '7 Tage': return t('transactionFilters.range7Days');
      case '30 Tage': return t('transactionFilters.range30Days');
      case '90 Tage': return t('transactionFilters.range90Days');
      case '6 Monate': return t('transactionFilters.range6Months');
      case '1 Jahr': return t('transactionFilters.range1Year');
      case 'Benutzerdefiniert': return t('transactionFilters.customRange');
    }
  };
}

export function TransactionFilters({
  filters,
  showSearch = true,
  stacked = false,
}: TransactionFiltersProps) {
  const { values, set, periodOptions, categories, accounts } = filters;
  const { t } = useI18n();
  const rangeLabel = useRangeLabel();

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
      <Field label={t('transactionFilters.accountLabel')}>
        <Select value={values.account} onValueChange={set.account}>
          <SelectTrigger data-tour-id="filter-account" aria-label={t('transactionFilters.accountAriaLabel')} className={triggerClass('w-48')}>
            <SelectValue placeholder={t('transactionFilters.accountPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('transactionFilters.accountPlaceholder')}</SelectItem>
            <SelectItem value="budget-pool">{t('transactionFilters.budgetPool')}</SelectItem>
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

      <Field label={t('transactionFilters.categoryLabel')}>
        <Select value={values.category} onValueChange={set.category}>
          <SelectTrigger data-tour-id="filter-category" aria-label={t('transactionFilters.categoryAriaLabel')} className={triggerClass('w-48')}>
            <SelectValue placeholder={t('transactionFilters.categoryPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('transactionFilters.categoryPlaceholder')}</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label={t('transactionFilters.contractLabel')}>
        <Select value={values.contract} onValueChange={set.contract}>
          <SelectTrigger data-tour-id="filter-contract" aria-label={t('transactionFilters.contractAriaLabel')} className={triggerClass('w-40')}>
            <SelectValue placeholder={t('transactionFilters.contractPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('transactionFilters.contractAll')}</SelectItem>
            <SelectItem value="vertrag">{t('transactionFilters.contractOnlyContracts')}</SelectItem>
            <SelectItem value="kein_vertrag">{t('transactionFilters.contractNoContracts')}</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field label={t('transactionFilters.essentialLabel')}>
        <Select value={values.essential} onValueChange={set.essential}>
          <SelectTrigger data-tour-id="filter-essential" aria-label={t('transactionFilters.essentialAriaLabel')} className={triggerClass('w-44')}>
            <SelectValue placeholder={t('transactionFilters.essentialPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('transactionFilters.essentialAll')}</SelectItem>
            <SelectItem value="ess">{t('transactionFilters.essentialOnly')}</SelectItem>
            <SelectItem value="nicht">{t('transactionFilters.essentialNot')}</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field label={t('transactionFilters.ausgabenklasseLabel')}>
        <AusgabenklasseFilterComponent
          value={values.ausgabenklasse}
          onChange={set.ausgabenklasse}
          categories={categories}
          className={stacked ? 'w-full' : undefined}
        />
      </Field>

      <Field label={t('transactionFilters.timeRangeLabel')}>
        <Select value={values.range} onValueChange={set.range}>
          <SelectTrigger data-tour-id="filter-timerange" aria-label={t('transactionFilters.timeRangeAriaLabel')} className={triggerClass('w-40')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DASHBOARD_RANGE_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>{rangeLabel(option)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {PERIOD_RANGES.has(values.range) && (
        <Field label={t('transactionFilters.periodLabel')}>
          <Select value={values.customPeriod} onValueChange={set.customPeriod}>
            <SelectTrigger aria-label={t('transactionFilters.periodAriaLabel')} className={triggerClass('w-40')}>
              <SelectValue placeholder={t('transactionFilters.periodPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.length === 0 ? (
                <SelectItem value="__none" disabled>{t('transactionFilters.periodNone')}</SelectItem>
              ) : (
                periodOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </Field>
      )}

      {/* Gegen den TOKEN, nicht gegen den Anzeigetext — siehe CUSTOM_RANGE. */}
      {values.range === CUSTOM_RANGE && (
        <>
          <Field label={t('transactionFilters.daysLabel').replace(/{days}/g, String(values.customDays))}>
            <div className="flex items-center gap-2">
              {!stacked && <Label id="custom-days-label" className="text-sm">{t('transactionFilters.daysLabel').replace(/{days}/g, String(values.customDays))}</Label>}
              <Slider
                aria-label={stacked ? t('transactionFilters.daysLabel').replace('{days}', String(values.customDays)) : undefined}
                aria-labelledby={stacked ? undefined : 'custom-days-label'}
                value={[values.customDays]}
                onValueChange={([value]: number[]) => set.customDays(value)}
                min={1}
                max={365}
                className={stacked ? 'w-full' : 'w-32'}
              />
            </div>
          </Field>

          <Field label={t('transactionFilters.granularityLabel')}>
            <Select value={values.customGranularity} onValueChange={set.customGranularity}>
              <SelectTrigger aria-label={t('transactionFilters.granularityAriaLabel')} className={triggerClass('w-28')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">{t('transactionFilters.granularityDaily')}</SelectItem>
                <SelectItem value="weekly">{t('transactionFilters.granularityWeekly')}</SelectItem>
                <SelectItem value="monthly">{t('transactionFilters.granularityMonthly')}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </>
      )}

      {showSearch && (
        <Field label={t('transactionFilters.searchLabel')}>
          <div className="relative">
            <Label htmlFor="transaction-search" className="sr-only">{t('transactionFilters.searchAriaLabel')}</Label>
            <Input
              id="transaction-search"
              type="search"
              placeholder={t('transactionFilters.searchPlaceholder')}
              value={values.search}
              onChange={(event) => set.search(event.target.value)}
              className={triggerClass('w-48')}
            />
          </div>
        </Field>
      )}
    </div>
  );
}
