import { describe, it, expect } from 'vitest';
import {
  resolveContractEnd,
  latestCancellationDate,
  remainingTermMonths,
  nextDueDate,
  upcomingCancellationDeadlines,
} from '../deadlines';
import type { ContractRecord } from '@/lib/schemas/contract-record.schema';

const TODAY = '2026-01-01';

function record(overrides: Partial<ContractRecord> = {}): ContractRecord {
  return { id: 'c1', name: 'Vertrag', status: 'active', ...overrides };
}

describe('resolveContractEnd', () => {
  it('sollte das explizite Vertragsende bevorzugen', () => {
    expect(resolveContractEnd(record({ vertragsende: '2027-03-01', contract_start: '2020-01-01', min_term_months: 12 }))).toBe('2027-03-01');
  });

  it('sollte Ende aus Beginn + Mindestlaufzeit ableiten', () => {
    expect(resolveContractEnd(record({ contract_start: '2025-01-15', min_term_months: 24 }))).toBe('2027-01-15');
  });

  it('sollte null liefern, wenn kein Ende bestimmbar ist', () => {
    expect(resolveContractEnd(record())).toBeNull();
  });
});

describe('latestCancellationDate', () => {
  it('sollte Periodenende minus Kündigungsfrist berechnen', () => {
    const r = record({ contract_start: '2025-01-15', min_term_months: 24, kuendigungsfrist_tage: 90 });
    // Ende 2027-01-15 minus 90 Tage = 2026-10-17.
    expect(latestCancellationDate(r, TODAY)).toBe('2026-10-17');
  });

  it('sollte bei automatischer Verlängerung auf die nächste Periode weiterrollen', () => {
    const r = record({ vertragsende: '2025-06-30', renewal_interval_months: 12, kuendigungsfrist_tage: 30 });
    // 2025-05-31 liegt in der Vergangenheit ⇒ +12 Monate ⇒ 2026-05-31.
    expect(latestCancellationDate(r, TODAY)).toBe('2026-05-31');
  });

  it('sollte null liefern, wenn kein Ende bestimmbar ist', () => {
    expect(latestCancellationDate(record({ kuendigungsfrist_tage: 30 }), TODAY)).toBeNull();
  });
});

describe('remainingTermMonths', () => {
  it('sollte die Restlaufzeit der aktuellen Periode in Monaten liefern', () => {
    const r = record({ contract_start: '2025-01-15', min_term_months: 24 });
    // Ende 2027-01-15, heute 2026-01-01 ⇒ 12 Monate.
    expect(remainingTermMonths(r, TODAY)).toBe(12);
  });
});

describe('nextDueDate', () => {
  it('sollte die nächste Fälligkeit ab heute aus Anker + Zyklus berechnen', () => {
    const r = record({ cycle: 'monthly', next_due_anchor: '2025-11-10' });
    expect(nextDueDate(r, TODAY)).toBe('2026-01-10');
  });

  it('sollte ohne Zyklus/Anker null liefern', () => {
    expect(nextDueDate(record(), TODAY)).toBeNull();
  });
});

describe('upcomingCancellationDeadlines (In-App-Fristenliste)', () => {
  it('sollte nur aktive Verträge mit Kündigungstermin im Fenster aufführen, sortiert', () => {
    const bald = record({ id: 'bald', name: 'Bald', vertragsende: '2026-02-15', kuendigungsfrist_tage: 14 }); // cancelBy 2026-02-01
    const spaeter = record({ id: 'spaet', name: 'Später', vertragsende: '2027-01-01', kuendigungsfrist_tage: 14 });
    const beendet = record({ id: 'end', name: 'Beendet', status: 'ended', vertragsende: '2026-02-15', kuendigungsfrist_tage: 14 });

    const list = upcomingCancellationDeadlines([spaeter, bald, beendet], TODAY, 60);
    expect(list.map((v) => v.contract_record_id)).toEqual(['bald']);
  });
});
