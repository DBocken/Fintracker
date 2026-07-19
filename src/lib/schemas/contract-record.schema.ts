import { z } from 'zod';

/**
 * Initiales zod-Schema (Grundlage) für die nutzereigene Vertrags-, Beleg- und
 * Garantieakte.
 *
 * Bewusst minimal: Dieses Fundament-Issue (#234) legt nur die Kern-Identität
 * plus den optionalen Softlink zur bestehenden Vertragserkennung
 * (`fingerprint`, siehe `src/lib/merchant-fingerprint.ts`) fest. Laufzeiten,
 * Kündigungsfristen, Garantiezeitraum und Belege finalisieren die Issues #244
 * (Slice B1) und #245 (Slice B2).
 *
 * Wichtig: Abgeleitete Fristen (spätester Kündigungstermin, nächste Fälligkeit,
 * Restlaufzeit) sind NIE persistente Felder — sie werden immer neu berechnet.
 */
export const contractRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Weicher Link auf eine erkannte Vertragsfamilie (Merchant-Fingerprint). */
  fingerprint: z.string().min(1).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type ContractRecordBase = z.infer<typeof contractRecordSchema>;
