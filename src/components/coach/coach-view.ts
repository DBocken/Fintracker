import type { CoachOverview, CoachRecommendation } from "@/types";
import type { FinancialHealth } from "@/services/financial-health-service";
import type { MilestoneStatus } from "@/services/milestones-service";

/**
 * Gemeinsame Datenschnittstelle für beide Coach-Darstellungsvarianten
 * (Desktop/Mobile). Der Orchestrator (`CoachPage`) beschafft die Daten EINMAL
 * über `useCoachOverview` und leitet exakt diese Props an genau eine Variante
 * weiter — die Varianten selbst enthalten keinen Datenzugriff.
 */
export interface CoachViewProps {
  coach: CoachOverview | undefined;
  health: FinancialHealth | undefined;
  milestones: MilestoneStatus[] | undefined;
  /** Priorisierte Fokus-Empfehlung (erste Empfehlung), falls vorhanden. */
  focusCard: CoachRecommendation | undefined;
  /** Weitere Empfehlungen nach der Fokuskarte. */
  followUps: CoachRecommendation[];
  coachLoading: boolean;
  milestonesLoading: boolean;
}
