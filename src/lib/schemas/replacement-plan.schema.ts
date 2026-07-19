import { z } from 'zod';

/**
 * Initiales zod-Schema (Grundlage) für die lebensdauerbasierte Ersatzplanung.
 *
 * Bewusst minimal: Dieses Fundament-Issue (#234) legt nur die Kern-Identität
 * fest. Die vollständigen fachlichen Felder — Preisentwicklungs-Modus
 * (stabil/Inflation/individuell), Restwert, Lebensdauer, Ersatzfenster
 * (früh/wahrscheinlich/spät) — finalisiert Issue #239 (Slice A1) durch
 * Erweiterung dieses Schemas.
 *
 * Konvention (an bestehende persistierte Collections angelehnt, z. B.
 * SpecialCategory): snake_case-Feldnamen, Geldbeträge als Integer-Cent
 * (`*_minor`), Zeitstempel als ISO-Strings (`created_at`/`updated_at`, von
 * `local-finance-store` gestempelt).
 */
export const replacementPlanSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Heutiger Wiederbeschaffungspreis in Cent (Integer, ≥ 0). */
  replacement_cost_minor: z.number().int().nonnegative(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type ReplacementPlanBase = z.infer<typeof replacementPlanSchema>;
