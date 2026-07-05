import { describe, it, expect } from 'vitest';
import { deriveIncomeStreams } from '../income-streams';
import type { Transaction, Category } from '@/types';

const categories: Category[] = [
  { id: 'anstellung', name: 'Anstellung', filters: [], parent_id: null, attributes: { ausgabenklasse: 'einkommen' } },
  { id: 'gehalt', name: 'Gehalt', filters: [], parent_id: 'anstellung', attributes: { ausgabenklasse: 'einkommen' } },
  { id: 'staatsoziales', name: 'Staat & Soziales', filters: [], parent_id: null, attributes: { ausgabenklasse: 'einkommen' } },
  { id: 'familienleistungen', name: 'Familienleistungen', filters: [], parent_id: 'staatsoziales', attributes: { ausgabenklasse: 'einkommen' } },
  { id: 'verkaeufe', name: 'Verkäufe', filters: [], parent_id: null, attributes: { ausgabenklasse: 'einkommen' } },
  { id: 'onlineverkauf', name: 'Online-Verkäufe', filters: [], parent_id: 'verkaeufe', attributes: { ausgabenklasse: 'einkommen' } },
  { id: 'versicherungen', name: 'Versicherungen', filters: [], parent_id: null, attributes: { ausgabenklasse: 'essenziell' } },
];

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    date: '2024-06-15',
    amount: 0,
    payee: '',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: false,
    ...overrides,
  };
}

function monthlyDates(count: number, day = 1, startMonth = 1): string[] {
  return Array.from({ length: count }, (_, i) => {
    const month = startMonth + i;
    return `2024-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  });
}

const NOW = new Date('2024-12-31T12:00:00Z');

describe('deriveIncomeStreams', () => {
  it('erkennt eine monatliche Gehaltsserie als regelmäßigen, hochkonfidenten Strom', () => {
    const txs: Transaction[] = monthlyDates(6, 1, 7).map((date, i) =>
      tx({ id: `s${i}`, date, amount: 3000, payee: 'Muster GmbH', description: 'Gehalt', category_id: 'anstellung', subcategory_id: 'gehalt' }),
    );
    const result = deriveIncomeStreams(txs, categories, { now: NOW });
    expect(result.streams).toHaveLength(1);
    const stream = result.streams[0];
    expect(stream.isSalary).toBe(true);
    expect(stream.cadence).toBe('regelmaessig');
    expect(stream.confidence).toBeGreaterThanOrEqual(0.9);
    expect(stream.mainCategoryId).toBe('anstellung');
  });

  it('erkennt monatliches Kindergeld (kein Gehalts-Keyword) als regelmäßig via Monatsdichte', () => {
    const txs: Transaction[] = monthlyDates(6).map((date, i) =>
      tx({ id: `k${i}`, date, amount: 250, payee: 'Familienkasse', description: 'Kindergeld', category_id: 'staatsoziales', subcategory_id: 'familienleistungen' }),
    );
    const result = deriveIncomeStreams(txs, categories, { now: NOW });
    expect(result.streams).toHaveLength(1);
    expect(result.streams[0].isSalary).toBe(false);
    expect(result.streams[0].cadence).toBe('regelmaessig');
  });

  it('erkennt zwei sporadische eBay-Auszahlungen in 12 Monaten als unregelmäßig', () => {
    const txs: Transaction[] = [
      tx({ id: 'e1', date: '2024-02-10', amount: 45, payee: 'eBay Payments', category_id: 'verkaeufe', subcategory_id: 'onlineverkauf' }),
      tx({ id: 'e2', date: '2024-09-22', amount: 60, payee: 'eBay Payments', category_id: 'verkaeufe', subcategory_id: 'onlineverkauf' }),
    ];
    const result = deriveIncomeStreams(txs, categories, { now: NOW });
    expect(result.streams).toHaveLength(1);
    expect(result.streams[0].cadence).toBe('unregelmaessig');
    expect(result.streams[0].confidence).toBeLessThan(0.5);
  });

  it('markiert eine dominante Gehaltsquelle (>75% Anteil) als "concentrated"', () => {
    const salary = monthlyDates(6).map((date, i) =>
      tx({ id: `s${i}`, date, amount: 3000, payee: 'Muster GmbH', description: 'Gehalt', category_id: 'anstellung', subcategory_id: 'gehalt' }),
    );
    const sideIncome = [
      tx({ id: 'e1', date: '2024-05-10', amount: 100, payee: 'eBay Payments', category_id: 'verkaeufe', subcategory_id: 'onlineverkauf' }),
    ];
    const result = deriveIncomeStreams([...salary, ...sideIncome], categories, { now: NOW });
    expect(result.largestShare).toBeGreaterThan(0.75);
    expect(result.diversification).toBe('concentrated');
  });

  it('erkennt einen steigenden Trend bei wachsendem Monatsbetrag', () => {
    const amounts = [100, 100, 100, 200, 200, 200];
    const txs: Transaction[] = monthlyDates(6).map((date, i) =>
      tx({ id: `f${i}`, date, amount: amounts[i], payee: 'Freelance Kunde', category_id: 'verkaeufe', subcategory_id: 'onlineverkauf' }),
    );
    const result = deriveIncomeStreams(txs, categories, { now: NOW });
    expect(result.streams[0].trend).toBe('up');
  });

  it('setzt trend auf "flat" bei weniger als 4 aktiven Monaten', () => {
    const txs: Transaction[] = monthlyDates(2).map((date, i) =>
      tx({ id: `f${i}`, date, amount: 100, payee: 'Freelance Kunde', category_id: 'verkaeufe', subcategory_id: 'onlineverkauf' }),
    );
    const result = deriveIncomeStreams(txs, categories, { now: NOW });
    expect(result.streams[0].trend).toBe('flat');
  });

  it('liefert eine leere Strom-Liste ohne Einkommen', () => {
    const result = deriveIncomeStreams([], categories, { now: NOW });
    expect(result.streams).toEqual([]);
    expect(result.largestShare).toBe(0);
  });

  it('ignoriert Transfers', () => {
    const txs: Transaction[] = [tx({ amount: 500, is_transfer: true, category_id: 'anstellung', subcategory_id: 'gehalt' })];
    const result = deriveIncomeStreams(txs, categories, { now: NOW });
    expect(result.streams).toEqual([]);
  });

  it('ignoriert negative Buchungen', () => {
    const txs: Transaction[] = [tx({ amount: -500, category_id: 'anstellung', subcategory_id: 'gehalt' })];
    const result = deriveIncomeStreams(txs, categories, { now: NOW });
    expect(result.streams).toEqual([]);
  });

  it('schließt positive Buchungen in einer Nicht-Einkommens-Kategorie aus (z. B. Erstattung)', () => {
    const txs: Transaction[] = [tx({ amount: 15, category_id: 'versicherungen', description: 'Beitragsrückerstattung' })];
    const result = deriveIncomeStreams(txs, categories, { now: NOW });
    expect(result.streams).toEqual([]);
  });

  it('gruppiert Buchungen ohne Zahler unter dem Konto-Fallback', () => {
    const txs: Transaction[] = [
      tx({ id: '1', date: '2024-03-01', amount: 100, payee: '', account_id: 'acc-1', category_id: 'verkaeufe', subcategory_id: 'onlineverkauf' }),
      tx({ id: '2', date: '2024-04-01', amount: 120, payee: '', account_id: 'acc-1', category_id: 'verkaeufe', subcategory_id: 'onlineverkauf' }),
    ];
    const result = deriveIncomeStreams(txs, categories, { now: NOW });
    expect(result.streams).toHaveLength(1);
    expect(result.streams[0].counterparty).toBe('konto-acc-1');
  });
});
