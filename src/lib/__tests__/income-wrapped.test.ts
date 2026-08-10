import { describe, it, expect } from 'vitest';
import { buildWrappedStats, pickWrappedYear } from '../income-wrapped';
import type { Transaction, Category } from '@/types';
import { asTransactionId } from '@/lib/ids';

const categories: Category[] = [
  { id: 'anstellung', name: 'Anstellung', filters: [], parent_id: null, attributes: { ausgabenklasse: 'einkommen' } },
  { id: 'gehalt', name: 'Gehalt', filters: [], parent_id: 'anstellung', attributes: { ausgabenklasse: 'einkommen' } },
  { id: 'onlinecreator', name: 'Online & Creator', filters: [], parent_id: null, attributes: { ausgabenklasse: 'einkommen' } },
  { id: 'creatorplattformen', name: 'Creator-Plattformen', filters: [], parent_id: 'onlinecreator', attributes: { ausgabenklasse: 'einkommen' } },
  { id: 'verkaeufe', name: 'Verkäufe', filters: [], parent_id: null, attributes: { ausgabenklasse: 'einkommen' } },
  { id: 'onlineverkauf', name: 'Online-Verkäufe', filters: [], parent_id: 'verkaeufe', attributes: { ausgabenklasse: 'einkommen' } },
];

function tx(overrides: Omit<Partial<Transaction>, 'id'> & { id?: string }): Transaction {
  return {
    date: '2025-06-15', amount: 0, payee: '',
    description: '', original_text: '', auto_mapped: false, confirmed: false, ...overrides,
    id: asTransactionId(overrides.id ?? crypto.randomUUID()),
  };
}

const NOW = new Date('2026-07-06T12:00:00Z');

function fullYearData(): Transaction[] {
  const salary = Array.from({ length: 12 }, (_, i) =>
    tx({ id: `sal${i}`, date: `2025-${String(i + 1).padStart(2, '0')}-01`, amount: 3000, payee: 'Muster GmbH', description: 'Gehalt', category_id: 'anstellung', subcategory_id: 'gehalt' }),
  );
  // Twitch: H1 3×100, H2 3×300 → +200%
  const twitchH1 = [2, 4, 6].map((m, i) =>
    tx({ id: `tw1${i}`, date: `2025-${String(m).padStart(2, '0')}-10`, amount: 100, payee: 'Twitch', category_id: 'onlinecreator', subcategory_id: 'creatorplattformen' }),
  );
  const twitchH2 = [8, 10, 12].map((m, i) =>
    tx({ id: `tw2${i}`, date: `2025-${String(m).padStart(2, '0')}-10`, amount: 300, payee: 'Twitch', category_id: 'onlinecreator', subcategory_id: 'creatorplattformen' }),
  );
  return [...salary, ...twitchH1, ...twitchH2];
}

describe('buildWrappedStats', () => {
  it('berechnet bestMonth, fastestGrowingStream und mostRegularStream für ein volles Jahr', () => {
    const stats = buildWrappedStats(fullYearData(), categories, 2025, { now: NOW })!;
    expect(stats).not.toBeNull();
    expect(stats.year).toBe(2025);
    expect(stats.partialYear).toBe(false);
    expect(stats.bestMonth?.total).toBe(3300); // Gehalt 3000 + Twitch 300 (Monate 8/10/12)
    expect(stats.fastestGrowingStream?.label).toBe('Twitch');
    expect(stats.fastestGrowingStream?.growthPercent).toBe(200);
    expect(stats.mostRegularStream?.label).toBe('Muster GmbH');
    expect(stats.mostRegularStream?.monthsActive).toBe(12);
    expect(stats.shareCard.slices.reduce((sum, s) => sum + s.percent, 0)).toBe(100);
  });

  it('[REGRESSION] sollte Buchungen aus Nachbarjahren nicht einrechnen (Jahres-Isolation)', () => {
    const data = [
      tx({ id: 'a', date: '2025-06-01', amount: 1000, payee: 'Kunde', category_id: 'verkaeufe', subcategory_id: 'onlineverkauf' }),
      tx({ id: 'b', date: '2024-06-01', amount: 9999, payee: 'Kunde', category_id: 'verkaeufe', subcategory_id: 'onlineverkauf' }),
      tx({ id: 'c', date: '2026-06-01', amount: 8888, payee: 'Kunde', category_id: 'verkaeufe', subcategory_id: 'onlineverkauf' }),
    ];
    const stats = buildWrappedStats(data, categories, 2025, { now: NOW })!;
    expect(stats.totalIncome).toBe(1000);
  });

  it('liefert null für ein Jahr ohne Einnahmen', () => {
    expect(buildWrappedStats([], categories, 2025, { now: NOW })).toBeNull();
  });

  it('kommt mit nur unregelmäßigen Strömen zurecht (keine mostRegular/fastestGrowing)', () => {
    const data = [
      tx({ id: 'a', date: '2025-02-01', amount: 50, payee: 'eBay', category_id: 'verkaeufe', subcategory_id: 'onlineverkauf' }),
      tx({ id: 'b', date: '2025-09-01', amount: 70, payee: 'eBay', category_id: 'verkaeufe', subcategory_id: 'onlineverkauf' }),
    ];
    const stats = buildWrappedStats(data, categories, 2025, { now: NOW })!;
    expect(stats.mostRegularStream).toBeNull();
    expect(stats.fastestGrowingStream).toBeNull();
    expect(stats.totalIncome).toBe(120);
  });
});

describe('pickWrappedYear', () => {
  it('bevorzugt das Vorjahr, wenn es Einnahmen hat', () => {
    expect(pickWrappedYear(fullYearData(), categories, NOW)).toBe(2025);
  });

  it('fällt auf das laufende Jahr zurück, wenn nur dieses Einnahmen hat', () => {
    const data = [tx({ id: 'x', date: '2026-03-01', amount: 500, payee: 'Kunde', category_id: 'verkaeufe', subcategory_id: 'onlineverkauf' })];
    expect(pickWrappedYear(data, categories, NOW)).toBe(2026);
  });

  it('liefert null ohne Einnahmen', () => {
    expect(pickWrappedYear([], categories, NOW)).toBeNull();
  });
});
