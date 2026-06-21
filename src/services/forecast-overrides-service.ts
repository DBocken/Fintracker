/**
 * Forecast-Overrides (Stufe 2: Planbarkeit)
 *
 * Nutzerseitige Planungs-Annahmen, die der Auto-Seed nicht aus den Daten
 * ableiten kann: Sicherheitspuffer, Horizont, Tagesgeld-Zinssätze,
 * Budget-Overrides, geplante Einmalposten, Rücklagen, Transfers und
 * Overrides für auto-erkannte wiederkehrende Zahlungen.
 *
 * Persistenz als versioniertes JSON im localStorage – gleiches Muster wie die
 * KPI-Präferenzen. Diese Werte sind Planungsannahmen, keine Rohkontodaten.
 */
import type { BufferBasis, PlannedForecastEvent, SinkingFund, ForecastTransfer } from '@/lib/forecast-types';
import type { ForecastScenario } from '@/lib/forecast-scenario-types';

const STORAGE_KEY = 'fintracker_forecast_overrides_v1';

/** Override für eine auto-erkannte wiederkehrende Zahlung. */
export interface RecurringFlowOverride {
  /** Ist die Zahlung aktiv? Default: true. */
  enabled?: boolean;
  /** Neuer Betrag (überschreibt den erkannten). */
  amount?: number;
  /** Neues End-Datum (ISO yyyy-mm-dd). */
  endDate?: string;
}

export interface ForecastOverrides {
  months: number;
  safetyBuffer: number;
  bufferBasis: BufferBasis;
  /** accountId -> jährlicher Zinssatz in Prozent. */
  accountInterest: Record<string, number>;
  /** Kategorie -> monatliches Budget (ersetzt die historische Baseline). */
  categoryBudgets: Record<string, number>;
  plannedEvents: PlannedForecastEvent[];
  sinkingFunds: SinkingFund[];
  transfers: ForecastTransfer[];
  /** flowId -> Overrides für auto-erkannte wiederkehrende Zahlungen. */
  recurringFlowOverrides: Record<string, RecurringFlowOverride>;
  /** Nutzerdefinierte Was-wäre-wenn-Szenarien (Stufe 3). */
  scenarios: ForecastScenario[];
}

export const DEFAULT_FORECAST_OVERRIDES: ForecastOverrides = {
  months: 6,
  safetyBuffer: 1000,
  bufferBasis: 'operating',
  accountInterest: {},
  categoryBudgets: {},
  plannedEvents: [],
  sinkingFunds: [],
  transfers: [],
  recurringFlowOverrides: {},
  scenarios: [],
};

function normalize(raw: Partial<ForecastOverrides> | null | undefined): ForecastOverrides {
  return {
    months: raw?.months ?? DEFAULT_FORECAST_OVERRIDES.months,
    safetyBuffer: raw?.safetyBuffer ?? DEFAULT_FORECAST_OVERRIDES.safetyBuffer,
    bufferBasis: raw?.bufferBasis ?? DEFAULT_FORECAST_OVERRIDES.bufferBasis,
    accountInterest: raw?.accountInterest ?? {},
    categoryBudgets: raw?.categoryBudgets ?? {},
    plannedEvents: Array.isArray(raw?.plannedEvents) ? raw!.plannedEvents! : [],
    sinkingFunds: Array.isArray(raw?.sinkingFunds) ? raw!.sinkingFunds! : [],
    transfers: Array.isArray(raw?.transfers) ? raw!.transfers! : [],
    recurringFlowOverrides: raw?.recurringFlowOverrides ?? {},
    scenarios: Array.isArray(raw?.scenarios) ? raw!.scenarios! : [],
  };
}

/** Liest die gespeicherten Overrides (mit Defaults für fehlende Felder). */
export function getForecastOverrides(): ForecastOverrides {
  if (typeof window === 'undefined') return { ...DEFAULT_FORECAST_OVERRIDES };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_FORECAST_OVERRIDES };
    return normalize(JSON.parse(raw) as Partial<ForecastOverrides>);
  } catch {
    return { ...DEFAULT_FORECAST_OVERRIDES };
  }
}

/** Persistiert die Overrides. */
export function saveForecastOverrides(overrides: ForecastOverrides): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalize(overrides)));
}
