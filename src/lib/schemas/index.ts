/**
 * Zentrale zod-Schemas für neue Datengrenzen (Roadmap „Neue Fähigkeiten 2026-07",
 * Fundament F1 / Issue #234). Ein Schema pro Entität; der gemeinsame Parse-Helfer
 * `parseAtBoundary` härtet IndexedDB-/Backup-/Vault-/Import-Grenzen ab.
 */
export * from './boundary';
export * from './replacement-plan.schema';
export * from './contract-record.schema';
export * from './household-settlement.schema';
export * from './gocardless-account.schema';
export * from './analytics-consent.schema';
export * from './transaction.schema';
export * from './account.schema';
export * from './debt.schema';
export * from './receivable.schema';
export * from './budget.schema';
export * from './collection-schemas';
