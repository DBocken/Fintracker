"use client";

import { useQuery } from '@tanstack/react-query';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { getAccounts } from '../../services/account-service';
import type { Account } from '../../types';

interface TransactionFiltersProps {
  filterCat: string;
  setFilterCat: (value: string) => void;
  filterAccount: string;
  setFilterAccount: (value: string) => void;
  searchInput: string;
  setSearchInput: (value: string) => void;
  range: string;
  setRange: (value: string) => void;
  customDays: number;
  setCustomDays: (value: number) => void;
  customGran: 'daily' | 'weekly' | 'monthly';
  setCustomGran: (value: 'daily' | 'weekly' | 'monthly') => void;
  categories: any[];
  filterContract: 'all' | 'vertrag' | 'kein_vertrag';
  setFilterContract: (v: 'all' | 'vertrag' | 'kein_vertrag') => void;
  filterEssential: 'all' | 'ess' | 'nicht';
  setFilterEssential: (v: 'all' | 'ess' | 'nicht') => void;
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
  setFilterEssential
}: TransactionFiltersProps) {
  // Load accounts for filter
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
  });

  return (
    <div className="flex gap-2 items-center flex-wrap">
      {/* Account Filter */}
      <Select value={filterAccount} onValueChange={setFilterAccount}>
        <SelectTrigger className="w-48 bg-background/50 backdrop-blur-sm">
          <SelectValue placeholder="Alle Konten"/>
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
                />
                <span>{account.icon}</span>
                <span>{account.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filterCat} onValueChange={setFilterCat}>
        <SelectTrigger className="w-48 bg-background/50 backdrop-blur-sm">
          <SelectValue placeholder="Alle Kategorien"/>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alle</SelectItem>
          {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filterContract} onValueChange={setFilterContract}>
        <SelectTrigger className="w-40 bg-background/50 backdrop-blur-sm">
          <SelectValue placeholder="Verträge"/>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alle</SelectItem>
          <SelectItem value="vertrag">Nur Verträge</SelectItem>
          <SelectItem value="kein_vertrag">Ohne Verträge</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filterEssential} onValueChange={setFilterEssential}>
        <SelectTrigger className="w-44 bg-background/50 backdrop-blur-sm">
          <SelectValue placeholder="Essenziell"/>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alle</SelectItem>
          <SelectItem value="ess">Nur essenziell</SelectItem>
          <SelectItem value="nicht">Nicht essenziell</SelectItem>
        </SelectContent>
      </Select>
      
      <input
        type="text"
        placeholder="Suche..."
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className="border px-2 py-1 rounded bg-background/50 backdrop-blur-sm"
      />
      
      <Select value={range} onValueChange={setRange}>
        <SelectTrigger className="w-32 bg-background/50 backdrop-blur-sm">
          <SelectValue/>
        </SelectTrigger>
        <SelectContent>
          {['7 Tage','30 Tage','90 Tage','6 Monate','1 Jahr','Gesamt'].map(l => 
            <SelectItem key={l} value={l}>{l}</SelectItem>
          )}
          <SelectItem value="Benutzerdefiniert">Benutzerdefiniert</SelectItem>
        </SelectContent>
      </Select>
      
      {range === 'Benutzerdefiniert' && (
        <>
          <div className="flex items-center gap-2">
            <label className="text-sm">Tage: {customDays}</label>
            <Slider 
              value={[customDays]} 
              onValueChange={([v]: number[]) => setCustomDays(v)} 
              min={1} 
              max={365} 
              className="w-32"
            />
          </div>
          
          <Select value={customGran} onValueChange={(val: 'daily' | 'weekly' | 'monthly') => setCustomGran(val)}>
            <SelectTrigger className="w-24 bg-background/50 backdrop-blur-sm">
              <SelectValue/>
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