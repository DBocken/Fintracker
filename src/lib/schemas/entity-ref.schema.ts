import { z } from 'zod';

/**
 * zod-Spiegel der `EntityRef`-Konvention (`src/lib/entity-ref.ts`). Die Union
 * MUSS synchron zu `EntityKind` dort gehalten werden — ein neues Modul ergänzt
 * beide Stellen (Typ + dieses Schema).
 */
export const entityKindSchema = z.enum(['transaction', 'contract_record', 'replacement_plan']);

export const entityRefSchema = z.object({
  kind: entityKindSchema,
  id: z.string().min(1),
});

export type EntityRefInput = z.infer<typeof entityRefSchema>;
