import { z } from 'zod';

/**
 * zod-Schema für `Transaction` (WP 1.2, RES-2/DOM-2) — Kern-Lesegrenze für
 * die mit Abstand größte Collection. Bewusst NACHSICHTIG (kein `.strict()`,
 * `.passthrough()`): geprüft werden nur Typ und Anwesenheit von `id` (die
 * Identität, an der Merge/Upsert/Dedup hängt) sowie die Typen der Felder, die
 * TATSÄCHLICH vorkommen — nicht deren Pflicht. Unbekannte/zusätzliche Felder
 * (gewachsenes Format) bleiben über `.passthrough()` unangetastet erhalten,
 * damit ein Lese-Schreib-Zyklus sie nicht stillschweigend verwirft.
 *
 * `id` ist in `src/types.ts` als optional modelliert (neue, noch nicht
 * gespeicherte Buchungen haben noch keine) — an der Lesegrenze ist ein
 * gespeicherter Datensatz OHNE `id` dagegen ein Korruptionsfall: er lässt
 * sich später nicht mehr eindeutig aktualisieren/löschen.
 */
export const transactionCycleSchema = z.enum(['weekly', 'monthly', 'quarterly', 'yearly']);

export const transactionSchema = z
  .object({
    id: z.string().min(1),
    account_id: z.string().nullable().optional(),
    date: z.string().optional(),
    amount: z.number().optional(),
    payee: z.string().optional(),
    description: z.string().optional(),
    original_text: z.string().optional(),
    currency: z.string().optional(),
    csvCategoryName: z.string().optional(),
    category: z.string().optional(),
    category_id: z.string().nullable().optional(),
    subcategory_id: z.string().nullable().optional(),
    auto_mapped: z.boolean().optional(),
    confirmed: z.boolean().optional(),
    is_transfer: z.boolean().optional(),
    transfer_pair_id: z.string().nullable().optional(),
    counterparty_iban: z.string().nullable().optional(),
    is_contract: z.boolean().optional(),
    contract_cycle: transactionCycleSchema.nullable().optional(),
    tax_category_id: z.string().nullable().optional(),
    tax_labor_costs: z.number().nullable().optional(),
    tax_note: z.string().nullable().optional(),
    euer_private: z.boolean().optional(),
  })
  .passthrough();

export type TransactionBase = z.infer<typeof transactionSchema>;
