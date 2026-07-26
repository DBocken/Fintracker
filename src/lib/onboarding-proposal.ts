/**
 * Vorschlag für Lebenssituation und Umstände aus den bereits importierten
 * Daten (`docs/tutorial-sequence.md`).
 *
 * Das ist der Grund, warum die Datenquellen-Weiche vor der Situationsfrage
 * steht: Sind Buchungen da, muss die App nicht mehr fragen, was sie ablesen
 * kann. Der Vorschlag ersetzt die Frage aber nicht — er belegt sie vor, und
 * der Nutzer bestätigt oder ändert.
 *
 * Die eigentliche Arbeit dieses Moduls ist die **Zurückhaltung**. Aus einem
 * Kontoauszug lässt sich vieles herauslesen; das meiste davon darf man
 * niemandem als Selbstbeschreibung vorsetzen. `onboarding-life-situations.md`
 * hält fest, warum es keine Status-Kacheln gibt („niemand klickt freiwillig
 * auf ein Etikett wie ‚verschuldet'"). Ein automatisch gesetztes Etikett wäre
 * dieselbe Zuschreibung, nur ungefragt — deshalb
 * {@link NEVER_PROPOSED_SITUATIONS}.
 *
 * Reine Domänenschicht: kein React, kein I/O (AGENTS.md §3). Die Signale
 * erhebt die Service-Schicht und reicht sie als Wert herein.
 */

import type { LifeSituationId, ModifierId } from './life-situations';

/** Was sich aus den Daten belastbar ablesen lässt — nicht mehr. */
export interface OnboardingSignals {
  /** Regelmäßiges Gehalt erkannt (`detectSalarySeries`, braucht 3 Monate). */
  hasRegularSalary: boolean;
  /** Einnahmen in Selbstständigkeits-/Creator-Kategorien. */
  hasSelfEmployedIncome: boolean;
  /** Einnahmen aus Rente oder Pension. */
  hasPensionIncome: boolean;
  /** Monatliche Einnahmen schwanken deutlich. */
  incomeVaries: boolean;
  /** Erfasste Schulden oder erkannte Kreditraten. */
  hasDebts: boolean;
  /** Depot oder Wertpapierbestand vorhanden. */
  hasInvestments: boolean;
}

export interface OnboardingProposal {
  /** `null` = kein belastbarer Vorschlag; dann wird normal gefragt. */
  lifeSituation: LifeSituationId | null;
  modifiers: ModifierId[];
}

/**
 * Lebenssituationen, die **nie** aus Daten vorgeschlagen werden.
 *
 * - `debt_focus`, `single_parent`: belastende Lagen. Sie zu erraten und als
 *   Selbstbeschreibung anzubieten, ist eine Zuschreibung. Schulden gibt es
 *   stattdessen als Umstand `repaying_debt` — als Tun formuliert, nicht als
 *   Zustand.
 * - `family`: ein voller Einkaufswagen beweist keine Kinder.
 * - `student_school`, `student_university`: kein Signal, das sie von einem
 *   schmalen Einkommen unterscheidet.
 * - `career_starter`: unterscheidet sich von `employed_stable` nur durch die
 *   Biografie, nicht durch die Buchungen.
 * - `creator`: setzt dieselbe EÜR wie `self_employed`, ist aber die speziellere
 *   Aussage. Aus einem Kategorie-Treffer die speziellere zu wählen, wäre zu
 *   selbstsicher — der Nutzer schaltet selbst um.
 */
export const NEVER_PROPOSED_SITUATIONS: readonly LifeSituationId[] = [
  'debt_focus',
  'single_parent',
  'family',
  'student_school',
  'student_university',
  'career_starter',
  'creator',
];

/**
 * Signale → Vorschlag. Konservativ: im Zweifel `null`, denn eine falsche
 * Vorbelegung kostet mehr Vertrauen, als eine fehlende Vorbelegung Zeit kostet.
 */
export function proposeOnboarding(signals: OnboardingSignals): OnboardingProposal {
  const modifiers = new Set<ModifierId>();

  if (signals.hasDebts) modifiers.add('repaying_debt');
  if (signals.hasInvestments) modifiers.add('investing');
  if (signals.incomeVaries) modifiers.add('irregular_income');

  // Selbstständigen-Einnahmen NEBEN einem Gehalt sind ein Nebenerwerb; ohne
  // Gehalt sind sie die Lebensgrundlage. Derselbe Befund, zwei Bedeutungen —
  // die Unterscheidung macht das Gehalt.
  if (signals.hasSelfEmployedIncome && signals.hasRegularSalary) modifiers.add('side_business');

  return {
    lifeSituation: proposeLifeSituation(signals),
    // Stabil sortiert, damit der Vorschlag bei gleichen Daten gleich aussieht
    // und Tests nicht an einer Reihenfolge hängen, die niemand zugesichert hat.
    modifiers: [...modifiers].sort(),
  };
}

function proposeLifeSituation(signals: OnboardingSignals): LifeSituationId | null {
  // Reihenfolge ist Rangfolge: Ein Gehalt neben einer Rente heißt, dass die
  // Person arbeitet — der Ruhestand gilt nur, wenn kein Gehalt daneben steht.
  if (signals.hasPensionIncome && !signals.hasRegularSalary) return 'retired';
  if (signals.hasSelfEmployedIncome && !signals.hasRegularSalary) return 'self_employed';
  if (signals.hasRegularSalary) return 'employed_stable';
  return null;
}
