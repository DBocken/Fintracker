import {
  readLocalFinanceList,
  upsertLocalFinanceItem,
  deleteLocalFinanceItem,
} from './local-finance-store';
import {
  replacementPlanSchema,
  parseAtBoundary,
  safeParseAtBoundary,
} from '@/lib/schemas';
import type { z } from 'zod';
import type { ReplacementPlan } from '@/lib/schemas/replacement-plan.schema';

/**
 * CRUD-Service für lebensdauerbasierte Ersatzpläne (Slice A1, Issue #239).
 * Strikt lokal (IndexedDB via local-finance-store, optional verschlüsselt) — kein
 * Server. Jede Datengrenze wird mit zod validiert (`docs/coding-guide.md` §6):
 * beim Schreiben vollständig (ungültige Eingaben werden abgewiesen), beim Lesen
 * defensiv (korrupte/fremde Einzelsätze werden übersprungen statt die Liste zu
 * sprengen).
 */

/** Eingabe für einen neuen/aktualisierten Plan (id optional; Defaults greifen). */
export type ReplacementPlanDraft = Omit<
  z.input<typeof replacementPlanSchema>,
  'id' | 'created_at' | 'updated_at'
> & { id?: string };

export async function getReplacementPlans(): Promise<ReplacementPlan[]> {
  const raw = await readLocalFinanceList<unknown>('replacementPlans');
  const plans: ReplacementPlan[] = [];
  for (const item of raw) {
    const parsed = safeParseAtBoundary(replacementPlanSchema, item, 'ReplacementPlan');
    if (parsed.ok) plans.push(parsed.data);
  }
  return plans;
}

export async function upsertReplacementPlan(draft: ReplacementPlanDraft): Promise<ReplacementPlan> {
  const id = draft.id ?? crypto.randomUUID();
  // Validierung am Schreib-Boundary: wendet Defaults an, entfernt Unbekanntes,
  // weist Ungültiges vollständig ab (kein stilles Speichern als Nullwert).
  const validated = parseAtBoundary(replacementPlanSchema, { ...draft, id }, 'ReplacementPlan');
  return upsertLocalFinanceItem<ReplacementPlan>('replacementPlans', validated);
}

export async function deleteReplacementPlan(id: string): Promise<void> {
  await deleteLocalFinanceItem<ReplacementPlan>('replacementPlans', id);
}
