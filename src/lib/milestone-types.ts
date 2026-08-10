/**
 * Form der Meilensteine (Definition, Fortschritt, Status).
 *
 * Reine Typen: das Auswerten und Speichern bleibt im `milestones-service`.
 * Zuvor lagen sie im Service, wodurch
 * `features/finance-city/domain/city-goals-adapter.ts` entgegen der
 * Schichtrichtung nach oben importieren musste (AGENTS.md §3).
 */

export interface MilestoneDefinition {
  key: string;
  title: string;
  description: string;
  icon: string;
  /** Evaluate whether this milestone is currently achieved. */
  isAchieved: (ctx: MilestoneContext) => boolean;
  /**
   * Quantifizierter Fortschritt Richtung Ziel (WP-D7, Finanzstadt Ziele-Tab):
   * Ist-/Soll-Wert in der Einheit des Ziels (`euro` bzw. `count`), oder `null`,
   * wenn das Ziel im aktuellen Zustand nicht quantifizierbar ist (z. B.
   * Notgroschen ohne bekannte Monatsausgaben, Schuldenfreiheit ohne Schulden).
   */
  progressOf?: (ctx: MilestoneContext) => MilestoneProgress | null;
}

export interface MilestoneProgress {
  /** Ist-Wert (nie negativ; kann das Ziel übertreffen — Anzeige entscheidet über Clamping). */
  amount: number;
  /** Soll-Wert (> 0). */
  target: number;
  unit: 'euro' | 'count';
}

export interface MilestoneContext {
  netWorth: number;
  cash: number;
  monthlyExpenses: number;
  totalDebt: number;
  debtCount: number;
  paidOffDebtCount: number;
}

export interface MilestoneStatus {
  definition: MilestoneDefinition;
  achieved: boolean;
  achievedAt?: string;
  /** True if this was newly achieved during this evaluation. */
  justAchieved: boolean;
  /** Quantifizierter Ist-/Soll-Fortschritt (WP-D7) — `null`, wenn nicht quantifizierbar. Optional, damit bestehende Status-Fixtures gültig bleiben. */
  progress?: MilestoneProgress | null;
}

/**
 * Persistierter Nachweis eines erreichten Meilensteins (aus `src/types.ts`
 * übernommen, WP 5.2/DOM-3 — gleiche Meilenstein-Domäne wie oben).
 */
export interface Milestone {
  id: string;
  user_id: string;
  milestone_key: string;
  achieved_at: string;
}
