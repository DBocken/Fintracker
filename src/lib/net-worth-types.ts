/**
 * Form der Vermögensaufstellung — hier und nicht im Dienst, der sie berechnet.
 *
 * Die Aufstellung wird vom `net-worth-service` erzeugt, aber sie GEHÖRT ihm
 * nicht: `financial-health-service` und `forecast-data` lesen sie, die
 * Konten-Fläche zeigt sie, und seit Welle 2 beantwortet der Chat Fragen
 * darüber. Ein Typ, den Dienst und Oberfläche brauchen, liegt in `src/lib/`
 * (AGENTS.md §3, „Wohin ein Typ gehört") — sonst zwingt er jeden späteren
 * Nutzer weiter unten zum Import nach oben, und genau daraus sind die
 * umgedrehten Abhängigkeiten entstanden, die `check:layers` heute abfängt.
 *
 * Reine Formbeschreibung, keine Rechnung: Wer den Wert braucht, ruft
 * `getNetWorthBreakdown()` — der bleibt beim Dienst, denn er macht I/O.
 */
export interface AccountSource {
  id: string;
  name: string;
  balance: number;
  /** "live" = Saldo direkt von der Bank, "local" = aus lokalen Transaktionen summiert */
  source: "live" | "local";
  lastSyncAt?: string | null;
}

export interface PortfolioSource {
  id: string;
  name: string;
  /** Euro-Anteil des Depots — Fremdwährung ist hier bewusst nicht enthalten. */
  value: number;
  /** Anzahl der Positionen hinter `value` (ohne die nicht verrechneten). */
  positionsCount: number;
}

/**
 * Ein Bestand, der BEWUSST nicht ins Nettovermögen einfließt, weil er nicht in
 * Euro notiert (VE-1, `docs/architecture/currency-eur-only.md`). Je Depot und
 * Währung ein Eintrag.
 */
export interface UnconvertedInvestmentSource {
  /** `<portfolioId>:<currency>` — ein Depot kann mehrere Fremdwährungen halten. */
  id: string;
  /** Name des Depots, aus dem der Bestand stammt. */
  name: string;
  currency: string;
  /** Marktwert in `currency` — Anzeige, nie Summand. */
  value: number;
  positionsCount: number;
}

export interface DebtSource {
  id: string;
  name: string;
  balance: number;
}

export interface ReceivableSource {
  id: string;
  name: string;
  amount: number;
}

export interface NetWorthBreakdown {
  /** Sum of all account balances (cash) */
  cash: number;
  /** Total value of all portfolios */
  investments: number;
  /** Total outstanding money lent out (receivables) */
  receivables: number;
  /** Total outstanding debt */
  debts: number;
  /** cash + investments + receivables - debts */
  netWorth: number;
  /** Per-account balances */
  accountBalances: Record<string, number>;
  /** Details on how each account's balance was determined */
  accountSources: AccountSource[];
  /** Details on each portfolio's contribution to investments */
  portfolioSources: PortfolioSource[];
  /**
   * Fremdwährungsbestände, die NICHT in `investments` und damit nicht in
   * `netWorth` stecken (VE-1). Leer, solange alles in Euro notiert.
   */
  unconvertedInvestments: UnconvertedInvestmentSource[];
  /** Details on each debt's contribution to total debt */
  debtSources: DebtSource[];
  /** Details on each receivable's contribution to total receivables */
  receivableSources: ReceivableSource[];
}
