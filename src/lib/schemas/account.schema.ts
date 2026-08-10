import { z } from 'zod';

/**
 * zod-Schema für `Account` (WP 1.2, RES-2/DOM-2). Nachsichtig wie
 * `transaction.schema.ts`: nur `id` ist Pflicht, alle anderen Felder werden
 * nur typgeprüft, wenn sie vorkommen. `.passthrough()` erhält unbekannte
 * Zusatzfelder (z. B. künftige GoCardless-Felder) statt sie beim
 * Lese-Schreib-Zyklus stillschweigend zu verwerfen.
 */
export const accountTypeSchema = z.enum(['checking', 'credit_card', 'savings', 'wallet', 'cash', 'other']);

export const accountSchema = z
  .object({
    id: z.string().min(1),
    user_id: z.string().optional(),
    name: z.string().optional(),
    type: accountTypeSchema.optional(),
    currency: z.string().optional(),
    description: z.string().optional(),
    iban: z.string().nullable().optional(),
    color: z.string().optional(),
    icon: z.string().optional(),
    is_budget_pool_member: z.boolean().optional(),
    is_business: z.boolean().optional(),
    order_index: z.number().optional(),
    statement_close_day: z.number().nullable().optional(),
    due_day: z.number().nullable().optional(),
    autopay_account_id: z.string().nullable().optional(),
    gocardless_account_id: z.string().nullable().optional(),
    gocardless_requisition_id: z.string().nullable().optional(),
    gocardless_institution_id: z.string().nullable().optional(),
    gocardless_institution_name: z.string().nullable().optional(),
    last_sync_at: z.string().nullable().optional(),
    sync_enabled: z.boolean().optional(),
    bank_connection_id: z.string().nullable().optional(),
    live_balance_amount: z.number().nullable().optional(),
    live_balance_currency: z.string().nullable().optional(),
    live_balance_type: z.string().nullable().optional(),
    live_balance_updated_at: z.string().nullable().optional(),
    opening_balance: z.number().nullable().optional(),
    opening_balance_date: z.string().nullable().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export type AccountBase = z.infer<typeof accountSchema>;
