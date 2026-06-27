export type AccountType = 'checking' | 'credit_card' | 'savings' | 'wallet' | 'cash' | 'other';

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  currency: string;
  description?: string;
  /** IBAN des Kontos (für die Erkennung interner Überträge zwischen eigenen Konten) */
  iban?: string | null;
  color: string;
  icon: string;
  is_budget_pool_member: boolean;
  order_index: number;
  statement_close_day?: number | null;
  due_day?: number | null;
  autopay_account_id?: string | null;
  gocardless_account_id?: string | null;
  gocardless_requisition_id?: string | null;
  gocardless_institution_id?: string | null;
  gocardless_institution_name?: string | null;
  last_sync_at?: string | null;
  sync_enabled?: boolean;
  bank_connection_id?: string | null;
  live_balance_amount?: number | null;
  live_balance_currency?: string | null;
  live_balance_type?: string | null;
  live_balance_updated_at?: string | null;
  /** Saldo zu einem Stichtag, bevor lokale Transaktionen erfasst wurden */
  opening_balance?: number | null;
  opening_balance_date?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Transaction {
  id?: string;
  account_id?: string | null;
  date: string;
  amount: number;
  payee: string;
  description: string;
  original_text: string;
  currency?: string;
  csvCategoryName?: string;
  category?: string;
  category_id?: string | null;
  subcategory_id?: string | null;
  auto_mapped: boolean;
  confirmed: boolean;
  /** Markiert diese Transaktion als internen Übertrag zwischen eigenen Konten */
  is_transfer?: boolean;
  /** ID der verknüpften Gegenbuchung auf dem anderen Konto */
  transfer_pair_id?: string | null;
  /** IBAN des Gegenübers (Sender/Empfänger) – Basis für die automatische Transfer-Erkennung */
  counterparty_iban?: string | null;
  /** Ob diese Transaktion ein erkannter oder manueller Vertrag ist */
  is_contract?: boolean;
  /** Zyklus des Vertrags (weekly, monthly, etc.) */
  contract_cycle?: Rhythmus | null;
}

export type Rhythmus = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

/** Herkunft einer Transaktionsaufteilung. */
export type AllocationSource = 'manual' | 'receipt' | 'trackerverse';

/**
 * Aufteilung einer Transaktion auf mehrere Kategorien (Split-Buchung).
 *
 * Beträge in Cent (Integer, gleiches Vorzeichen wie `Transaction.amount`).
 * Aufteilungen sind kontoneutral: der Kontostand nutzt ausschließlich den
 * Originalbetrag der Transaktion – Aufteilungen erzeugen keine zusätzlichen
 * kontowirksamen Buchungen. Kategorie-Analysen verwenden Aufteilungen, sofern
 * vorhanden, sonst die Kategorie der Transaktion selbst. Die Summe aller
 * Aufteilungen entspricht exakt dem Betrag der Originalbuchung (cent-genau).
 */
export interface TransactionAllocation {
  id: string;
  transaction_id: string;
  /** Teilbetrag in Cent (Integer). */
  amount_minor: number;
  category_id: string | null;
  subcategory_id?: string | null;
  label?: string | null;
  source: AllocationSource;
  /** Herkunfts-ID bei automatischen Quellen (Beleg-Zeile, Trackerverse-Event). */
  external_origin_id?: string | null;
  created_at?: string;
  updated_at?: string;
}
export type Prioritaet = 'essential' | 'normal' | 'nice';
export type Zahlungsweg = 'giro' | 'credit' | 'paypal' | 'cash';

/**
 * Vorgelagerte Ausgabenklasse über den Hauptkategorien. Dient als oberste
 * Aggregationsebene (Sunburst-Innenring) und entkoppelt die Essenziell-Sicht
 * von der Kategorie-Hierarchie, weil `essenziell` je Unterkategorie variiert.
 */
export type Ausgabenklasse = 'essenziell' | 'diskretionaer' | 'sparen' | 'einkommen';

export interface CategoryAttributes {
  ist_vertrag?: boolean;
  rhythmus?: Rhythmus | null;
  faelligkeitstag?: number | null;
  next_due_date?: string | null;
  kuendigungsfrist_tage?: number | null;
  vertragsende?: string | null;
  fixkosten?: boolean;
  essenziell?: boolean;
  /** Vorgelagerte Klasse; `essenziell` bleibt als abgeleitetes Bool erhalten. */
  ausgabenklasse?: Ausgabenklasse;
  prioritaet?: Prioritaet | null;
  budget_monat?: number | null;
  warnschwelle_prozent?: number | null;
  zahlungsweg?: Zahlungsweg | null;
  merchant_alias?: string | null;
  steuerrelevant?: boolean;
  tags?: string[];
  sichtbar?: boolean;
  archiviert?: boolean;
  sort_index?: number | null;
  priority_level?: number | null;
  min_budget_monat?: number | null;
  flexible?: boolean;
  protected?: boolean;
}

export interface Category {
  id: string;
  user_id?: string | null;
  name: string;
  color?: string;
  icon?: string;
  filters: string[];
  is_default?: boolean;
  parent_id?: string | null;
  level?: number;
  attributes?: CategoryAttributes;
}

export interface UserSettings {
  user_id: string;
  auto_confirm_mapping: boolean;
  retention_months: number;
  default_currency?: string;
  enable_subcategories: boolean;
  theme?: string;
  kpi_prefs?: {
    order: string[];
    active: string[];
  };
  preferred_market_provider?: 'yahoo' | 'stooq';
  gentle_mode?: boolean;
}

export interface HierarchicalCategory extends Category {
  children?: HierarchicalCategory[];
  parent?: HierarchicalCategory;
}

/**
 * Budget-Periode. Aktuell ist nur `monthly` aktiv – `weekly`/`yearly` sind im
 * Typ schon vorgesehen, werden aber erst mit dem Premium-Ausbau freigeschaltet.
 */
export type BudgetPeriod = 'monthly' | 'weekly' | 'yearly';

/**
 * Eine einzelne Matching-Regel eines (Premium-)Budgets. Ohne Premium bleibt
 * `rules` leer – das Budget rechnet dann rein kategorie-basiert. Die Felder sind
 * bereits modelliert, damit der spätere Regel-Editor keine Datenmigration braucht.
 */
export interface BudgetRule {
  /** Worauf die Regel prüft. */
  field: 'payee' | 'description' | 'amount' | 'account';
  /** Vergleichsoperator. */
  op: 'contains' | 'equals' | 'gt' | 'lt';
  /** Vergleichswert (String für Text/Konto, Zahl für Betrag – als String gehalten). */
  value: string;
}

/**
 * Übertrags-Modus eines Budgets zwischen zwei Perioden:
 * - `off`        – jeder Monat startet frisch beim Basislimit
 * - `accumulate` – nicht genutztes Budget wandert mit (Limit steigt)
 * - `overspend`  – Überschreitung wird vom Folgemonat abgezogen (Start im Minus)
 * - `both`       – positiver und negativer Übertrag
 */
export type RolloverMode = 'off' | 'accumulate' | 'overspend' | 'both';

/** Was mit positivem Restbudget am Periodenende geschieht. */
export type SurplusAction = 'carry' | 'sweep_savings' | 'sweep_invest';

/** Rollover-Konfiguration eines Budgets (löst das alte boolean `rollover` ab). */
export interface BudgetRollover {
  mode: RolloverMode;
  /** Obergrenze des angesparten positiven Übertrags in EUR (0/undefined = unbegrenzt). */
  cap?: number;
  /** Verbleib des positiven Rests (Default `carry`). `sweep_*` führt ihn ab statt zu kumulieren. */
  surplusAction?: SurplusAction;
  /** Zielkonto für einen Sweep (z. B. Tagesgeld). */
  sweepTargetAccountId?: string;
  /** Ziel-Sparziel/Milestone für einen Sweep. */
  sweepTargetGoalId?: string;
}

/** Abgeleiteter Übertrags-Stand eines Budgets für eine konkrete Periode. */
export interface BudgetPeriodLedger {
  budgetId: string;
  /** Periode `YYYY-MM`. */
  period: string;
  /** Basislimit der Periode (ggf. datengetrieben). */
  baseLimit: number;
  /** Übertrag aus der Vorperiode (kann negativ sein). */
  carryIn: number;
  /** Effektives Limit = Basislimit + carryIn. */
  effectiveLimit: number;
  /** Tatsächliche Ausgaben der Periode. */
  spent: number;
  /** Verbleibend = effektives Limit − Ausgaben. */
  remaining: number;
  /** Per Sweep abgeführter Überschuss (siehe `surplusAction`). */
  swept: number;
  /** An die Folgeperiode weitergereichter Übertrag. */
  carryOut: number;
}

/**
 * Ein benutzerdefiniertes Budget – visualisiert als „Tank". Ein Budget bindet
 * an genau eine Hauptkategorie; optional lassen sich einzelne Unterkategorien
 * auswählen (leer = alle Unterkategorien zählen). Alles strikt lokal gespeichert.
 */
export interface Budget {
  id: string;
  name: string;
  /** Hauptkategorie, deren Ausgaben in den Tank fließen. */
  category_id: string;
  /** Teilmenge der Unterkategorien; leer/undefined = alle zählen. */
  subcategory_ids?: string[];
  /** Monatslimit in EUR (positiv). */
  limit: number;
  /** Warnschwelle in Prozent (Default 80). Ab hier färbt sich der Tank. */
  warn_threshold?: number;
  /** Akzentfarbe des Tanks (CSS-Farbe); fällt sonst auf die Kategoriefarbe zurück. */
  color?: string;
  /** Emoji/Icon-Hinweis für die Karte. */
  icon?: string;
  /** Aus einem Vorschlag erstellt (für Analytics/Hinweise). */
  from_suggestion?: boolean;

  // --- Premium-Felder (bereits modelliert, UI erst mit Premium) ---
  /** Abrechnungsperiode. Ohne Premium immer `monthly`. */
  period?: BudgetPeriod;
  /**
   * @deprecated Altes boolean-Feld. Wird via `resolveRolloverConfig` auf
   * `{ mode: 'accumulate' }` migriert. Neue Logik nutzt `rolloverConfig`.
   */
  rollover?: boolean;
  /** Rollover-Konfiguration (Übertrag, Cap, Sweep). Premium. */
  rolloverConfig?: BudgetRollover;
  /**
   * Datengetriebenes Basislimit: statt des fixen `limit` wird je Monat der
   * Median der jüngsten Ausgaben verwendet („Adaptive Tank"). `limit` dient dann
   * als Fallback ohne Historie. Premium.
   */
  adaptive?: boolean;
  /** Zusätzliche Match-Regeln. Premium; ohne Premium leer. */
  rules?: BudgetRule[];

  created_at?: string;
  updated_at?: string;
}

/** Abweichung des gesetzten Limits vom realen Median (Auto-Retune-Hinweis). */
export interface BudgetDrift {
  /** Realer Median der jüngsten Ausgaben. */
  median: number;
  /** Aktuelles (Basis-)Limit. */
  limit: number;
  /** Differenz `median − limit` (positiv = Ausgaben über Limit). */
  drift: number;
  /** Relative Abweichung |drift|/limit. */
  ratio: number;
  /** Richtung der Abweichung relativ zum Limit. */
  direction: 'over' | 'under' | 'ok';
  /** Empfohlenes neues Limit (gerundet) bei signifikanter Abweichung. */
  suggestedLimit: number;
  /** true, wenn die relative Abweichung die Schwelle überschreitet. */
  significant: boolean;
}

/** Ampel-Status eines Budgets relativ zur Warnschwelle/zum Limit. */
export type BudgetHealth = 'ok' | 'warn' | 'over';

/** Berechneter Live-Stand eines Budgets für eine konkrete Periode. */
export interface BudgetStatus {
  budget: Budget;
  /** Ausgegeben in der Periode (positiver EUR-Betrag). */
  spent: number;
  /** Verbleibend (kann negativ sein bei Überschreitung). */
  remaining: number;
  /** Auslastung 0..1+ (Ausgaben / Limit). */
  ratio: number;
  /** Füllstand in Prozent, 0..100 gekappt (für den Tank). */
  fillPercent: number;
  health: BudgetHealth;

  // --- Rollover (optional; nur gesetzt, wenn über die Rollover-Engine berechnet) ---
  /** Übertrag aus der Vorperiode (kann negativ sein). */
  carryIn?: number;
  /** Effektives Limit der Periode (Basislimit + carryIn). */
  effectiveLimit?: number;
  /** An die Folgeperiode weitergereichter Übertrag. */
  carryOut?: number;
  /** Per Sweep abgeführter Überschuss. */
  swept?: number;
  /** Abweichung des Limits vom realen Median (für „Limit anpassen?"-Hinweis). */
  drift?: BudgetDrift;
}

/** Vorgeschlagenes Budget für eine Hauptkategorie (noch nicht gespeichert). */
export interface BudgetSuggestion {
  category_id: string;
  name: string;
  /** Vorgeschlagenes Limit (gerundet) auf Basis des Durchschnitts. */
  limit: number;
  /** Durchschnittliche Monatsausgabe, auf der der Vorschlag basiert. */
  avgMonthly: number;
  color?: string;
  icon?: string;
}

export type DebtType = 'credit_card' | 'bnpl' | 'installment' | 'overdraft' | 'private_loan' | 'car_loan' | 'student_loan' | 'mortgage' | 'other';

/** Existenzsichernde Rückstände (Miete, Energie, Unterhalt) gehen im Plan immer vor Konsumschulden (#51). */
export type DebtPriority = 'existenzsichernd' | 'normal';

export interface Debt {
  id: string;
  user_id: string;
  name: string;
  type: DebtType;
  balance: number;
  original_amount?: number | null;
  interest_rate: number;
  min_payment: number;
  due_day?: number | null;
  due_date?: string | null;
  is_bnpl: boolean;
  provider?: string | null;
  notes?: string | null;
  is_paid_off: boolean;
  priority?: DebtPriority | null;
  created_at?: string;
  updated_at?: string;
}

/** Art der Forderung (verliehenes Geld, geteilte Ausgabe, Kaution, …). */
export type ReceivableType = 'private_loan' | 'shared_expense' | 'deposit' | 'other';

/**
 * Eine Forderung – Geld, das jemand mir schuldet (verliehenes Geld). Spiegelbild
 * zur {@link Debt}, aber als Aktivum und mit eingehenden Rückzahlungen.
 */
export interface Receivable {
  id: string;
  user_id: string;
  /** Bezeichnung, z. B. "Max – Konzertticket". */
  name: string;
  /** Name des Schuldners – Basis für das Matching eingehender Rückzahlungen. */
  debtor?: string | null;
  type: ReceivableType;
  /** Offener Restbetrag. */
  amount: number;
  /** Ursprünglich verliehener Betrag. */
  original_amount?: number | null;
  /** Bar verliehen (kein Bankbeleg). */
  is_cash: boolean;
  due_date?: string | null;
  notes?: string | null;
  /** Vollständig zurückgezahlt. */
  is_settled: boolean;
  created_at?: string;
  updated_at?: string;
}

/** Verknüpft eine eingehende Buchung als (Teil-)Rückzahlung mit einer Forderung. */
export interface ReceivableTransactionAssignment {
  id: string;
  user_id: string;
  receivable_id: string;
  transaction_id: string;
  amount: number;
  created_at: string;
}

export interface Milestone {
  id: string;
  user_id: string;
  milestone_key: string;
  achieved_at: string;
}

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

export interface MarketDataProvider {
  name: string;
  type: ProviderType;
  fetchQuotes(symbols: string[]): Promise<QuoteData[]>;
  fetchQuote(symbol: string): Promise<QuoteData | null>;
}

export type ProviderType = 'etoro' | 'yahoo' | 'stooq' | 'mock';

export interface Portfolio {
  id: string;
  user_id: string;
  name: string;
  type: 'etoro' | 'manual' | 'demo';
  provider_config?: Record<string, unknown>;
  currency: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PortfolioPosition {
  id: string;
  portfolio_id: string;
  symbol: string;
  name?: string;
  quantity: number;
  entry_price: number;
  currency: string;
  exchange?: string;
  metadata?: Record<string, unknown>;
  last_price?: number;
  last_price_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface QuoteData {
  symbol: string;
  name?: string;
  price: number;
  change?: number;
  change_percent?: number;
  currency?: string;
  exchange?: string;
  timestamp?: number;
  provider: ProviderType;
}

export interface PortfolioSummary {
  total_value: number;
  total_cost: number;
  unrealized_gain_loss: number;
  unrealized_gain_loss_percent: number;
  realized_gain_loss?: number;
  realized_gain_loss_percent?: number;
  positions_count: number;
  currency: string;
}

export interface OcrField {
  value: string;
  confidence: number;
  status: 'high' | 'medium' | 'low';
}

export interface OcrExtractedPosition {
  symbol: OcrField;
  quantity?: OcrField;
  entryPrice?: OcrField;
  currency?: OcrField;
}

export interface OcrResult {
  text: string;
  positions: OcrExtractedPosition[];
  overallConfidence: number;
}
