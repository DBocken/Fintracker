import { describe, it, expect } from 'vitest';
import type { RecurringFlow } from '@/lib/forecast-types';
import {
  getUpcomingCharges,
  getNextIncomeCharge,
  sumExpenses,
  expenseCharges,
} from '@/lib/upcoming-charges';

function flow(partial: Partial<RecurringFlow> & { id: string; amount: number; anchorDate: string }): RecurringFlow {
  return {
    name: partial.name ?? partial.id,
    cadence: partial.cadence ?? 'monthly',
    accountId: partial.accountId ?? 'acc-giro',
    ...partial,
  };
}

describe('upcoming-charges', () => {
  describe('getUpcomingCharges – Normalverhalten', () => {
    it('sollte fällige Abbuchungen im Fenster aufsteigend nach Datum liefern', () => {
      const flows = [
        flow({ id: 'miete', name: 'Miete', amount: -600, anchorDate: '2026-06-10' }),
        flow({ id: 'internet', name: 'Internet', amount: -30, anchorDate: '2026-06-20' }),
      ];
      const charges = getUpcomingCharges(flows, { fromISO: '2026-06-01', toISO: '2026-06-30' });
      expect(charges.map((c) => [c.name, c.dateISO])).toEqual([
        ['Miete', '2026-06-10'],
        ['Internet', '2026-06-20'],
      ]);
    });

    it('sollte Einnahmen und Ausgaben über das Vorzeichen unterscheiden', () => {
      const flows = [
        flow({ id: 'gehalt', name: 'Gehalt', amount: 2000, anchorDate: '2026-06-30' }),
        flow({ id: 'miete', name: 'Miete', amount: -600, anchorDate: '2026-06-10' }),
      ];
      const charges = getUpcomingCharges(flows, { fromISO: '2026-06-01', toISO: '2026-06-30' });
      const byName = Object.fromEntries(charges.map((c) => [c.name, c.direction]));
      expect(byName).toEqual({ Gehalt: 'income', Miete: 'expense' });
    });

    it('sollte daysUntil relativ zu fromISO berechnen (0 = heute)', () => {
      const flows = [flow({ id: 'a', amount: -10, anchorDate: '2026-06-01' })];
      const [charge] = getUpcomingCharges(flows, { fromISO: '2026-06-01', toISO: '2026-06-10' });
      expect(charge.daysUntil).toBe(0);
    });

    it('sollte horizonDays verwenden, wenn kein toISO gesetzt ist (Default 30)', () => {
      const flows = [
        flow({ id: 'a', amount: -10, anchorDate: '2026-06-05' }), // 05. → im 7-Tage-Fenster
        flow({ id: 'b', amount: -10, anchorDate: '2026-06-25' }), // 25. → außerhalb (nächste am 25.)
      ];
      const within = getUpcomingCharges(flows, { fromISO: '2026-06-01', horizonDays: 7 });
      expect(within.map((c) => c.flowId)).toEqual(['a']);
    });
  });

  describe('getUpcomingCharges – Edge Cases', () => {
    it('sollte deaktivierte Flows (beendete/abgelehnte Verträge) überspringen', () => {
      const flows = [
        flow({ id: 'aktiv', amount: -50, anchorDate: '2026-06-10' }),
        flow({ id: 'beendet', amount: -50, anchorDate: '2026-06-12', disabled: true }),
      ];
      const charges = getUpcomingCharges(flows, { fromISO: '2026-06-01', toISO: '2026-06-30' });
      expect(charges.map((c) => c.flowId)).toEqual(['aktiv']);
    });

    it('sollte Null-Beträge und nicht-endliche Beträge ignorieren', () => {
      const flows = [
        flow({ id: 'null', amount: 0, anchorDate: '2026-06-10' }),
        flow({ id: 'nan', amount: Number.NaN, anchorDate: '2026-06-10' }),
        flow({ id: 'ok', amount: -5, anchorDate: '2026-06-10' }),
      ];
      const charges = getUpcomingCharges(flows, { fromISO: '2026-06-01', toISO: '2026-06-30' });
      expect(charges.map((c) => c.flowId)).toEqual(['ok']);
    });

    it('sollte bei leerem/negativem Fenster (Ende vor Anfang) nichts liefern', () => {
      const flows = [flow({ id: 'a', amount: -5, anchorDate: '2026-06-10' })];
      expect(getUpcomingCharges(flows, { fromISO: '2026-06-30', toISO: '2026-06-01' })).toEqual([]);
    });
  });

  describe('getUpcomingCharges – Regression', () => {
    it('[REGRESSION] sollte einen in der Vergangenheit verankerten Monats-Flow korrekt nach vorne rollen', () => {
      // Anker liegt vor dem Fenster – die erste gelieferte Fälligkeit muss >= fromISO sein,
      // nicht der (vergangene) Anker selbst.
      const flows = [flow({ id: 'abo', amount: -12, anchorDate: '2026-01-15', cadence: 'monthly' })];
      const charges = getUpcomingCharges(flows, { fromISO: '2026-03-01', toISO: '2026-05-31' });
      expect(charges.map((c) => c.dateISO)).toEqual(['2026-03-15', '2026-04-15', '2026-05-15']);
    });

    it('[REGRESSION] sollte Monatsschritte kalendarisch (addMonths) statt als +30 Tage rechnen', () => {
      // +30 Tage würde driften (15.1 -> 14.2 -> 16.3). addMonths hält den 15.
      const flows = [flow({ id: 'abo', amount: -12, anchorDate: '2026-01-15', cadence: 'monthly' })];
      const charges = getUpcomingCharges(flows, { fromISO: '2026-01-01', toISO: '2026-04-30' });
      expect(charges.map((c) => c.dateISO)).toEqual(['2026-01-15', '2026-02-15', '2026-03-15', '2026-04-15']);
    });
  });

  describe('Aggregate', () => {
    it('sumExpenses sollte nur Ausgaben als positive Summe addieren', () => {
      const flows = [
        flow({ id: 'gehalt', amount: 2000, anchorDate: '2026-06-30' }),
        flow({ id: 'miete', amount: -600, anchorDate: '2026-06-10' }),
        flow({ id: 'strom', amount: -90, anchorDate: '2026-06-15' }),
      ];
      const charges = getUpcomingCharges(flows, { fromISO: '2026-06-01', toISO: '2026-06-30' });
      expect(sumExpenses(charges)).toBe(690);
      expect(expenseCharges(charges).map((c) => c.flowId)).toEqual(['miete', 'strom']);
    });

    it('getNextIncomeCharge sollte den frühesten Geldeingang im Fenster liefern', () => {
      const flows = [
        flow({ id: 'miete', amount: -600, anchorDate: '2026-06-10' }),
        flow({ id: 'gehalt', amount: 2000, anchorDate: '2026-06-28' }),
        flow({ id: 'nebenjob', amount: 400, anchorDate: '2026-06-20' }),
      ];
      const next = getNextIncomeCharge(flows, { fromISO: '2026-06-01', horizonDays: 40 });
      expect(next?.flowId).toBe('nebenjob');
      expect(next?.dateISO).toBe('2026-06-20');
    });

    it('getNextIncomeCharge sollte null liefern, wenn kein Eingang im Fenster liegt', () => {
      const flows = [flow({ id: 'miete', amount: -600, anchorDate: '2026-06-10' })];
      expect(getNextIncomeCharge(flows, { fromISO: '2026-06-01', horizonDays: 40 })).toBeNull();
    });
  });
});
