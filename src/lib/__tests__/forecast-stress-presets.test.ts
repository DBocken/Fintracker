import { describe, expect, it } from 'vitest';
import { buildStressOverrides, type StressPresetContext } from '../forecast-stress-presets';
import { DEFAULT_FORECAST_OVERRIDES } from '@/services/forecast-overrides-service';
import type { ForecastOverrides } from '@/services/forecast-overrides-service';
import type { VariableExpenseBaseline } from '@/lib/forecast-types';

const variableExpenses: VariableExpenseBaseline[] = [
  { category: 'Lebensmittel', monthlyAmount: 400 },
  { category: 'Freizeit', monthlyAmount: 150 },
];

function make(patch: Partial<ForecastOverrides> = {}): ForecastOverrides {
  return { ...DEFAULT_FORECAST_OVERRIDES, ...patch };
}

// Deterministische ids, damit Tests stabil bleiben (die UI reicht eine
// Date.now()-basierte Variante ein).
const ctx: StressPresetContext = {
  startISO: '2026-01-15',
  accountId: 'giro',
  variableExpenses,
  makeId: (s) => `stress-${s}`,
};

describe('buildStressOverrides', () => {
  // Gruppe 1: Normales Verhalten
  describe('Normal Behavior', () => {
    it('sollte eine Anschaffung als einzelnen Abfluss-Posten zum Stichtag eintragen', () => {
      const patch = buildStressOverrides(make(), { kind: 'purchase', amount: 3000, inDays: 60 }, ctx);
      expect(patch.plannedEvents).toHaveLength(1);
      const ev = patch.plannedEvents![0];
      expect(ev.name).toBe('Anschaffung');
      expect(ev.amount).toBe(-3000);
      expect(ev.accountId).toBe('giro');
      // 2026-01-15 + 60 Tage = 2026-03-16
      expect(ev.date).toBe('2026-03-16');
    });

    it('sollte einen Einkommensausfall in monatliche Abfluss-Posten zerlegen', () => {
      const patch = buildStressOverrides(
        make(),
        { kind: 'income-loss', monthlyLoss: 2000, months: 3 },
        ctx,
      );
      expect(patch.plannedEvents).toHaveLength(3);
      expect(patch.plannedEvents!.every((e) => e.amount === -2000)).toBe(true);
      expect(patch.plannedEvents!.map((e) => e.date)).toEqual([
        '2026-01-15',
        '2026-02-15',
        '2026-03-15',
      ]);
      expect(patch.plannedEvents![0].name).toContain('Einkommensausfall');
    });

    it('sollte höhere Lebenshaltung als skalierte Budgets je Kategorie eintragen', () => {
      const patch = buildStressOverrides(make(), { kind: 'higher-cost', percent: 20 }, ctx);
      expect(patch.categoryBudgets).toEqual({
        Lebensmittel: 480, // 400 * 1.2
        Freizeit: 180, // 150 * 1.2
      });
    });

    it('sollte Schock + Kompensation als zwei Posten mit getrennten Vorzeichen eintragen', () => {
      const patch = buildStressOverrides(
        make(),
        { kind: 'shock-recovery', shock: 4500, shockInDays: 25, recovery: 1800, recoveryInDays: 70 },
        ctx,
      );
      expect(patch.plannedEvents).toHaveLength(2);
      const [shock, recovery] = patch.plannedEvents!;
      expect(shock.name).toBe('Schock');
      expect(shock.amount).toBe(-4500);
      expect(shock.date).toBe('2026-02-09'); // +25 Tage
      expect(recovery.name).toBe('Kompensation');
      expect(recovery.amount).toBe(1800);
      expect(recovery.date).toBe('2026-03-26'); // +70 Tage
    });

    it('sollte bestehende geplante Posten erhalten (anhängen statt ersetzen)', () => {
      const existing = make({
        plannedEvents: [
          { id: 'keep', name: 'Urlaub', amount: -800, date: '2026-05-01', accountId: 'giro' },
        ],
      });
      const patch = buildStressOverrides(existing, { kind: 'purchase', amount: 1000, inDays: 10 }, ctx);
      expect(patch.plannedEvents).toHaveLength(2);
      expect(patch.plannedEvents![0].id).toBe('keep');
      expect(patch.plannedEvents![1].name).toBe('Anschaffung');
    });

    it('sollte bestehende Budgets anderer Kategorien bei höherer Lebenshaltung behalten', () => {
      const existing = make({ categoryBudgets: { Miete: 850 } });
      const patch = buildStressOverrides(existing, { kind: 'higher-cost', percent: 10 }, ctx);
      expect(patch.categoryBudgets).toEqual({
        Miete: 850,
        Lebensmittel: 440,
        Freizeit: 165,
      });
    });
  });

  // Gruppe 2: Edge Cases
  describe('Edge Cases', () => {
    it('sollte negative Eingabebeträge robust als Abfluss behandeln', () => {
      const patch = buildStressOverrides(make(), { kind: 'purchase', amount: -3000, inDays: 5 }, ctx);
      expect(patch.plannedEvents![0].amount).toBe(-3000);
    });

    it('sollte höhere Lebenshaltung ohne variable Ausgaben leer lassen', () => {
      const patch = buildStressOverrides(
        make(),
        { kind: 'higher-cost', percent: 20 },
        { ...ctx, variableExpenses: [] },
      );
      expect(patch.categoryBudgets).toBeUndefined();
    });

    it('sollte für jeden erzeugten Posten eine eindeutige id vergeben', () => {
      const patch = buildStressOverrides(
        make(),
        { kind: 'income-loss', monthlyLoss: 1000, months: 4 },
        ctx,
      );
      const ids = patch.plannedEvents!.map((e) => e.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('[REGRESSION] sollte Monatsgrenzen am Monatsende korrekt überspringen', () => {
      // Start am 31.: Februar hat keinen 31. – date-fns klemmt auf den letzten Tag.
      const patch = buildStressOverrides(
        make(),
        { kind: 'income-loss', monthlyLoss: 500, months: 2 },
        { ...ctx, startISO: '2026-01-31' },
      );
      expect(patch.plannedEvents!.map((e) => e.date)).toEqual(['2026-01-31', '2026-02-28']);
    });

    it('sollte gerundete Budgetwerte liefern (keine krummen Cent-Beträge)', () => {
      const patch = buildStressOverrides(
        make(),
        { kind: 'higher-cost', percent: 33 },
        { ...ctx, variableExpenses: [{ category: 'Lebensmittel', monthlyAmount: 400 }] },
      );
      // 400 * 1.33 = 532 (ganzzahlig hier, prüft die Rundungsstrategie)
      expect(patch.categoryBudgets!.Lebensmittel).toBe(532);
    });
  });
});
