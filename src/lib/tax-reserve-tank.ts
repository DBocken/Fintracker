/**
 * Pure Mathematik des Steuerrücklage-Tanks (Einzelunternehmer).
 *
 * Das ZIEL wird NIE persistiert, sondern immer abgeleitet: Prozent × YTD-
 * Betriebseinnahmen (aus buildEuerReport). „Zurückgelegt" ist die Summe der
 * Bewegungen (+ zurückgelegt, − Steuer gezahlt) — Quick-Actions, keine
 * Auto-Transfer-Erkennung (v1). `saved` bleibt ehrlich (kann negativ sein);
 * nur `fillRatio` clampt für die Anzeige auf 0..1.
 */
import type { TaxReserveMovement } from '@/types';

export interface TaxTankState {
  /** Abgeleitetes Ziel: percent × Betriebseinnahmen (≥ 0). */
  target: number;
  /** Σ Bewegungen — ehrlich, ohne Clamp. */
  saved: number;
  /** max(0, target − saved). */
  gap: number;
  /** Anzeige-Füllstand 0..1 (0, wenn target 0). */
  fillRatio: number;
  /** saved > target bei echtem Ziel (> 0). */
  overfunded: boolean;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function computeTaxTank(
  businessIncomeYtd: number,
  percent: number,
  movements: TaxReserveMovement[],
): TaxTankState {
  const income = Number.isFinite(businessIncomeYtd) && businessIncomeYtd > 0 ? businessIncomeYtd : 0;
  const pct = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;
  const target = round2(income * (pct / 100));
  const saved = round2(movements.reduce((sum, m) => sum + (Number.isFinite(m.amount) ? m.amount : 0), 0));
  const gap = round2(Math.max(0, target - saved));
  const fillRatio = target > 0 ? Math.max(0, Math.min(1, saved / target)) : 0;
  return {
    target,
    saved,
    gap,
    fillRatio,
    overfunded: target > 0 && saved > target,
  };
}
