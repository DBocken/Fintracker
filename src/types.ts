/**
 * ÜBERGANGS-BARREL — keine Typdefinitionen mehr, nur Re-Exports.
 *
 * `src/types.ts` bündelte bis WP 5.2 (DOM-3, `docs/qualitaet-2026-08/`) ≥9
 * Fachdomänen in einer Datei. Die Definitionen sind jetzt entlang der
 * „Wohin ein Typ gehört"-Tabelle (AGENTS.md §3) nach `src/lib/*-types.ts`
 * verschoben — dorthin, weil jeder dieser Typen sowohl von einem Service als
 * auch von der Oberfläche gebraucht wird (persistierte Form bzw. von
 * Service+UI gemeinsam genutzter abgeleiteter Typ).
 *
 * Diese Datei bleibt bewusst als Re-Export-Fassade bestehen: 337 Dateien
 * importierten zum Zeitpunkt der Aufteilung aus `@/types` — eine
 * Big-Bang-Umstellung aller Importstellen war nicht Teil von WP 5.2 (siehe
 * Bericht). **Abbaudatum: 2026-11-30** — bis dahin sollen Importe schrittweise
 * auf die konkrete `@/lib/*-types`-Datei umgestellt werden (z. B. im Zuge
 * anderer WPs, die die jeweilige Datei ohnehin anfassen); ab diesem Datum darf
 * diese Fassade entfernt werden, sofern keine Importe mehr auf sie zeigen.
 *
 * NICHT hier ergänzen: neue Typen gehören direkt in ihre `src/lib/*-types.ts`-
 * Datei (oder `src/features/<slice>/domain/`, falls nur ein Slice sie braucht).
 */

export type { AccountType, Account } from '@/lib/account-types';

export type {
  Transaction,
  Rhythmus,
  AllocationSource,
  TransactionAllocation,
} from '@/lib/transaction-types';

export type {
  Prioritaet,
  Zahlungsweg,
  Ausgabenklasse,
  CategoryAttributes,
  Category,
  HierarchicalCategory,
  CategorySuggestion,
  CategorizationSnapshotEntry,
  SpecialCategory,
  SpecialCategoryAssignmentSource,
  SpecialCategoryAssignment,
} from '@/lib/category-types';

export type { UserSettings } from '@/lib/settings-types';

export type { TaxReserveMovement, TaxReserveState } from '@/lib/tax-types';

export type {
  BudgetPeriod,
  BudgetRule,
  RolloverMode,
  SurplusAction,
  BudgetRollover,
  BudgetPeriodLedger,
  Budget,
  BudgetDrift,
  BudgetHealth,
  BudgetStatus,
  BudgetSuggestion,
} from '@/lib/budget-types';

export type { DebtType, DebtPriority, Debt } from '@/lib/debt-types';

export type {
  ReceivableType,
  Receivable,
  ReceivableTransactionAssignment,
} from '@/lib/receivable-types';

export type { Milestone } from '@/lib/milestone-types';

export type {
  RoadmapStageKey,
  RoadmapStage,
  GoalProgress,
  BehaviorInsight,
  CategoryGuidance,
  CoachRecommendation,
  CoachOverview,
} from '@/lib/coach-types';

export type {
  MarketDataProvider,
  ProviderType,
  Portfolio,
  PortfolioPosition,
  QuoteData,
  PortfolioSummary,
  UnconvertedPosition,
} from '@/lib/portfolio-types';

export type { OcrField, OcrExtractedPosition, OcrResult } from '@/lib/ocr-types';
