import { z } from 'zod';

/**
 * zod-Schema der lebensdauerbasierten Ersatzplanung (Slice A1, Issue #239 —
 * finalisiert die F1-Grundlage aus #234).
 *
 * Konvention (an bestehende persistierte Collections wie SpecialCategory
 * angelehnt): snake_case-Feldnamen, Geldbeträge als Integer-Cent (`*_minor`),
 * Zeitstempel als ISO-Strings. Die drei finanziellen Sichten (ökonomische
 * Nutzungskosten / Rücklagenbewegung / tatsächlicher Ersatz-Cashflow) werden
 * NICHT im Datensatz vermischt — sie sind reine Ableitungen (siehe
 * `src/features/replacement-planning/domain/replacement-plan.ts`).
 */

/**
 * Preisentwicklungs-Modus. Die pauschale Verbraucherpreisinflation wird bewusst
 * NICHT blind auf alle Gegenstände angewendet:
 * - `stable`: Preis bleibt ungefähr konstant (z. B. Elektronik).
 * - `inflation`: allgemeine Inflation (Default-Rate, lokal konfigurierbar, D2).
 * - `individual`: eigene jährliche Rate (`price_rate_annual`).
 */
export const priceModeSchema = z.enum(['stable', 'inflation', 'individual']);
export type PriceMode = z.infer<typeof priceModeSchema>;

export const replacementPlanSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.string().optional(),

  /** Heutiger Wiederbeschaffungspreis in Cent (Integer, ≥ 0). */
  replacement_cost_minor: z.number().int().nonnegative(),

  /** Erwartete Gesamt-Lebensdauer in Monaten (> 0) — Basis der Nutzungskosten. */
  lifespan_months: z.number().int().positive(),

  /** Kaufdatum (ISO yyyy-mm-dd) — optional; alternativ Restlebensdauer. */
  purchase_date: z.string().optional(),
  /** Geschätzte Restlebensdauer in Monaten (≥ 0) — Alternative zum Kaufdatum. */
  remaining_lifespan_months: z.number().int().nonnegative().optional(),

  /** Bereits vorhandene Ersatzrücklage in Cent (≥ 0). Default 0. */
  reserve_minor: z.number().int().nonnegative().default(0),
  /** Reservekonto, auf dem angespart wird (optional in Stufe A1). */
  reserve_account_id: z.string().optional(),
  /** Operatives Konto, von dem Beiträge fließen (optional in Stufe A1). */
  funded_from_account_id: z.string().optional(),

  /** Preisentwicklungs-Modus. Default: allgemeine Inflation. */
  price_mode: priceModeSchema.default('inflation'),
  /** Jährliche Rate für `price_mode='individual'` (z. B. 0.03 = 3 %). */
  price_rate_annual: z.number().optional(),

  /** Optionaler Restwert des Altgeräts beim Ersatz, in Cent (≥ 0). */
  residual_value_minor: z.number().int().nonnegative().optional(),

  /** Fester geplanter Ersatztermin (ISO) — die erste Ausbaustufe (A1). */
  planned_replacement_date: z.string().optional(),

  /**
   * Ersatzfenster (früh/wahrscheinlich/spät) — in A1 nur als Datenfelder
   * gespeichert; die probabilistische Auswertung erfolgt in A3 (#241).
   */
  earliest_replacement_date: z.string().optional(),
  likely_replacement_date: z.string().optional(),
  latest_replacement_date: z.string().optional(),

  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

/** Der finalisierte Ersatzplan-Typ (Single Source of Truth: das zod-Schema). */
export type ReplacementPlan = z.infer<typeof replacementPlanSchema>;
