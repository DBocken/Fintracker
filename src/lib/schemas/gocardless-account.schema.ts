import { z } from 'zod';

/**
 * zod-Schema der GoCardless-Kontoantwort (GOV-1 / WP 2.2). Bis hierhin lief
 * `BankCallbackPage.tsx` mit `(result.accounts || []) as unknown as
 * GoCardlessAccount[]` — ein reiner TypeScript-Cast ohne Laufzeitprüfung an
 * einer ECHTEN Datengrenze: `result.accounts` kommt aus der Supabase Edge
 * Function `gocardless-sync`, die ihrerseits die GoCardless-API aufruft.
 * Fremde Bankdaten flossen damit ungeprüft bis in den React-State. Verletzt
 * `docs/coding-guide.md` §6 (zod an neuen Datengrenzen).
 */

export const gocardlessBalanceSchema = z.object({
  balanceType: z.string().min(1),
  balanceAmount: z.object({
    amount: z.string().min(1),
    currency: z.string().min(1),
  }),
});
export type GoCardlessBalance = z.infer<typeof gocardlessBalanceSchema>;

export const gocardlessAccountSchema = z.object({
  id: z.string().min(1),
  currency: z.string().min(1),
  iban: z.string().optional(),
  ownerName: z.string().optional(),
  name: z.string().optional(),
  product: z.string().optional(),
  status: z.string().optional(),
  balances: z.array(gocardlessBalanceSchema).optional(),
});
export type GoCardlessAccount = z.infer<typeof gocardlessAccountSchema>;

/** Die vollständige `accounts`-Liste aus der `get-accounts`-Antwort. */
export const gocardlessAccountsResponseSchema = z.array(gocardlessAccountSchema);
