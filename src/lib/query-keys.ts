/**
 * Zentrale queryKey-Factory — EINE Quelle der Wahrheit für alle react-query-Keys.
 *
 * Warum: Die Keys waren zuvor als String-Literale über ~50 Dateien verstreut und
 * dupliziert; jede Umbenennung oder falsch getippte Invalidierung führte zu still
 * veralteten Caches. Die Factory bildet dieselben Tupel strukturell exakt ab
 * (verhaltensbewahrend), bündelt aber die heiklen Konventionen an einem Ort.
 *
 * Konventionen:
 * - `*.all` ist das Invalidierungs-Präfix einer Domäne. `invalidateQueries({
 *   queryKey: queryKeys.transactions.all })` trifft per Präfix-Match weiterhin
 *   ALLE `['transactions', …]`-Varianten.
 * - Parametrisierte Keys sind benannte Funktionen statt handgeschriebener Tupel
 *   (z. B. `transactions.list(5000)` statt `['transactions', 5000]`). Das Limit
 *   MUSS Teil des Keys bleiben (F-PERF-3): sonst kollidiert der 1000er-Load mit
 *   den 5000er-Loads unter demselben Key und der zuerst gemountete Aufrufer
 *   bestimmt den Cache → still falsche Summen.
 */
export const queryKeys = {
  transactions: {
    /** Invalidierungs-Präfix — matcht alle ['transactions', …]. */
    all: ["transactions"] as const,
    /** Limit-behafteter Load (F-PERF-3: Limit gehört in den Key). */
    list: (limit: number) => ["transactions", limit] as const,
    contracts: () => ["transactions", "contracts"] as const,
    export: () => ["transactions", "export"] as const,
    lumpyRisk: () => ["transactions", "lumpy-risk"] as const,
  },

  /**
   * ACHTUNG: eigener Top-Level-Key, NICHT unter `transactions`. Die
   * Präfix-Invalidierung von `transactions.all` erreicht ihn bewusst nicht;
   * Aufrufer, die den Chart aktualisieren wollen, müssen ihn separat
   * invalidieren (siehe gocardless-sync-service, useTransactionDetailEditing).
   * Nicht „aufräumend" unter `transactions` einordnen — das bricht die Trennung.
   */
  transactionsChart: ["transactions-chart"] as const,

  accounts: { all: ["accounts"] as const },
  categories: { all: ["categories"] as const },

  coach: {
    overview: ["coach-overview"] as const,
    /** Eigener Probe-Key: darf den 5000er-Transactions-Cache nicht verfälschen. */
    hasData: ["has-finance-data"] as const,
  },

  financialHealth: ["financial-health"] as const,
  milestones: ["milestones"] as const,
  netWorth: ["net-worth"] as const,
  contractDecisions: ["contract-decisions"] as const,
  liveBalances: ["live-balances"] as const,
} as const;

/**
 * true, wenn `key` mit `prefix` beginnt — bildet das Präfix-Matching von
 * react-query (`invalidateQueries({ queryKey: prefix })`) nach. Nur für Tests
 * und dokumentierende Asserts gedacht.
 */
export function matchesKeyPrefix(
  prefix: readonly unknown[],
  key: readonly unknown[],
): boolean {
  if (prefix.length > key.length) return false;
  return prefix.every((part, i) => Object.is(part, key[i]));
}
