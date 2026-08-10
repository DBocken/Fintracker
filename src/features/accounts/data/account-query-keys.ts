/**
 * Query-Keys der Konten-Slice — byte-identisch zu den Literalen, die vor
 * WP 6.5a in `AccountManager`/`TransferSuggestions`/`AccountsPage` standen.
 *
 * Byte-identisch ist hier keine Stilfrage: `['accounts']` wird auch von
 * `AccountsPage`, `CashSection`, der Dashboard-Slice und dem GoCardless-Sync
 * invalidiert. Ein umbenannter Schluessel wuerde nichts kaputt machen, was
 * `tsc` sieht — er wuerde still zwei Caches nebeneinander fuehren.
 */

export const accountQueryKeys = {
  /** Kontenbestand. Von mehreren Flaechen geteilt. */
  accounts: ['accounts'] as const,
  /** Konto-Limit des aktuellen Tiers. */
  limit: ['account-limit'] as const,
  /**
   * Bankfreigaben, geschluesselt ueber die Kontenliste: Kommt ein Konto dazu,
   * ist es eine andere Frage und damit ein anderer Cache-Eintrag.
   */
  consentStatuses: (accountsSignature: string) =>
    ['account-consent-statuses', accountsSignature] as const,
  /** Praefix zum Invalidieren ALLER Freigabe-Abfragen. */
  consentStatusesRoot: ['account-consent-statuses'] as const,
  transactions: ['transactions'] as const,
  transactionContracts: ['transactions', 'contracts'] as const,
  /** Vollabzug fuer die Uebertrags-Erkennung. */
  transactionsForTransfers: ['transactions', 'all-for-transfers'] as const,
  liveBalances: ['live-balances'] as const,
  netWorth: ['net-worth'] as const,
};

/** Signatur der Kontenliste fuer den Freigabe-Cache. */
export function accountsSignature(accountIds: string[]): string {
  return accountIds.join(',');
}
