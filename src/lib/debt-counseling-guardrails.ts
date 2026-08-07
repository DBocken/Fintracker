// Schuldnerberatungs-Brücke und Überschuldungs-Heuristik (Issue #50, Epic #24).
//
// Reine Funktionen ohne I/O — deshalb in `lib`. Zuvor lagen sie im
// `debt-guardrails-service`, wodurch `lib/debt-counseling.ts` entgegen der
// Schichtrichtung nach oben importieren musste (AGENTS.md §3).
//
// RDG-Grenze (Formulierungsdisziplin, siehe docs/RDG_TEXTREGELN.md):
// Die App informiert, strukturiert und motiviert — sie berät nicht rechtlich.
// Alle Texte hier sind gegen die Regeln in docs/RDG_TEXTREGELN.md geprüft.

import { t } from "@/i18n/serviceT";

// -----------------------------------------------------------------------------
// Schuldnerberatungs-Brücke: anerkannte, KOSTENLOSE Stellen
// -----------------------------------------------------------------------------

export interface CounselingService {
  name: string;
  url: string;
  note: string;
}

export function getCounselingServices(): CounselingService[] {
  return [
    {
      name: t('debts.guardrails.counselingCaritasName'),
      url: 'https://www.caritas.de/onlineberatung/schuldnerberatung',
      note: t('debts.guardrails.counselingCaritasNote'),
    },
    {
      name: t('debts.guardrails.counselingDiakoniaName'),
      url: 'https://www.diakonie.de/schuldnerberatung',
      note: t('debts.guardrails.counselingDiakoniaNote'),
    },
    {
      name: t('debts.guardrails.counselingVerbraucherzentraleName'),
      url: 'https://www.verbraucherzentrale.de/beratung',
      note: t('debts.guardrails.counselingVerbraucherzentraleNote'),
    },
  ];
}

export function getCommercialRegulatorWarning(): string {
  return t('debts.guardrails.commercialRegulatorWarning');
}

// -----------------------------------------------------------------------------
// 2. Überschuldungs-Erkennung → aktiver Beratungs-Verweis
// -----------------------------------------------------------------------------

/** Tilgungsplan länger als 6 Jahre = Dauer einer Restschuldbefreiung. */
export const OVERINDEBTEDNESS_PLAN_MONTHS = 72;

export interface OverindebtednessInput {
  /** Geplante monatliche Tilgungsrate über alle Schulden. */
  monthlyRate: number;
  /** Monatlich verfügbares Einkommen (nach Fixkosten). */
  availableIncome: number;
  /** Berechnete Plandauer in Monaten (null = Plan geht nie auf). */
  planMonths: number | null;
}

export interface CounselingRecommendation {
  recommended: boolean;
  reason: string | null;
  services: CounselingService[];
  warning: string;
}

export function counselingRecommendation(
  input: OverindebtednessInput,
): CounselingRecommendation {
  let reason: string | null = null;
  if (input.planMonths === null) {
    reason = t('debts.guardrails.overindebtednessNoSolution');
  } else if (input.planMonths > OVERINDEBTEDNESS_PLAN_MONTHS) {
    reason = t('debts.guardrails.overindebtednessPlanTooLong', 'Dein Plan dauert länger als {years} Jahre. Eine Schuldnerberatung kennt Wege, die schneller zum Ziel führen können.').replace('{years}', String(OVERINDEBTEDNESS_PLAN_MONTHS / 12));
  } else if (input.monthlyRate > input.availableIncome) {
    reason = t('debts.guardrails.overindebtednessHighRate');
  }

  return {
    recommended: reason !== null,
    reason,
    services: getCounselingServices(),
    warning: getCommercialRegulatorWarning(),
  };
}
