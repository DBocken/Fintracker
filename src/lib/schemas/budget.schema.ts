import { z } from 'zod';

/**
 * zod-Schema für `Budget` (WP 1.2, RES-2/DOM-2). Nachsichtig wie
 * `transaction.schema.ts` — nur `id` ist Pflicht. `subcategory_ids`,
 * `rolloverConfig` und `rules` sind absichtlich NICHT im Shape deklariert:
 * sie sind verschachtelt/Premium-Felder, deren Form sich weiterentwickelt —
 * `.passthrough()` lässt sie unangetastet durch, statt sie gegen ein
 * unvollständig nachgebautes Unter-Schema zu prüfen und gute Datensätze zu
 * verwerfen (Vorentschieden #5, „nachsichtig, nicht streng").
 */
export const budgetPeriodSchema = z.enum(['monthly', 'weekly', 'yearly']);

export const budgetSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().optional(),
    category_id: z.string().optional(),
    limit: z.number().optional(),
    warn_threshold: z.number().optional(),
    color: z.string().optional(),
    icon: z.string().optional(),
    from_suggestion: z.boolean().optional(),
    period: budgetPeriodSchema.optional(),
    rollover: z.boolean().optional(),
    adaptive: z.boolean().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export type BudgetBase = z.infer<typeof budgetSchema>;
