export type AccountType = 'checking' | 'credit_card' | 'savings' | 'wallet' | 'other';

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  currency: string;
  description?: string;
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
}

export type Rhythmus = 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type Prioritaet = 'essential' | 'normal' | 'nice';
export type Zahlungsweg = 'giro' | 'credit' | 'paypal' | 'cash';

export interface CategoryAttributes {
  ist_vertrag?: boolean;
  rhythmus?: Rhythmus | null;
  faelligkeitstag?: number | null;
  next_due_date?: string | null;
  kuendigungsfrist_tage?: number | null;
  vertragsende?: string | null;
  fixkosten?: boolean;
  essenziell?: boolean;
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
}

export interface HierarchicalCategory extends Category {
  children?: HierarchicalCategory[];
  parent?: HierarchicalCategory;
}

export type DebtType = 'credit_card' | 'bnpl' | 'installment' | 'overdraft' | 'private_loan' | 'car_loan' | 'student_loan' | 'mortgage' | 'other';

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
  created_at?: string;
  updated_at?: string;
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

export interface HierarchicalCategory extends Category {
  children?: HierarchicalCategory[];
  parent?: HierarchicalCategory;
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
  provider_config?: Record<string, any>;
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
  metadata?: Record<string, any>;
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