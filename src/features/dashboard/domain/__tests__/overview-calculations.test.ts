import { describe, it, expect } from 'vitest';
import type { Transaction } from '@/types';
import {
  computeFlowTotals,
  buildIncomeExpenseSeries,
  computeTotalFlow,
  computeAutoStartingBalance,
  buildBalanceHistory,
} from '../overview-calculations';

function makeTx(overrides: Partial<Transaction>): Transaction {
  return {
    date: '2026-01-01',
    amount: 0,
    payee: '',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: true,
    ...overrides,
  };
}

describe('computeFlowTotals', () => {
  describe('Happy Path', () => {
    it('sollte Einnahmen, Ausgaben und Saldo korrekt berechnen', () => {
      const txs = [
        makeTx({ amount: 100 }),
        makeTx({ amount: -40 }),
        makeTx({ amount: -10 }),
      ];
      expect(computeFlowTotals(txs)).toEqual({ income: 100, expenses: 50, balance: 50 });
    });
  });

  describe('Edge Cases', () => {
    it('sollte leeres Array zu Nullen verarbeiten', () => {
      expect(computeFlowTotals([])).toEqual({ income: 0, expenses: 0, balance: 0 });
    });

    it('sollte amount 0 weder als Einnahme noch als Ausgabe zählen', () => {
      const txs = [makeTx({ amount: 0 })];
      expect(computeFlowTotals(txs)).toEqual({ income: 0, expenses: 0, balance: 0 });
    });

    it('sollte Transfers (is_transfer=true) von Einnahmen und Ausgaben ausschließen', () => {
      const txs = [
        makeTx({ amount: 100, is_transfer: true }),
        makeTx({ amount: -100, is_transfer: true }),
        makeTx({ amount: 20 }),
      ];
      expect(computeFlowTotals(txs)).toEqual({ income: 20, expenses: 0, balance: 20 });
    });
  });

  describe('Regression Protection', () => {
    it('[REGRESSION] sollte identische Summen wie die bisherige Inline-Berechnung liefern', () => {
      const txs = [
        makeTx({ amount: 500 }),
        makeTx({ amount: -120 }),
        makeTx({ amount: -30 }),
        makeTx({ amount: 250, is_transfer: true }),
        makeTx({ amount: -250, is_transfer: true }),
        makeTx({ amount: -5.5 }),
      ];

      const result = computeFlowTotals(txs);

      // Nachgebaute Inline-Logik aus dem bisherigen Dashboard.tsx (Zeilen 302-313)
      const flowTransactions = txs.filter((t) => !t.is_transfer);
      const income = flowTransactions.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
      const expenses = flowTransactions.filter((t) => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const balance = income - expenses;

      expect(result).toEqual({ income, expenses, balance });
    });
  });
});

describe('buildIncomeExpenseSeries', () => {
  describe('Happy Path', () => {
    it('sollte Transaktionen nach Tagesgranularität bucketen (dd.MM.)', () => {
      const txs = [
        makeTx({ date: '2026-01-05', amount: 100 }),
        makeTx({ date: '2026-01-05', amount: -20 }),
      ];
      const series = buildIncomeExpenseSeries(txs, 'daily');
      expect(series).toEqual([{ date: '05.01.', income: 100, expenses: 20 }]);
    });

    it('sollte Transaktionen nach Monatsgranularität bucketen (MM.yy)', () => {
      const txs = [
        makeTx({ date: '2026-03-01', amount: 50 }),
        makeTx({ date: '2026-03-20', amount: -10 }),
      ];
      const series = buildIncomeExpenseSeries(txs, 'monthly');
      expect(series).toEqual([{ date: '03.26', income: 50, expenses: 10 }]);
    });
  });

  describe('Edge Cases', () => {
    it('sollte leeres Array zu leerer Serie verarbeiten', () => {
      expect(buildIncomeExpenseSeries([], 'daily')).toEqual([]);
    });

    it('sollte Transfers von der Serie ausschließen', () => {
      const txs = [makeTx({ date: '2026-01-05', amount: 100, is_transfer: true })];
      expect(buildIncomeExpenseSeries(txs, 'daily')).toEqual([]);
    });

    it('sollte weekly wie daily formatieren (dd.MM.), analog zur bisherigen Inline-Logik', () => {
      const txs = [makeTx({ date: '2026-01-05', amount: 100 })];
      expect(buildIncomeExpenseSeries(txs, 'weekly')).toEqual([{ date: '05.01.', income: 100, expenses: 0 }]);
    });

    it('[REGRESSION] sollte chronologisch aufsteigend sortieren, nicht nach erstem Vorkommen', () => {
      // Die Buchungsliste ist datum-ABSTEIGEND sortiert. Wer ihre Reihenfolge
      // uebernimmt, zeichnet jede Zeitachse von rechts nach links — am Geraet
      // stand unter dem Verlauf `01.26 · 12.25 · 11.25`, also eine steigende
      // Kurve, die in Wahrheit faellt. Der Vorgaengertest hielt genau diese
      // Reihenfolge fest; sie war nie entschieden, sondern aus der
      // Inline-Berechnung in Dashboard.tsx uebernommen.
      const txs = [
        makeTx({ date: '2026-01-20', amount: 10 }),
        makeTx({ date: '2026-01-05', amount: 20 }),
        makeTx({ date: '2026-01-20', amount: 5 }),
      ];
      const series = buildIncomeExpenseSeries(txs, 'daily');
      expect(series.map((p) => p.date)).toEqual(['05.01.', '20.01.']);
      expect(series).toEqual([
        { date: '05.01.', income: 20, expenses: 0 },
        { date: '20.01.', income: 15, expenses: 0 },
      ]);
    });

    it('[REGRESSION] sollte über den Jahreswechsel richtig sortieren', () => {
      // Ueber die Beschriftung zu sortieren waere hier falsch: `01.26` steht
      // lexikalisch vor `12.25`, chronologisch dahinter. Und `dd.MM.` traegt
      // gar kein Jahr.
      const txs = [
        makeTx({ date: '2026-01-10', amount: 10 }),
        makeTx({ date: '2025-12-10', amount: 20 }),
        makeTx({ date: '2025-11-10', amount: 30 }),
      ];
      expect(buildIncomeExpenseSeries(txs, 'monthly').map((p) => p.date)).toEqual([
        '11.25',
        '12.25',
        '01.26',
      ]);
    });
  });
});

describe('computeTotalFlow', () => {
  describe('Happy Path', () => {
    it('sollte alle Beträge (inkl. Transfers) aufsummieren', () => {
      const txs = [makeTx({ amount: 100 }), makeTx({ amount: -30 }), makeTx({ amount: 50, is_transfer: true })];
      expect(computeTotalFlow(txs)).toBe(120);
    });
  });

  describe('Edge Cases', () => {
    it('sollte leeres Array zu 0 verarbeiten', () => {
      expect(computeTotalFlow([])).toBe(0);
    });
  });
});

describe('computeAutoStartingBalance', () => {
  describe('Happy Path', () => {
    it('sollte Endsaldo minus Gesamtfluss berechnen', () => {
      expect(computeAutoStartingBalance(1000, 200)).toBe(800);
    });
  });

  describe('Edge Cases', () => {
    it('sollte bei NaN-Ergebnis 0 zurückgeben', () => {
      expect(computeAutoStartingBalance(NaN, 100)).toBe(0);
    });

    it('sollte bei Infinity-Ergebnis 0 zurückgeben', () => {
      expect(computeAutoStartingBalance(Infinity, -Infinity)).toBe(0);
    });

    it('sollte negative Ergebnisse zulassen (finit)', () => {
      expect(computeAutoStartingBalance(0, 500)).toBe(-500);
    });
  });
});

describe('buildBalanceHistory', () => {
  describe('Happy Path', () => {
    it('sollte pro Tag income/expenses/balance/cumulative korrekt berechnen', () => {
      const txs = [
        makeTx({ date: '2026-01-01', amount: 100 }),
        makeTx({ date: '2026-01-02', amount: -30 }),
      ];
      const history = buildBalanceHistory(txs, 1000);
      expect(history).toEqual([
        { iso: '2026-01-01', label: '01.01', income: 100, expenses: 0, balance: 100, cumulative: 1100 },
        { iso: '2026-01-02', label: '02.01', income: 0, expenses: 30, balance: -30, cumulative: 1070 },
      ]);
    });
  });

  describe('Edge Cases', () => {
    it('sollte leeres Array zu leerem Array verarbeiten', () => {
      expect(buildBalanceHistory([], 500)).toEqual([]);
    });
  });

  describe('Regression Protection', () => {
    it('[REGRESSION] sollte die Saldo-Historie deterministisch aufsteigend und kumulativ korrekt aufbauen', () => {
      // Unsortierte Eingabe + mehrere Buchungen am selben Tag
      const txs = [
        makeTx({ date: '2026-01-10', amount: -20 }),
        makeTx({ date: '2026-01-05', amount: 100 }),
        makeTx({ date: '2026-01-05', amount: -10 }),
        makeTx({ date: '2026-01-01', amount: 50 }),
      ];
      const history = buildBalanceHistory(txs, 0);

      // Aufsteigend nach ISO-Datum
      expect(history.map((p) => p.iso)).toEqual(['2026-01-01', '2026-01-05', '2026-01-10']);

      // Tag 1: +50 -> cumulative 50
      expect(history[0]).toEqual({ iso: '2026-01-01', label: '01.01', income: 50, expenses: 0, balance: 50, cumulative: 50 });
      // Tag 2: +100 -10 = +90 -> cumulative 140
      expect(history[1]).toEqual({ iso: '2026-01-05', label: '05.01', income: 100, expenses: 10, balance: 90, cumulative: 140 });
      // Tag 3: -20 -> cumulative 120
      expect(history[2]).toEqual({ iso: '2026-01-10', label: '10.01', income: 0, expenses: 20, balance: -20, cumulative: 120 });
    });

    it('[REGRESSION] sollte die Eingabe nicht mutieren (Kopie vor dem Sortieren)', () => {
      const txs = [makeTx({ date: '2026-01-10', amount: 1 }), makeTx({ date: '2026-01-01', amount: 2 })];
      const original = [...txs];
      buildBalanceHistory(txs, 0);
      expect(txs).toEqual(original);
    });
  });
});
