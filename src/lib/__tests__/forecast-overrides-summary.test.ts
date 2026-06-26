import { describe, expect, it } from 'vitest';
import { summarizeOverrides } from '../forecast-overrides-summary';
import { DEFAULT_FORECAST_OVERRIDES } from '@/services/forecast-overrides-service';
import type { ForecastOverrides } from '@/services/forecast-overrides-service';
import type { RecurringFlow } from '@/lib/forecast-types';

const flows: RecurringFlow[] = [
  { id: 'rent', name: 'Miete', amount: -850, cadence: 'monthly', anchorDate: '2026-01-01', accountId: 'giro' },
  { id: 'salary', name: 'Gehalt', amount: 3200, cadence: 'monthly', anchorDate: '2026-01-01', accountId: 'giro' },
];

function make(patch: Partial<ForecastOverrides>): ForecastOverrides {
  return { ...DEFAULT_FORECAST_OVERRIDES, ...patch };
}

describe('summarizeOverrides', () => {
  // Gruppe 1: Normales Verhalten
  describe('Normal Behavior', () => {
    it('sollte ohne Overrides eine leere Liste liefern', () => {
      expect(summarizeOverrides(make({}), { flows })).toEqual([]);
    });

    it('sollte einen deaktivierten Vertrag als Chip melden', () => {
      const o = make({ recurringFlowOverrides: { rent: { enabled: false } } });
      const chips = summarizeOverrides(o, { flows });
      expect(chips).toHaveLength(1);
      expect(chips[0].kind).toBe('flow-disabled');
      expect(chips[0].label).toContain('Miete');
      expect(chips[0].source).toBe('recurringFlowOverrides');
      expect(chips[0].key).toBe('rent');
      expect(chips[0].field).toBe('enabled');
    });

    it('sollte ein End-Datum eines Vertrags lesbar formatieren (d.m.yyyy)', () => {
      const o = make({ recurringFlowOverrides: { rent: { endDate: '2026-12-31' } } });
      const chips = summarizeOverrides(o, { flows });
      expect(chips).toHaveLength(1);
      expect(chips[0].kind).toBe('flow-enddate');
      expect(chips[0].label).toContain('Miete');
      expect(chips[0].label).toContain('31.12.2026');
      expect(chips[0].field).toBe('endDate');
    });

    it('sollte einen Betrags-Override eines Vertrags melden', () => {
      const o = make({ recurringFlowOverrides: { salary: { amount: 3600 } } });
      const chips = summarizeOverrides(o, { flows });
      expect(chips).toHaveLength(1);
      expect(chips[0].kind).toBe('flow-amount');
      expect(chips[0].label).toContain('Gehalt');
      expect(chips[0].label).toContain('3.600');
      expect(chips[0].field).toBe('amount');
    });

    it('sollte mehrere Aspekte eines Vertrags als getrennte Chips melden', () => {
      const o = make({ recurringFlowOverrides: { rent: { amount: -900, endDate: '2026-12-31' } } });
      const chips = summarizeOverrides(o, { flows });
      expect(chips).toHaveLength(2);
      expect(chips.map((c) => c.field).sort()).toEqual(['amount', 'endDate']);
    });

    it('sollte ein Budget-Override als Chip melden', () => {
      const o = make({ categoryBudgets: { Lebensmittel: 400 } });
      const chips = summarizeOverrides(o, { flows });
      expect(chips).toHaveLength(1);
      expect(chips[0].kind).toBe('budget');
      expect(chips[0].label).toContain('Lebensmittel');
      expect(chips[0].label).toContain('400');
      expect(chips[0].source).toBe('categoryBudgets');
      expect(chips[0].key).toBe('Lebensmittel');
    });

    it('sollte einen geplanten Posten mit Vorzeichen und Datum melden', () => {
      const o = make({
        plannedEvents: [{ id: 'ev1', name: 'Urlaub', amount: -800, date: '2026-07-01', accountId: 'giro' }],
      });
      const chips = summarizeOverrides(o, { flows });
      expect(chips).toHaveLength(1);
      expect(chips[0].kind).toBe('event');
      expect(chips[0].label).toContain('Urlaub');
      expect(chips[0].label).toContain('800');
      expect(chips[0].label).toContain('01.07.2026');
      expect(chips[0].source).toBe('plannedEvents');
      expect(chips[0].key).toBe('ev1');
    });

    it('sollte positive Posten mit Plus-Zeichen kennzeichnen', () => {
      const o = make({
        plannedEvents: [{ id: 'ev2', name: 'Bonus', amount: 1500, date: '2026-09-01', accountId: 'giro' }],
      });
      const chips = summarizeOverrides(o, { flows });
      expect(chips[0].label).toContain('+');
      expect(chips[0].label).toContain('1.500');
    });

    it('sollte einen Transfer melden', () => {
      const o = make({
        transfers: [{ id: 'tf1', amount: 500, fromAccountId: 'giro', toAccountId: 'spar', date: '2026-08-01' }],
      });
      const chips = summarizeOverrides(o, { flows });
      expect(chips).toHaveLength(1);
      expect(chips[0].kind).toBe('transfer');
      expect(chips[0].source).toBe('transfers');
      expect(chips[0].key).toBe('tf1');
    });

    it('sollte eine Rücklage melden', () => {
      const o = make({
        sinkingFunds: [{ id: 'sf1', name: 'Kfz-Steuer', targetAmount: 300, dueDate: '2026-11-01', accountId: 'spar' }],
      });
      const chips = summarizeOverrides(o, { flows });
      expect(chips).toHaveLength(1);
      expect(chips[0].kind).toBe('fund');
      expect(chips[0].label).toContain('Kfz-Steuer');
    });

    it('sollte alle Änderungstypen zusammen zählen', () => {
      const o = make({
        recurringFlowOverrides: { rent: { enabled: false } },
        categoryBudgets: { Lebensmittel: 400 },
        plannedEvents: [{ id: 'ev1', name: 'Urlaub', amount: -800, date: '2026-07-01', accountId: 'giro' }],
        transfers: [{ id: 'tf1', amount: 500, fromAccountId: 'giro', toAccountId: 'spar', date: '2026-08-01' }],
      });
      expect(summarizeOverrides(o, { flows })).toHaveLength(4);
    });
  });

  // Gruppe 2: Edge Cases
  describe('Edge Cases', () => {
    it('sollte unbekannte Flow-IDs robust mit der ID als Namen darstellen', () => {
      const o = make({ recurringFlowOverrides: { ghost: { enabled: false } } });
      const chips = summarizeOverrides(o, { flows });
      expect(chips).toHaveLength(1);
      expect(chips[0].label).toContain('ghost');
    });

    it('sollte ohne flows-Argument nicht abstürzen', () => {
      const o = make({ recurringFlowOverrides: { rent: { enabled: false } } });
      expect(() => summarizeOverrides(o)).not.toThrow();
    });

    it('sollte enabled=true (Default) NICHT als Änderung melden', () => {
      const o = make({ recurringFlowOverrides: { rent: { enabled: true } } });
      expect(summarizeOverrides(o, { flows })).toEqual([]);
    });

    it('sollte ein leeres Override-Objekt ignorieren', () => {
      const o = make({ recurringFlowOverrides: { rent: {} } });
      expect(summarizeOverrides(o, { flows })).toEqual([]);
    });

    it('sollte ungültige Datumsstrings unverändert durchreichen', () => {
      const o = make({ recurringFlowOverrides: { rent: { endDate: 'kaputt' } } });
      const chips = summarizeOverrides(o, { flows });
      expect(chips[0].label).toContain('kaputt');
    });

    it('sollte jeder Chip eine eindeutige id geben', () => {
      const o = make({
        recurringFlowOverrides: { rent: { amount: -900, endDate: '2026-12-31' } },
        categoryBudgets: { Lebensmittel: 400 },
      });
      const chips = summarizeOverrides(o, { flows });
      const ids = chips.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});
