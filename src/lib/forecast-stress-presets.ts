/**
 * Stresstest-Presets als benannte Planungs-Annahmen.
 *
 * Früher waren „Anschaffung / Einkommensausfall / höhere Lebenshaltung / Schock"
 * eine ZWEITE Eingabefläche (FinRisk-Szenario-Chips), die an den Overrides
 * vorbei direkt in die Simulation lief. Das verwirrt: der Nutzer trug Annahmen an
 * zwei Stellen ein und sah sie nur an einer. Diese reinen Funktionen übersetzen
 * jedes Preset in echte {@link ForecastOverrides}-Einträge mit passenden Namen –
 * so erscheinen sie als „Aktive Annahmen", wirken auf die EINE Grafik und lassen
 * sich einzeln zurücknehmen. Kein paralleler Rechenweg mehr.
 */
import { addDays, addMonths, format, parseISO } from 'date-fns';
import type { ForecastOverrides } from '@/services/forecast-overrides-service';
import type { PlannedForecastEvent, VariableExpenseBaseline } from '@/lib/forecast-types';

export type StressPreset =
  | { kind: 'purchase'; amount: number; inDays: number }
  | { kind: 'income-loss'; monthlyLoss: number; months: number }
  | { kind: 'higher-cost'; percent: number }
  | {
      kind: 'shock-recovery';
      shock: number;
      shockInDays: number;
      recovery: number;
      recoveryInDays: number;
    };

export interface StressPresetContext {
  /** Forecast-Startdatum (ISO yyyy-mm-dd) – Anker für die relativen Tage. */
  startISO: string;
  /** Operatives Konto, dem die erzeugten Posten zugeordnet werden. */
  accountId: string;
  /** Variable Ausgaben-Baselines – Grundlage für die „teurer um %"-Skalierung. */
  variableExpenses?: VariableExpenseBaseline[];
  /**
   * id-Fabrik. Default ist deterministisch (für Tests); die UI reicht eine
   * eindeutige, Date.now()-basierte Variante ein, damit Mehrfach-Anlagen
   * kollisionsfrei bleiben.
   */
  makeId?: (suffix: string) => string;
}

/** ISO-Datum n Tage nach dem Start (date-only, keine Zeitzone). */
function dayAfter(startISO: string, n: number): string {
  return format(addDays(parseISO(startISO), n), 'yyyy-MM-dd');
}

/** ISO-Datum n Monate nach dem Start (date-fns klemmt Monatsenden korrekt). */
function monthAfter(startISO: string, n: number): string {
  return format(addMonths(parseISO(startISO), n), 'yyyy-MM-dd');
}

/**
 * Übersetzt ein Stresstest-Preset in einen Override-Patch, der direkt an
 * `updatePlanning`/`onChange` übergeben werden kann. Bestehende Annahmen bleiben
 * erhalten (Posten werden angehängt, Budgets feldweise gemischt).
 */
export function buildStressOverrides(
  overrides: ForecastOverrides,
  preset: StressPreset,
  ctx: StressPresetContext,
): Partial<ForecastOverrides> {
  const makeId = ctx.makeId ?? ((s: string) => `stress-${s}`);
  const account = ctx.accountId;

  const appendEvents = (events: PlannedForecastEvent[]): Partial<ForecastOverrides> => ({
    plannedEvents: [...overrides.plannedEvents, ...events],
  });

  switch (preset.kind) {
    case 'purchase':
      return appendEvents([
        {
          id: makeId('anschaffung'),
          name: 'Anschaffung',
          amount: -Math.abs(preset.amount),
          date: dayAfter(ctx.startISO, Math.max(0, Math.round(preset.inDays))),
          accountId: account,
        },
      ]);

    case 'income-loss': {
      const months = Math.max(1, Math.round(preset.months));
      const loss = Math.abs(preset.monthlyLoss);
      const events: PlannedForecastEvent[] = Array.from({ length: months }, (_, i) => ({
        id: makeId(`income-loss-${i}`),
        name: `Einkommensausfall ${i + 1}/${months}`,
        amount: -loss,
        date: monthAfter(ctx.startISO, i),
        accountId: account,
      }));
      return appendEvents(events);
    }

    case 'higher-cost': {
      const factor = 1 + preset.percent / 100;
      const baselines = ctx.variableExpenses ?? [];
      if (baselines.length === 0) return {};
      const categoryBudgets = { ...overrides.categoryBudgets };
      for (const b of baselines) {
        categoryBudgets[b.category] = Math.round(b.monthlyAmount * factor);
      }
      return { categoryBudgets };
    }

    case 'shock-recovery':
      return appendEvents([
        {
          id: makeId('schock'),
          name: 'Schock',
          amount: -Math.abs(preset.shock),
          date: dayAfter(ctx.startISO, Math.max(0, Math.round(preset.shockInDays))),
          accountId: account,
        },
        {
          id: makeId('kompensation'),
          name: 'Kompensation',
          amount: Math.abs(preset.recovery),
          date: dayAfter(ctx.startISO, Math.max(0, Math.round(preset.recoveryInDays))),
          accountId: account,
        },
      ]);
  }
}
