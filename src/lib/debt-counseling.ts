// Brücke zwischen Schuldenabbauplan (DebtsPage) und der RDG-konformen
// Schuldnerberatungs-Empfehlung (debt-guardrails-service, Issue #50, Epic #24).
//
// Reine Funktionen: sie übersetzen die auf der DebtsPage vorhandenen Zahlen
// (Tilgungsplan + grobe Einkommens-/Ausgaben-Mittel) in den Eingabe-Typ der
// Überschuldungs-Heuristik. Damit bleibt die UI dünn und alles testbar.

import {
  counselingRecommendation,
  type CounselingRecommendation,
  type OverindebtednessInput,
} from "@/services/debt-guardrails-service";

/** Minimaler Ausschnitt des Tilgungsplans, den wir hier brauchen. */
export interface PayoffPlanShape {
  totalMonths: number;
  insufficientBudget: boolean;
}

/**
 * Plandauer für die Heuristik. `insufficientBudget` bedeutet, dass das Budget
 * nicht einmal die Mindestraten deckt — der Plan geht also nie auf → `null`.
 * Ohne Schulden ist `totalMonths` 0; das ist kein Überschuldungssignal.
 */
export function payoffPlanToPlanMonths(plan: PayoffPlanShape): number | null {
  return plan.insufficientBudget ? null : plan.totalMonths;
}

/**
 * Grobschätzung des monatlich für Schulden verfügbaren Einkommens:
 * Einkommen − Lebenshaltung (Ausgaben ohne die bereits enthaltenen Mindestraten).
 * Da die Mindestraten in den gemessenen Ausgaben stecken, werden sie zurück-
 * addiert, um den für Tilgung verfügbaren Spielraum zu erhalten.
 *
 * Ist kein verlässliches Einkommen bekannt (≤ 0, z. B. ohne Umsätze/Demo),
 * geben wir +Infinity zurück, damit der einkommensbasierte Auslöser NICHT
 * fälschlich anschlägt — die plan-basierten Auslöser bleiben unberührt.
 */
export function estimateAvailableIncome(
  monthlyIncome: number,
  monthlyExpenses: number,
  minPayments: number,
): number {
  if (!(monthlyIncome > 0)) return Number.POSITIVE_INFINITY;
  return Math.max(0, monthlyIncome - monthlyExpenses + minPayments);
}

export interface DebtCounselingAssessmentInput {
  plan: PayoffPlanShape;
  /** Geplante monatliche Gesamtrate (Mindestraten + Extra-Budget). */
  monthlyRate: number;
  /** Summe der Mindestraten über alle Schulden. */
  minPayments: number;
  /** Durchschnittliches Monatseinkommen (0 = unbekannt). */
  monthlyIncome: number;
  /** Durchschnittliche Monatsausgaben. */
  monthlyExpenses: number;
}

/**
 * Setzt die DebtsPage-Zahlen zusammen und liefert die Beratungs-Empfehlung.
 * Empfohlen wird, wenn der Plan nie aufgeht, länger als die Restschuld-
 * befreiungsdauer läuft, oder die Raten den verfügbaren Spielraum übersteigen.
 */
export function assessDebtCounseling(
  input: DebtCounselingAssessmentInput,
): CounselingRecommendation {
  const overindebtedness: OverindebtednessInput = {
    monthlyRate: input.monthlyRate,
    availableIncome: estimateAvailableIncome(
      input.monthlyIncome,
      input.monthlyExpenses,
      input.minPayments,
    ),
    planMonths: payoffPlanToPlanMonths(input.plan),
  };
  return counselingRecommendation(overindebtedness);
}
