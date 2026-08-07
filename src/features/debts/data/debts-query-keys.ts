/**
 * Query-Schlüssel der Schulden-Fläche.
 *
 * `DEBT_DEPENDENT_KEYS` ist die Liste der Flächen, die eine Änderung an einer
 * Schuld mitbekommen müssen. Sie stand zuvor als offene Aufzählung in einer
 * `invalidate()`-Funktion mitten in der Seite — wer eine neue abhängige Fläche
 * baut, findet sie dort nicht.
 */
export const debtsKeys = {
  debts: ["debts"] as const,
  assignments: ["debt-transaction-assignments"] as const,
  /** Buchungen, aus denen Tilgungen zugeordnet werden (bewusst begrenzt). */
  assignableTransactions: ["transactions", "debt-assignment"] as const,
  financialHealth: (locale: string) => ["financial-health", locale] as const,
};

/** Wie viele Buchungen für die Zuordnung geladen werden. */
export const DEBT_ASSIGNABLE_TRANSACTION_LIMIT = 500;

/**
 * Alles, was von einer Schuld abhängt: Netto-Vermögen, Coach, Meilensteine,
 * Finanz-Gesundheit. Eine Änderung an einer Schuld verschiebt jede dieser
 * Aussagen — stünde eine davon nicht hier, zeigte sie stillschweigend veraltete
 * Zahlen, bis der Nutzer neu lädt.
 */
export const DEBT_DEPENDENT_KEYS: readonly (readonly string[])[] = [
  ["debts"],
  ["debt-transaction-assignments"],
  ["coach-insights"],
  ["milestones"],
  ["net-worth"],
  ["financial-health"],
  ["coach-overview"],
  ["has-finance-data"],
];
