import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
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
      <Field label="Konto">
        <Select value={filterAccount} onValueChange={setFilterAccount}>
          <SelectTrigger aria-label="Konto filtern" className={triggerClass('w-48')}>
            <SelectValue placeholder="Alle Konten" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Konten</SelectItem>
            <SelectItem value="budget-pool">Budget-Pool</SelectItem>
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

      <Field label="Kategorie">
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger aria-label="Kategorie filtern" className={triggerClass('w-48')}>
            <SelectValue placeholder="Alle Kategorien" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Kategorien</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Verträge">
        <Select value={filterContract} onValueChange={setFilterContract}>
          <SelectTrigger aria-label="Vertragsstatus filtern" className={triggerClass('w-40')}>
            <SelectValue placeholder="Verträge" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value="vertrag">Nur Verträge</SelectItem>
            <SelectItem value="kein_vertrag">Ohne Verträge</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field label="Essenziell">
        <Select value={filterEssential} onValueChange={setFilterEssential}>
          <SelectTrigger aria-label="Essenziell-Status filtern" className={triggerClass('w-44')}>
            <SelectValue placeholder="Essenziell" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value="ess">Nur essenziell</SelectItem>
            <SelectItem value="nicht">Nicht essenziell</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field label="Ausgabenklasse">
        <AusgabenklasseFilterComponent
          value={filterAusgabenklasse}
          onChange={setFilterAusgabenklasse}
          categories={categories}
          className={stacked ? 'w-full' : undefined}
        />
      </Field>

      <Field label="Zeitraum">
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger aria-label="Zeitraum filtern" className={triggerClass('w-40')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DASHBOARD_RANGE_OPTIONS.map((label) => (
              <SelectItem key={label} value={label}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {PERIOD_RANGES.has(range) && (
        <Field label="Periode">
          <Select value={customPeriod} onValueChange={setCustomPeriod}>
            <SelectTrigger aria-label="Periode auswählen" className={triggerClass('w-40')}>
              <SelectValue placeholder="Periode wählen…" />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.length === 0 ? (
                <SelectItem value="__none" disabled>Keine Daten</SelectItem>
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
          <Field label={`Tage: ${customDays}`}>
            <div className="flex items-center gap-2">
              {!stacked && <Label id="custom-days-label" className="text-sm">Tage: {customDays}</Label>}
              <Slider
                aria-label={stacked ? `Tage: ${customDays}` : undefined}
                aria-labelledby={stacked ? undefined : 'custom-days-label'}
                value={[customDays]}
                onValueChange={([value]: number[]) => setCustomDays(value)}
                min={1}
                max={365}
                className={stacked ? 'w-full' : 'w-32'}
              />
            </div>
          </Field>

          <Field label="Granularität">
            <Select value={customGran} onValueChange={setCustomGran}>
              <SelectTrigger aria-label="Diagramm-Granularität auswählen" className={triggerClass('w-28')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Täglich</SelectItem>
                <SelectItem value="weekly">Wöchentlich</SelectItem>
                <SelectItem value="monthly">Monatlich</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </>
      )}

      {showSearch && (
        <Field label="Suche">
          <div className="relative">
            <Label htmlFor="transaction-search" className="sr-only">Transaktionen suchen</Label>
            <Input
              id="transaction-search"
              type="search"
              placeholder="Suche..."
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
