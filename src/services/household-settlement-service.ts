import {
  readLocalFinanceList,
  upsertLocalFinanceItem,
  deleteLocalFinanceItem,
} from './local-finance-store';
import { householdSettlementSchema, parseAtBoundary, safeParseAtBoundary } from '@/lib/schemas';
import type { z } from 'zod';
import type { HouseholdSettlementBase } from '@/lib/schemas/household-settlement.schema';

/**
 * CRUD-Service für lokale Ausgleichsbuchungen zwischen Haushaltsmitgliedern
 * (Slice C2, Issue #248). Ein Ausgleich ist bewusst KEIN Transaktionstyp
 * (Barzahlungen möglich) — er lebt in einer eigenen Collection. Strikt lokal,
 * zod an beiden Boundaries. Teilzahlungen entstehen einfach durch mehrere
 * Ausgleichsbuchungen; der Status wird rein abgeleitet (siehe
 * `src/features/household-settlement/domain/balances.ts`).
 */

export type HouseholdSettlement = HouseholdSettlementBase;

export type HouseholdSettlementDraft = Omit<
  z.input<typeof householdSettlementSchema>,
  'id' | 'created_at' | 'updated_at'
> & { id?: string };

export async function getHouseholdSettlements(householdId?: string): Promise<HouseholdSettlement[]> {
  const raw = await readLocalFinanceList<unknown>('householdSettlements');
  const settlements: HouseholdSettlement[] = [];
  for (const item of raw) {
    const parsed = safeParseAtBoundary(householdSettlementSchema, item, 'HouseholdSettlement');
    if (parsed.ok) settlements.push(parsed.data);
  }
  return householdId ? settlements.filter((s) => s.household_id === householdId) : settlements;
}

export async function upsertHouseholdSettlement(
  draft: HouseholdSettlementDraft,
): Promise<HouseholdSettlement> {
  const id = draft.id ?? crypto.randomUUID();
  const validated = parseAtBoundary(
    householdSettlementSchema,
    { ...draft, id },
    'HouseholdSettlement',
  );
  return upsertLocalFinanceItem<HouseholdSettlement>('householdSettlements', validated);
}

export async function deleteHouseholdSettlement(id: string): Promise<void> {
  await deleteLocalFinanceItem<HouseholdSettlement>('householdSettlements', id);
}
