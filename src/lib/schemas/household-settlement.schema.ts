import { z } from 'zod';

/**
 * Initiales zod-Schema (Grundlage) für lokale Ausgleichsbuchungen zwischen
 * Haushaltsmitgliedern.
 *
 * Ein Ausgleich ist bewusst KEIN Transaktionstyp (Barzahlungen müssen möglich
 * sein) — er wohnt in einer eigenen Collection `householdSettlements`. Ist
 * `linked_transaction_id` gesetzt, wird die reale Transaktion als interner
 * Ausgleich klassifiziert und aus der Konsumauswertung ausgeschlossen (analog
 * Invariante 2). Beträge in Integer-Cent (`amount_minor`) — exakter Ausgleich.
 *
 * Bewusst minimal: Dieses Fundament-Issue (#234) legt das Kern-Schema fest;
 * Teilzahlungen, Status-Ableitung und Historie finalisiert Issue #248 (Slice C2).
 */
export const householdSettlementSchema = z.object({
  id: z.string().min(1),
  household_id: z.string().min(1),
  from_member_id: z.string().min(1),
  to_member_id: z.string().min(1),
  /** Ausgeglichener Betrag in Cent (Integer). */
  amount_minor: z.number().int(),
  /** Datum des Ausgleichs (ISO yyyy-mm-dd). */
  date: z.string().min(1),
  note: z.string().optional(),
  /** Optionaler Link auf die reale Transaktion, falls per Konto ausgeglichen. */
  linked_transaction_id: z.string().min(1).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type HouseholdSettlementBase = z.infer<typeof householdSettlementSchema>;
