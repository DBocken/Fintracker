import {
  parseISO,
  format,
  addMonths,
  differenceInCalendarMonths,
  differenceInCalendarDays,
} from 'date-fns';
import type { ReplacementPlan, PriceMode } from '@/lib/schemas/replacement-plan.schema';

export type { ReplacementPlan, PriceMode };

/**
 * Reine Domänenlogik der lebensdauerbasierten Ersatzplanung (kein React, kein I/O).
 *
 * KERNPRINZIP — Drei streng getrennte finanzielle Sichten (Roadmap AD3). Es gibt
 * keine doppelte oder dreifache Erfassung derselben Kosten:
 *   (a) ökonomische monatliche Nutzungskosten  → reine Analytik, NIE Cashflow
 *   (b) Rücklagenbewegung (monatlicher Beitrag) → Transfer, kontoneutral
 *   (c) tatsächlicher Ersatz-Cashflow           → einziger saldowirksamer Posten
 *
 * In Slice A1 werden diese Sichten nur ANGEZEIGT/berechnet — nichts fließt in die
 * Forecast-Engine (`ForecastInput`). Die Forecast-Integration erfolgt in A2 (#240).
 */

const ISO = 'yyyy-MM-dd';
const DAYS_PER_YEAR = 365.25;

/** Standard-Inflationsrate p. a. (Entscheidung D2 — lokal konfigurierbar, pro Plan überschreibbar). */
export const DEFAULT_INFLATION_RATE = 0.02;

/**
 * Preis-Variationskoeffizient je Modus (Preisunsicherheit, nicht Drift). „stabil"
 * am engsten, „individuell" am weitesten. Bewusst konservative Defaults (D6).
 */
export const PRICE_CV_BY_MODE: Record<PriceMode, number> = {
  stable: 0.05,
  inflation: 0.1,
  individual: 0.15,
};

export function priceUncertaintyCv(plan: ReplacementPlan): number {
  return PRICE_CV_BY_MODE[plan.price_mode];
}

export interface ReplacementConfig {
  /** „Heute" als ISO-Anker (macht die Berechnungen deterministisch testbar). */
  today: string;
  /** Rate für `price_mode='inflation'`. Default: DEFAULT_INFLATION_RATE. */
  inflationRate?: number;
}

function resolveInflationRate(config: ReplacementConfig): number {
  return config.inflationRate ?? DEFAULT_INFLATION_RATE;
}

/** Jährliche Preis-Änderungsrate je Modus (stabil = 0, individuell = eigene Rate). */
export function effectivePriceRate(plan: ReplacementPlan, config: ReplacementConfig): number {
  switch (plan.price_mode) {
    case 'stable':
      return 0;
    case 'inflation':
      return resolveInflationRate(config);
    case 'individual':
      return plan.price_rate_annual ?? resolveInflationRate(config);
  }
}

/**
 * Auflösung des Ersatztermins (Stufe A1, deterministisch):
 * 1. expliziter Fixtermin, sonst
 * 2. Kaufdatum + Lebensdauer, sonst
 * 3. heute + Restlebensdauer, sonst
 * 4. heute + Lebensdauer.
 */
export function resolveReplacementDate(plan: ReplacementPlan, config: ReplacementConfig): string {
  if (plan.planned_replacement_date) return plan.planned_replacement_date;
  if (plan.purchase_date) {
    return format(addMonths(parseISO(plan.purchase_date), plan.lifespan_months), ISO);
  }
  if (plan.remaining_lifespan_months != null) {
    return format(addMonths(parseISO(config.today), plan.remaining_lifespan_months), ISO);
  }
  return format(addMonths(parseISO(config.today), plan.lifespan_months), ISO);
}

function yearsUntil(fromISO: string, toISO: string): number {
  const days = differenceInCalendarDays(parseISO(toISO), parseISO(fromISO));
  return Math.max(0, days / DAYS_PER_YEAR);
}

export function monthsUntilReplacement(plan: ReplacementPlan, config: ReplacementConfig): number {
  const replacementDate = resolveReplacementDate(plan, config);
  return Math.max(0, differenceInCalendarMonths(parseISO(replacementDate), parseISO(config.today)));
}

/**
 * Preisentwickelter Wiederbeschaffungspreis in Cent zum Ersatztermin.
 * `stable` lässt den Preis unverändert; sonst wächst er mit `(1 + rate)^Jahre`.
 */
export function developedReplacementCostMinor(
  plan: ReplacementPlan,
  config: ReplacementConfig,
): number {
  const rate = effectivePriceRate(plan, config);
  if (rate === 0) return plan.replacement_cost_minor;
  const years = yearsUntil(config.today, resolveReplacementDate(plan, config));
  return Math.round(plan.replacement_cost_minor * Math.pow(1 + rate, years));
}

// --- Die drei getrennten Sichten -------------------------------------------

/**
 * (a) Ökonomische monatliche Nutzungskosten — reine Analytik in heutigem Geld:
 * der Wiederbeschaffungswert (abzüglich Restwert), amortisiert über die
 * Lebensdauer. Diese Zahl ist bewusst inflationsneutral und NIE ein Cashflow.
 */
export function monthlyUsageCostMinor(plan: ReplacementPlan): number {
  const net = plan.replacement_cost_minor - (plan.residual_value_minor ?? 0);
  return Math.round(net / plan.lifespan_months);
}

/**
 * (b) Monatlicher Rücklagenbedarf — Zielbetrag ist der ZUKÜNFTIGE (preisentwickelte)
 * Ersatzpreis abzüglich bereits vorhandener Rücklage, verteilt auf die verbleibenden
 * Monate. Muster: `calculateRequiredContribution` (src/lib/forecast.ts).
 */
export function monthlyReserveContributionMinor(
  plan: ReplacementPlan,
  config: ReplacementConfig,
): number {
  const target = developedReplacementCostMinor(plan, config);
  const remaining = Math.max(0, target - plan.reserve_minor);
  const months = Math.max(1, monthsUntilReplacement(plan, config));
  return Math.round(remaining / months);
}

export interface ReplacementCashflow {
  date: string;
  /** Abfluss beim Ersatz (preisentwickelter Preis), in Cent. */
  outflowMinor: number;
  /** Separater Zufluss durch den Restwert, in Cent (kein Netting — Invariante 1). */
  residualInflowMinor: number;
}

/**
 * (c) Tatsächlicher Ersatz-Cashflow: der einzige saldowirksame Posten. Restwert
 * ist ein SEPARATER Zufluss, nicht gegen den Abfluss verrechnet (Entscheidung D5).
 */
export function replacementCashflow(
  plan: ReplacementPlan,
  config: ReplacementConfig,
): ReplacementCashflow {
  return {
    date: resolveReplacementDate(plan, config),
    outflowMinor: developedReplacementCostMinor(plan, config),
    residualInflowMinor: plan.residual_value_minor ?? 0,
  };
}

export interface ReplacementViewModel {
  replacementDate: string;
  monthsUntilReplacement: number;
  developedReplacementCostMinor: number;
  /** (a) reine Analytik — kein Cashflow. */
  monthlyUsageCostMinor: number;
  /** (b) Rücklagenbewegung (Transfer). */
  monthlyReserveContributionMinor: number;
  /** (c) tatsächlicher Ersatz-Cashflow. */
  cashflow: ReplacementCashflow;
}

/** Bündelt die drei Sichten für die Anzeige — jede klar getrennt beschriftet. */
export function buildReplacementViewModel(
  plan: ReplacementPlan,
  config: ReplacementConfig,
): ReplacementViewModel {
  return {
    replacementDate: resolveReplacementDate(plan, config),
    monthsUntilReplacement: monthsUntilReplacement(plan, config),
    developedReplacementCostMinor: developedReplacementCostMinor(plan, config),
    monthlyUsageCostMinor: monthlyUsageCostMinor(plan),
    monthlyReserveContributionMinor: monthlyReserveContributionMinor(plan, config),
    cashflow: replacementCashflow(plan, config),
  };
}
