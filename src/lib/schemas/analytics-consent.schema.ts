import { z } from 'zod';

/**
 * zod-Schema der Analytics-Einwilligung (GOV-1 / WP 2.2, Zeile 26 des
 * ursprünglichen Fundes). `readLocalFinanceList` liefert nur, was
 * `Array.isArray` prüft — der gespeicherte Eintrag selbst war bis hierhin
 * ein reiner `as unknown as Record<string, unknown>`-Cast ohne
 * Struktur-Prüfung. Ein beschädigter/fremder Datensatz darf hier NICHT
 * abstürzen (die Fläche ist eine Datenschutz-Einstellung, kein Kontostand) —
 * `.default(...)` je Feld liefert bei fehlendem/kaputtem Wert den sicheren
 * Ausgangszustand („nicht eingewilligt") statt eines Fehlerzustands.
 */
export const analyticsConsentSchema = z.object({
  user_id: z.string().default('local'),
  opted_in: z.boolean().default(false),
  consent_version: z.string().default('analytics-v1'),
  allowed_data_classes: z.array(z.string()).default(['period', 'category_group', 'measures']),
  updated_at: z.string().optional(),
  withdrawn_at: z.string().nullable().optional(),
});

export type AnalyticsConsent = z.infer<typeof analyticsConsentSchema>;
