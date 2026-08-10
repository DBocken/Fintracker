import { z } from 'zod';

/**
 * zod-Schema für `Receivable` (WP 1.2, RES-2/DOM-2). Nachsichtig wie
 * `transaction.schema.ts` — nur `id` ist Pflicht.
 */
export const receivableTypeSchema = z.enum(['private_loan', 'shared_expense', 'deposit', 'other']);

export const receivableSchema = z
  .object({
    id: z.string().min(1),
    user_id: z.string().optional(),
    name: z.string().optional(),
    debtor: z.string().nullable().optional(),
    type: receivableTypeSchema.optional(),
    amount: z.number().optional(),
    original_amount: z.number().nullable().optional(),
    is_cash: z.boolean().optional(),
    due_date: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    is_settled: z.boolean().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export type ReceivableBase = z.infer<typeof receivableSchema>;
