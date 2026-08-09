/**
 * Abgeleitete Formen der Finanzcoach-Auswertung (Roadmap, Ziele, Empfehlungen).
 *
 * Nicht persistiert — vom `coach-service` berechnet, aber sowohl von diesem
 * Service als auch von der Oberfläche (`CoachPage`, `CoachFeedCard`) und von
 * reiner `lib`-Logik (`lib/tutorial-coach.ts`) gebraucht. Nach der „Wohin ein
 * Typ gehört"-Tabelle (AGENTS.md §3) gehört ein Typ, den Service **und**
 * Oberfläche brauchen, nach `src/lib/`. Diese Datei ist Teil der Aufteilung
 * von `src/types.ts` (WP 5.2, DOM-3).
 */

export type RoadmapStageKey = 'starter_emergency_fund' | 'consumer_debt_elimination' | 'full_emergency_fund' | 'personal_goals';

export interface RoadmapStage {
  key: RoadmapStageKey;
  title: string;
  order: number;
  progress: number;
  status: 'locked' | 'active' | 'completed';
  description: string;
  whyItMatters: string;
}

export interface GoalProgress {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  progress: number;
  estimatedCompletionDate?: string | null;
  milestoneState: 'not-started' | 'in-progress' | 'close' | 'achieved';
}

export interface BehaviorInsight {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'success';
}

export interface CategoryGuidance {
  categoryId: string;
  categoryName: string;
  status: 'protected' | 'reduce' | 'cut';
  recommendedMax: number;
  currentSpend: number;
  savingsOpportunity: number;
  reason: string;
}

export interface CoachRecommendation {
  id: string;
  title: string;
  message: string;
  reason: string;
  severity: 'info' | 'warning' | 'success';
  ctaLabel?: string;
  ctaTo?: string;
}

export interface CoachOverview {
  stage: RoadmapStage;
  recommendations: CoachRecommendation[];
  goals: GoalProgress[];
  categoryGuidance: CategoryGuidance[];
  debtSummary: {
    totalDebt: number;
    minimumMonthlyBurden: number;
    snowballMonths: number;
    avalancheMonths: number;
    preferredStrategy: 'snowball' | 'avalanche';
  };
  insights: BehaviorInsight[];
}
