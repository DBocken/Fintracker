import { describe, it, expect } from 'vitest';
import { incomeVariesAcross } from '../onboarding-signals-service';
import type { Transaction } from '@/types';

/**
 * Die Schwelle für „schwankende Einnahmen" ist eine Setzung und deshalb
 * ausdrücklich prüfbar gehalten: Ein einzelner Bonusmonat darf ein sonst
 * gleichmäßiges Gehalt nicht zu „schwankend" machen.
 */

function income(date: string, amount: number): Transaction {
  return { id: `t-${date}-${amount}`, date, amount, account_id: 'a1' } as Transaction;
}

describe('incomeVariesAcross', () => {
  it('sollte gleichmäßige Einnahmen nicht als schwankend lesen', () => {
    expect(
      incomeVariesAcross([
        income('2026-01-01', 2500),
        income('2026-02-01', 2500),
        income('2026-03-01', 2520),
      ]),
    ).toBe(false);
  });

  it('sollte stark unterschiedliche Monate als schwankend lesen', () => {
    expect(
      incomeVariesAcross([
        income('2026-01-01', 400),
        income('2026-02-01', 3200),
        income('2026-03-01', 1100),
      ]),
    ).toBe(true);
  });

  it('sollte einen einzelnen Bonusmonat verkraften', () => {
    // Weihnachtsgeld ist keine Unregelmäßigkeit im Sinne der Frage.
    expect(
      incomeVariesAcross([
        income('2026-01-01', 2500),
        income('2026-02-01', 2500),
        income('2026-03-01', 2500),
        income('2026-04-01', 2500),
        income('2026-05-01', 2500),
        income('2026-06-01', 2500),
        income('2026-07-01', 2500),
        income('2026-08-01', 2500),
        income('2026-09-01', 2500),
        income('2026-10-01', 2500),
        income('2026-11-01', 3800),
        income('2026-12-01', 2500),
      ]),
    ).toBe(false);
  });

  it('sollte unter drei Monaten gar nicht urteilen', () => {
    // Zwei Monate sagen nichts über Regelmäßigkeit — lieber kein Signal als
    // ein geratenes.
    expect(incomeVariesAcross([income('2026-01-01', 400), income('2026-02-01', 3200)])).toBe(false);
  });

  it('sollte Ausgaben und Umbuchungen ignorieren', () => {
    const withNoise: Transaction[] = [
      income('2026-01-01', 2500),
      income('2026-02-01', 2500),
      income('2026-03-01', 2500),
      { id: 'x1', date: '2026-01-05', amount: -980, account_id: 'a1' } as Transaction,
      { id: 'x2', date: '2026-02-05', amount: 5000, account_id: 'a1', is_transfer: true } as Transaction,
    ];
    expect(incomeVariesAcross(withNoise)).toBe(false);
  });
});
