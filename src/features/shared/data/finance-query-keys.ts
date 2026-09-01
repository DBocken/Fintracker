import type { QueryClient } from '@tanstack/react-query';

// Query-Keys byte-identisch zu den bisher inline verstreuten Literalen halten —
// jede Abweichung würde bestehende Caches und Invalidierungen stillschweigend trennen.
export const financeKeys = {
  transactionsRoot: ['transactions'] as const,
  /**
   * Der GANZE Buchungsbestand (Audit 2026-09, F2).
   *
   * Vorher hing der Key an einem Limit — `['transactions', 5000]` —, und das
   * Limit war der eigentliche Fehler: Jede Fläche lud einen Ausschnitt und
   * rechnete darauf weiter. Ohne Kappung gibt es nur noch EINE Menge, also
   * auch nur einen Key; nebenbei teilen sich die Flächen jetzt einen
   * Cache-Eintrag statt je einen pro geratener Zahl.
   */
  transactionsAll: ['transactions', 'all'] as const,
  categories: ['categories'] as const,
  accounts: ['accounts'] as const,
  contractDecisions: ['contract-decisions'] as const,
  /**
   * Aufteilungen aller Buchungen als Map (`getAllocationMap`) — Suchindex für
   * die Notizen der Split-Zeilen. Teilt sich die Wurzel `['allocations']` mit
   * dem Per-Buchung-Cache des `TransactionSplitPanel` (`['allocations', txId]`),
   * damit eine Invalidierung der Wurzel beide trifft (Prefix-Matching).
   */
  allocationMap: ['allocations', 'map'] as const,
} as const;

// `FINANCE_TRANSACTION_LIMIT = 5000` stand hier bis zum Audit 2026-09 (F2).
// Der Kommentar daneben las sich vernünftig — „Limit im Key verhindert
// Cache-Kollision" —, und genau das machte die Kappung unsichtbar: Sie sah aus
// wie eine Cache-Entscheidung, war aber eine Datenentscheidung. Acht
// ViewModels rechneten darauf Summen, Verläufe und Vorschläge; ab 5.000
// Buchungen waren sie falsch, ohne dass etwas rot wurde. Die Konstante ist
// weg, der Key heisst `transactionsAll`, und `check:transaction-limits` hält
// beides fest.

/**
 * WP 4.3 (PERF-5): Root-Keys von Abfragen, die NACHWEISLICH unabhängig von
 * Konten/Buchungen/Schulden sind — verifiziert durch Lesen der jeweiligen
 * `queryFn` bzw. des zugrundeliegenden Service (siehe Kommentare je Gruppe).
 * `invalidateFinanceData()` lässt sie deshalb aus.
 *
 * Bewusst eine DENYLIST, keine Allowlist: Ein vergessener NEUER Finanz-Key
 * bleibt damit automatisch von `invalidateFinanceData()` erfasst (sicher,
 * kostet höchstens eine unnötige Neuladung). Eine Allowlist hätte das
 * umgekehrte, gefährlichere Fehlerbild — ein vergessener Key würde lautlos
 * NICHT invalidiert und veraltete Daten zeigen. Wer eine neue, dauerhaft
 * unabhängige Domäne ergänzt, tut das hier explizit und begründet — alles
 * andere bleibt im sicheren Standardfall (wird invalidiert).
 */
export const FINANCE_UNRELATED_QUERY_KEY_ROOTS: readonly string[] = [
  // Trading/eToro (use-trading-portfolio.ts, use-etoro-account.ts): eigene
  // Portfolio-/Positions-Kollektion, unabhängig von Demo-Konten/-Buchungen.
  'portfolios', 'portfolio-positions', 'portfolio-summary', 'portfolio-initialization',
  'active-portfolio', 'preferred-market-provider',
  'etoro-aggregate', 'etoro-mirror-instruments', 'etoro-trade-history', 'etoro-pnl',
  'etoro-trade-history-instruments', 'etoro-balances', 'etoro-cash-transactions',
  'etoro-balances-history', 'etoro-analysis-instruments', 'etoro-stocks-industries',
  'etoro-watchlists', 'etoro-watchlist-items', 'etoro-price-alerts', 'etoro-watchlists-rates',
  'etoro-news-feed', 'etoro-market-feed', 'etoro-demo-pnl', 'etoro-instrument-search',
  'etoro-curated-lists', 'etoro-instrument-candles', 'etoro-user-info',
  // Haushalt (households-service): eigene Kollektion, keine Konto-/Buchungsdaten.
  'households', 'household-members', 'shared-split',
  // Bankverbindungs-/GoCardless-OAuth-Datensätze (bank-connection-service.ts):
  // eigene Kollektion, nicht Teil des Demo-Datensatzes.
  'bank-connections', 'bank-connection', 'bank-connection-by-requisition',
  // Sync-/Privacy-/Analytics-Metadaten: eigenständige Einstellungen.
  'sync-metadata-latest', 'analyticsConsent', 'analytics-preview',
  // Nutzereinstellungen/Onboarding-Signale: eigene `userSettings`-Kollektion,
  // nicht Teil des Demo-Datensatzes (accounts/debts/transactions).
  'userSettings', 'user-settings', 'onboardingSignals',
  // Kategorien-Konfiguration: Demo-Buchungen referenzieren bestehende
  // Kategorie-IDs, verändern die Kategorienliste selbst aber nicht.
  'categories', 'hierarchicalCategories', 'hierarchical-categories',
  'categories-hierarchical', 'category-suggestion', 'merchant-rules',
  // Steuer-Profil/-Rücklage (tax-reserve-service.ts, taxYearProfile-Service):
  // eigene Kollektionen (`taxReserves`/`taxYearProfiles`), gelesen und
  // verifiziert — kein Zugriff auf getAccounts/getTransactions/getDebts.
  'taxYearProfile', 'taxReserve',
  // Backup-Metadaten: liest den Verschlüsselungs-/Backup-Status, keine
  // Finanzdaten selbst.
  'backup-info',
] as const;

/**
 * Invalidiert gezielt die Finanz-Domäne (Konten, Buchungen, Schulden und
 * alles davon Abgeleitete — Netto-Vermögen, Budgets, Coach, Meilensteine,
 * Forecast, Steuer-Vorschläge, …), NICHT den kompletten Cache.
 *
 * Für WP 4.3 (PERF-5): ersetzt `queryClient.invalidateQueries()` ganz ohne
 * Key an den Stellen, an denen sich Konten/Buchungen/Schulden als Ganzes
 * ändern (Beispieldaten laden/entfernen). Trading, Haushalt, Sync/Privacy,
 * Bankverbindungs-Metadaten und Einstellungen bleiben unberührt — siehe
 * `FINANCE_UNRELATED_QUERY_KEY_ROOTS`.
 */
export function invalidateFinanceData(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({
    predicate: (query) => {
      const root = query.queryKey[0];
      return typeof root === 'string' && !FINANCE_UNRELATED_QUERY_KEY_ROOTS.includes(root);
    },
  });
}
