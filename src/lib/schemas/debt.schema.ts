import { z } from 'zod';

/**
 * zod-Schema für `Debt` (WP 1.2, RES-2/DOM-2). Nachsichtig wie
 * `transaction.schema.ts` — nur `id` ist Pflicht.
 */
export const debtTypeSchema = z.enum([
  'credit_card',
  'bnpl',
  'installment',
  'overdraft',
  'private_loan',
  'car_loan',
  'student_loan',
  'mortgage',
  'other',
]);

export const debtPrioritySchema = z.enum(['existenzsichernd', 'normal']);

export const debtSchema = z
  .object({
    id: z.string().min(1),
    user_id: z.string().optional(),
    name: z.string().optional(),
    type: debtTypeSchema.optional(),
    balance: z.number().optional(),
    original_amount: z.number().nullable().optional(),
    interest_rate: z.number().optional(),
    min_payment: z.number().optional(),
    due_day: z.number().nullable().optional(),
    due_date: z.string().nullable().optional(),
    is_bnpl: z.boolean().optional(),
    provider: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    is_paid_off: z.boolean().optional(),
    priority: debtPrioritySchema.nullable().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export type DebtBase = z.infer<typeof debtSchema>;
