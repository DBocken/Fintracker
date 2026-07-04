/**
 * Reine Logik für den „Überschuss anlegen"-Sweep (Tagesgeld/ETF). Bewusst ohne
 * Zahlungsauslösung: Das Ergebnis steuert nur Vorschlag, GiroCode-Betrag und das
 * Prognose-Gate. Die eigentliche Forecast-/IBAN-Beschaffung passiert im Service.
 */

import { t } from '../i18n/serviceT';

export interface SweepGateInput {
  /** Gewünschter Sweep-Betrag (z. B. angesparter Überschuss). */
  desiredAmount: number;
  /** Prognostizierter Tiefststand der verfügbaren Liquidität im Horizont. */
  projectedMinBalance: number;
  /** Sicherheitspuffer, der nach dem Sweep erhalten bleiben muss. */
  safetyBuffer: number;
}

export interface SweepGateResult {
  /** true, wenn ein (Teil-)Sweep sicher möglich ist. */
  safe: boolean;
  /** Sicher abführbarer Betrag (0..desiredAmount), auf volle EUR abgerundet. */
  safeAmount: number;
  /** Kurzbegründung für die UI. */
  reason: string;
}

/**
 * Entscheidet, wie viel vom gewünschten Überschuss sich abführen lässt, ohne den
 * Sicherheitspuffer im Prognosehorizont zu reißen. Reicht der Spielraum nur teil-
 * weise, wird auf den sicheren Betrag gekürzt (kein Alles-oder-nichts).
 */
export function evaluateSweepGate(input: SweepGateInput): SweepGateResult {
  const headroom = input.projectedMinBalance - input.safetyBuffer;
  if (!(headroom > 0)) {
    return { safe: false, safeAmount: 0, reason: t('budgetSweep.insufficientLiquidity') };
  }
  const safeAmount = Math.floor(Math.min(input.desiredAmount, headroom));
  if (safeAmount <= 0) {
    return { safe: false, safeAmount: 0, reason: t('budgetSweep.noAvailableAmount') };
  }
  if (safeAmount < input.desiredAmount) {
    return {
      safe: true,
      safeAmount,
      reason: t('budgetSweep.partialSweepAvailable').replace('{amount}', String(safeAmount)),
    };
  }
  return { safe: true, safeAmount, reason: t('budgetSweep.sweepSuccess') };
}

export interface BalancePoint {
  date: string; // ISO YYYY-MM-DD
  balance: number;
}

/**
 * Niedrigster Saldo der Punkte innerhalb von `horizonDays` ab `startISO`.
 * Liefert `+Infinity`, wenn keine Punkte im Fenster liegen (= keine Restriktion,
 * Gate blockiert dann nicht).
 */
export function minBalanceWithinHorizon(points: BalancePoint[], startISO: string, horizonDays: number): number {
  const start = new Date(startISO).getTime();
  const cutoff = start + horizonDays * 24 * 60 * 60 * 1000;
  let min = Number.POSITIVE_INFINITY;
  for (const p of points) {
    const t = new Date(p.date).getTime();
    if (t < start || t > cutoff) continue;
    if (p.balance < min) min = p.balance;
  }
  return min;
}

/**
 * Endwert eines monatlichen Sparplans (nachschüssig) bei konstanter Jahresrendite.
 * Aufklärung, keine Anlageberatung. Bei Rendite 0 = Summe der Einzahlungen.
 */
export function projectMonthlyInvestment(monthly: number, years: number, annualRatePct: number): number {
  const months = Math.round(years * 12);
  const r = annualRatePct / 100 / 12;
  if (r === 0) return monthly * months;
  return monthly * ((Math.pow(1 + r, months) - 1) / r);
}
