/**
 * Zentrale Registry aller lokalen Storage-Keys (VE-6 / Audit F-CRYPTO-1).
 *
 * Enthält bewusst KEINE Imports, damit sie zirkularfrei sowohl von
 * `local-crypto` (Verschlüsselungs-Migration) als auch von `local-finance-store`
 * und `local-settings-service` genutzt werden kann. Ein einziger Ort, an dem
 * jeder verschlüsselbare Datenschlüssel registriert ist — so kann die
 * Enable/Disable-Migration keine Kollektion mehr übersehen.
 */
export const LOCAL_FINANCE_KEYS = {
  transactions: 'ausgabentracker_transactions_v3',
  accounts: 'ausgabentracker_accounts_v1',
  debts: 'ausgabentracker_debts_v1',
  debtAssignments: 'ausgabentracker_debt_assignments_v1',
  receivables: 'ausgabentracker_receivables_v1',
  receivableAssignments: 'ausgabentracker_receivable_assignments_v1',
  claims: 'ausgabentracker_claims_v1',
  portfolios: 'ausgabentracker_portfolios_v1',
  portfolioPositions: 'ausgabentracker_portfolio_positions_v1',
  bankConnections: 'ausgabentracker_bank_connections_v1',
  schufareminders: 'ausgabentracker_schufareminders_v1',
  merchantRules: 'ausgabentracker_merchant_rules_v1',
  contractDecisions: 'ausgabentracker_contract_decisions_v1',
  transactionAllocations: 'ausgabentracker_transaction_allocations_v1',
  budgets: 'ausgabentracker_budgets_v1',
  milestones: 'ausgabentracker_milestones_v1',
  analyticsConsent: 'ausgabentracker_analytics_consent_v1',
  automationSuggestions: 'ausgabentracker_automation_suggestions_v1',
  auditLog: 'ausgabentracker_audit_log_v1',
  households: 'ausgabentracker_households_v1',
  householdMembers: 'ausgabentracker_household_members_v1',
  sharedExpenseSplits: 'ausgabentracker_shared_expense_splits_v1',
} as const;

export type LocalFinanceKey = keyof typeof LOCAL_FINANCE_KEYS;

/** Nutzerkategorien (mit Defaults). Bei aktiver Verschlüsselung ebenfalls Envelope. */
export const LOCAL_CATEGORIES_KEY = 'ausgabentracker_categories_v1';

/** Lokale Nutzereinstellungen. Bei aktiver Verschlüsselung ebenfalls Envelope. */
export const LOCAL_SETTINGS_KEY = 'ausgabentracker_user_settings_v1';

/**
 * Alle Keys, die bei aktiver lokaler Verschlüsselung als AES-GCM-Envelope in
 * IndexedDB liegen — die vollständige Migrationsmenge für enable()/disable().
 * (Das `..._transactions_v2__`-Präfix wird in local-crypto zusätzlich behandelt.)
 */
export const ENCRYPTED_STORAGE_KEYS: readonly string[] = [
  ...Object.values(LOCAL_FINANCE_KEYS),
  LOCAL_CATEGORIES_KEY,
  LOCAL_SETTINGS_KEY,
];
