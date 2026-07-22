import { z } from 'zod';
import { entityRefSchema } from './entity-ref.schema';

/**
 * zod-Schema der nutzereigenen Vertrags-, Beleg- und Garantieakte (Slice B1,
 * Issue #244 — finalisiert die F1-Grundlage aus #234).
 *
 * Die Akte ERGÄNZT die bestehende Vertragserkennung, ersetzt sie nicht: der
 * optionale `fingerprint` verlinkt weich auf eine erkannte Vertragsfamilie
 * (`src/lib/merchant-fingerprint.ts`), ohne Daten zu duplizieren. Die Akte kann
 * auch ganz ohne Transaktion existieren (z. B. Garantie eines Barkaufs).
 *
 * WICHTIG: Abgeleitete Fristen (spätester Kündigungstermin, nächste Fälligkeit,
 * Restlaufzeit) sind NIE persistente Felder — sie werden immer neu berechnet
 * (`src/features/contract-records/domain/deadlines.ts`). Feldnamen lehnen sich an
 * `CategoryAttributes` an (`kuendigungsfrist_tage`, `vertragsende`).
 */

export const contractCycleSchema = z.enum(['weekly', 'monthly', 'quarterly', 'semiannual', 'annual']);
export type ContractCycle = z.infer<typeof contractCycleSchema>;

export const contractStatusSchema = z.enum(['active', 'cancelled', 'ended']);
export type ContractStatus = z.infer<typeof contractStatusSchema>;

/**
 * Beleg-/Dokument-METADATEN (Slice B2, #245). Stufe 1 speichert bewusst KEINE
 * Blobs — der kv-Store bleibt JSON-only. Optionaler `extracted_text` kommt aus
 * der bestehenden OCR-Pipeline; der eigentliche Blob-Speicher ist Slice B3 (#246,
 * entscheidungsgebunden D1).
 */
export const documentKindSchema = z.enum(['invoice', 'receipt', 'warranty', 'contract', 'other']);
export const contractDocumentSchema = z.object({
  id: z.string().min(1),
  filename: z.string().min(1),
  kind: documentKindSchema.default('other'),
  note: z.string().optional(),
  /** Optionaler Inhalts-Hash (Dedup/Integrität), kein Blob. */
  content_hash: z.string().optional(),
  /** Optionaler, on-device extrahierter Text (OCR) — kein Bild. */
  extracted_text: z.string().optional(),
  added_at: z.string().optional(),
});
export type ContractDocument = z.infer<typeof contractDocumentSchema>;

/** Ein Preisverlaufs-Punkt (Betrag in Cent zu einem Datum). */
export const priceHistoryEntrySchema = z.object({
  date: z.string().min(1),
  amount_minor: z.number().int(),
});
export type PriceHistoryEntry = z.infer<typeof priceHistoryEntrySchema>;

export const contractRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  provider: z.string().optional(),
  category: z.string().optional(),

  /** Weicher Link auf eine erkannte Vertragsfamilie (Merchant-Fingerprint). */
  fingerprint: z.string().min(1).optional(),

  /** Vertragsbeginn (ISO yyyy-mm-dd). */
  contract_start: z.string().optional(),
  /** Explizites Vertragsende (ISO) — sonst aus Beginn + Mindestlaufzeit abgeleitet. */
  vertragsende: z.string().optional(),
  /** Mindestlaufzeit in Monaten. */
  min_term_months: z.number().int().nonnegative().optional(),
  /** Kündigungsfrist in Tagen. */
  kuendigungsfrist_tage: z.number().int().nonnegative().optional(),
  /** Automatische Verlängerung um n Monate, wenn nicht gekündigt (> 0). */
  renewal_interval_months: z.number().int().positive().optional(),

  /** Optionaler Betrag in Cent + Zyklus (für die nächste Fälligkeit). */
  amount_minor: z.number().int().optional(),
  cycle: contractCycleSchema.optional(),
  /** Anker für die Fälligkeitsberechnung (ISO). */
  next_due_anchor: z.string().optional(),

  status: contractStatusSchema.default('active'),
  note: z.string().optional(),

  // --- Beleg, Garantie, Preisverlauf, Verknüpfung (Slice B2, #245) ---
  /** Beleg-/Dokument-Metadaten (keine Blobs in Stufe B2). */
  documents: z.array(contractDocumentSchema).optional(),
  /** Kaufdatum — Basis für den abgeleiteten Garantieablauf. */
  purchase_date: z.string().optional(),
  /** Garantiedauer in Monaten ab Kaufdatum. */
  warranty_months: z.number().int().nonnegative().optional(),
  /** Explizites Garantieende (ISO) — Alternative zu Kaufdatum + Dauer. */
  warranty_end: z.string().optional(),
  /** Manueller/erkannter Preisverlauf (aufsteigend nach Datum interpretiert). */
  price_history: z.array(priceHistoryEntrySchema).optional(),
  /** Generischer Verweis auf ein verknüpftes Objekt (dangling-tolerant, AD7). */
  linked_object: entityRefSchema.optional(),

  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type ContractRecord = z.infer<typeof contractRecordSchema>;
