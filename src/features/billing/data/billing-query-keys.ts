/**
 * Query-Keys der Billing-Slice (Muster: `features/accounts/data/account-query-keys.ts`).
 *
 * Der Abo-Status hängt am angemeldeten Nutzer: Wechselt die Identität, ist es
 * eine andere Frage und damit ein anderer Cache-Eintrag. Ohne die userId im
 * Schlüssel sähe der nächste Nutzer auf demselben Gerät kurz das Abo seines
 * Vorgängers — der `AuthProvider` leert den Cache zwar bei Nutzerwechsel, aber
 * ein Schlüssel, der nur zufällig eindeutig ist, ist keine Zusicherung.
 */

export const billingQueryKeys = {
  subscription: (userId: string | null) => ["billing", "subscription", userId ?? "anonym"] as const,
  /** Präfix zum Invalidieren aller Abo-Abfragen. */
  subscriptionRoot: ["billing", "subscription"] as const,
};
