"use client";

import { useQuery } from '@tanstack/react-query';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getAccounts } from '../../services/account-service';
import type { Account, Category } from '../../types';
import {
  DASHBOARD_RANGE_OPTIONS,
  type ContractFilter,
  type DashboardGranularity,
  type DashboardRange,
  type EssentialFilter,
} from './filter-constants';

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
  categories: Category[];
  filterContract: ContractFilter;
  setFilterContract: (v: ContractFilter) => void;
  filterEssential: EssentialFilter;
  setFilterEssential: (v: EssentialFilter) => void;
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
  categories,
  filterContract,
  setFilterContract,
  filterEssential,
  setFilterEssential,
}: TransactionFiltersProps) {
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
  });

  return (
    <div className="flex gap-2 items-center flex-wrap">
      <Select value={filterAccount} onValueChange={setFilterAccount}>
        <SelectTrigger aria-label="Konto filtern" className="w-48 bg-background/50 backdrop-blur-sm">
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

      <Select value={filterCat} onValueChange={setFilterCat}>
        <SelectTrigger aria-label="Kategorie filtern" className="w-48 bg-background/50 backdrop-blur-sm">
          <SelectValue placeholder="Alle Kategorien" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alle Kategorien</SelectItem>
          {categories.map((category) => (
            <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filterContract} onValueChange={setFilterContract}>
        <SelectTrigger aria-label="Vertragsstatus filtern" className="w-40 bg-background/50 backdrop-blur-sm">
          <SelectValue placeholder="Verträge" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alle</SelectItem>
          <SelectItem value="vertrag">Nur Verträge</SelectItem>
          <SelectItem value="kein_vertrag">Ohne Verträge</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filterEssential} onValueChange={setFilterEssential}>
        <SelectTrigger aria-label="Essenziell-Status filtern" className="w-44 bg-background/50 backdrop-blur-sm">
          <SelectValue placeholder="Essenziell" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alle</SelectItem>
          <SelectItem value="ess">Nur essenziell</SelectItem>
          <SelectItem value="nicht">Nicht essenziell</SelectItem>
        </SelectContent>
      </Select>

      <div className="relative">
        <Label htmlFor="transaction-search" className="sr-only">Transaktionen suchen</Label>
        <Input
          id="transaction-search"
          type="search"
          placeholder="Suche..."
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          className="w-48 bg-background/50 backdrop-blur-sm"
        />
      </div>

      <Select value={range} onValueChange={setRange}>
        <SelectTrigger aria-label="Zeitraum filtern" className="w-40 bg-background/50 backdrop-blur-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DASHBOARD_RANGE_OPTIONS.map((label) => (
            <SelectItem key={label} value={label}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {range === 'Benutzerdefiniert' && (
        <>
          <div className="flex items-center gap-2">
            <Label id="custom-days-label" className="text-sm">Tage: {customDays}</Label>
            <Slider
              aria-labelledby="custom-days-label"
              value={[customDays]}
              onValueChange={([value]: number[]) => setCustomDays(value)}
              min={1}
              max={365}
              className="w-32"
            />
          </div>

          <Select value={customGran} onValueChange={setCustomGran}>
            <SelectTrigger aria-label="Diagramm-Granularität auswählen" className="w-28 bg-background/50 backdrop-blur-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Täglich</SelectItem>
              <SelectItem value="weekly">Wöchentlich</SelectItem>
              <SelectItem value="monthly">Monatlich</SelectItem>
            </SelectContent>
          </Select>
        </>
      )}
    </div>
  );
}
