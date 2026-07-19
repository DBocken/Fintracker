import { describe, it, expect } from 'vitest';
import {
  warrantyExpiry,
  isUnderWarranty,
  latestPriceMinor,
  detectPriceChanges,
  sortedPriceHistory,
} from '../warranty';
import type { ContractRecord } from '@/lib/schemas/contract-record.schema';

function record(overrides: Partial<ContractRecord> = {}): ContractRecord {
  return { id: 'c1', name: 'Waschmaschine', status: 'active', ...overrides };
}

describe('Garantie-Ableitung (Issue #245)', () => {
  it('sollte den Garantieablauf aus Kaufdatum + Dauer berechnen', () => {
    expect(warrantyExpiry(record({ purchase_date: '2025-03-10', warranty_months: 24 }))).toBe('2027-03-10');
  });

  it('sollte ein explizites Garantieende bevorzugen', () => {
    expect(warrantyExpiry(record({ purchase_date: '2025-03-10', warranty_months: 24, warranty_end: '2028-01-01' }))).toBe('2028-01-01');
  });

  it('sollte null liefern, wenn keine Garantie bestimmbar ist', () => {
    expect(warrantyExpiry(record())).toBeNull();
  });

  it('sollte aktive vs. abgelaufene Garantie korrekt einordnen', () => {
    const r = record({ purchase_date: '2025-03-10', warranty_months: 24 }); // Ende 2027-03-10
    expect(isUnderWarranty(r, '2026-01-01')).toBe(true);
    expect(isUnderWarranty(r, '2027-06-01')).toBe(false);
  });
});

describe('Preisverlauf (Issue #245)', () => {
  const r = record({
    price_history: [
      { date: '2025-01-01', amount_minor: 3999 },
      { date: '2024-01-01', amount_minor: 3499 },
      { date: '2026-01-01', amount_minor: 3999 },
      { date: '2026-06-01', amount_minor: 4499 },
    ],
  });

  it('sollte den Verlauf aufsteigend nach Datum sortieren', () => {
    expect(sortedPriceHistory(r).map((p) => p.date)).toEqual([
      '2024-01-01',
      '2025-01-01',
      '2026-01-01',
      '2026-06-01',
    ]);
  });

  it('sollte den jüngsten Preis liefern', () => {
    expect(latestPriceMinor(r)).toBe(4499);
  });

  it('sollte nur echte Preisänderungen erkennen (gleiche Preise erzeugen keinen Eintrag)', () => {
    const changes = detectPriceChanges(r);
    expect(changes.map((c) => c.date)).toEqual(['2025-01-01', '2026-06-01']);
    expect(changes[0]).toMatchObject({ fromMinor: 3499, toMinor: 3999, deltaMinor: 500 });
    expect(changes[1]).toMatchObject({ fromMinor: 3999, toMinor: 4499, deltaMinor: 500 });
  });

  it('sollte bei leerem Verlauf null/leere Liste liefern', () => {
    expect(latestPriceMinor(record())).toBeNull();
    expect(detectPriceChanges(record())).toEqual([]);
  });
});
