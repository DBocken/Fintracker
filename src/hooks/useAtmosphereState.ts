/**
 * Atmosphäre-Status-Hook für FinTracker (WP-2.4).
 *
 * Leitet aggregierte Finanzkennzahlen in einen atmosphärischen Zustand ab,
 * der die visuelle Grundstimmung der App steuert (Hintergrund, Stadt-Wetter).
 *
 * Das Prinzip: Die Atmosphäre kommt VOR der Analyse — der Nutzer FÜHLT, ob
 * seine Finanzen stabil oder riskant sind, bevor er Zahlen liest.
 *
 * Die Ableitung ist bewusst konservativ: `alert` nur bei akutem Risiko
 * (negativer Saldo UND Budgets überschritten). Die Atmosphäre ist subtil,
 * nicht alarmierend.
 *
 * @see docs/aaa-plus/tdd-specs.md — WP-2.4
 */

import { useMemo } from 'react';
import { useReducedMotion } from './useReducedMotion';

/** Die temperaturartige Grundstimmung. */
export type AtmosphereTemperature = 'warm' | 'cool' | 'neutral';

/** Der Puls-Charakter: ruhig, aufmerksam, oder feiernd. */
export type AtmospherePulse = 'steady' | 'alert' | 'celebrate';

/** Vollständiger Atmosphäre-Zustand. */
export type AtmosphereState = {
  temperature: AtmosphereTemperature;
  intensity: number; // 0.0 bis 1.0
  pulse: AtmospherePulse;
};

/** Eingabedaten für die Atmosphäre-Ableitung. */
export type AtmosphereInput = {
  monthlyIncome: number;
  monthlyExpenses: number;
  hasData: boolean;
  budgetOvercount: number;
};

/**
 * Reine Funktion zur Ableitung des Atmosphäre-Zustands aus Finanzkennzahlen.
 * Kein React, kein I/O — vollständig testbar ohne Hook-Wrapper.
 */
export function deriveAtmosphere(input: AtmosphereInput): AtmosphereState {
  if (!input.hasData) {
    return { temperature: 'neutral', intensity: 0, pulse: 'steady' };
  }

  const balance = input.monthlyIncome - input.monthlyExpenses;
  const hasBudgetOver = input.budgetOvercount > 0;

  // Temperatur-Ableitung
  let temperature: AtmosphereTemperature;
  if (balance > 0 && !hasBudgetOver) {
    temperature = 'warm';
  } else if (balance < 0 || hasBudgetOver) {
    temperature = 'cool';
  } else {
    temperature = 'neutral';
  }

  // Intensity-Ableitung — proportional zur Stärke der Abweichung
  const absBalance = Math.abs(balance);
  const referenceIncome = Math.max(input.monthlyIncome, 1);
  const balanceRatio = absBalance / referenceIncome;
  // Clamp auf [0, 1], mit einer Sättigungskurve (sqrt)
  let intensity = Math.min(1, Math.sqrt(balanceRatio));
  // Budgetüberschreitungen erhöhen die Intensity leicht
  if (hasBudgetOver) {
    intensity = Math.min(1, intensity + 0.1 * input.budgetOvercount);
  }

  // Puls-Ableitung
  // alert nur bei akutem Risiko: negativer Saldo UND ≥1 Budget überzogen
  const isAcuteRisk = balance < 0 && hasBudgetOver;
  // celebrate bei sehr stark positivem Saldo (>50% Ersparnis)
  const isCelebrate = balance > 0 && balanceRatio > 0.5 && !hasBudgetOver;
  const pulse: AtmospherePulse = isAcuteRisk ? 'alert' : isCelebrate ? 'celebrate' : 'steady';

  // Bei neutraler Temperatur wird intensity auf 0 gesetzt
  if (temperature === 'neutral') {
    intensity = 0;
  }

  return { temperature, intensity, pulse };
}

/**
 * Hook, der den Atmosphäre-Zustand aus den aktuell verfügbaren Finanzdaten ableitet.
 *
 * Verwendet `useReducedMotion`: bei aktivierter Reduced-Motion ist `pulse`
 * immer `'steady'`.
 *
 * Der Hook liest keine Daten selbst — er akzeptiert die aggregierten Werte
 * als Props, sodass die aufrufende Komponente entscheidet, welche Queries
 * verwendet werden.
 */
export function useAtmosphereState(input: AtmosphereInput): AtmosphereState {
  const reduce = useReducedMotion();

  return useMemo(() => {
    const state = deriveAtmosphere(input);
    // Reduced Motion deaktiviert pulse
    if (reduce) {
      return { ...state, pulse: 'steady' as const };
    }
    return state;
  }, [input.monthlyIncome, input.monthlyExpenses, input.hasData, input.budgetOvercount, reduce]);
}
