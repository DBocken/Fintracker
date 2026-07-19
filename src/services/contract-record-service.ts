import {
  readLocalFinanceList,
  upsertLocalFinanceItem,
  deleteLocalFinanceItem,
} from './local-finance-store';
import { contractRecordSchema, parseAtBoundary, safeParseAtBoundary } from '@/lib/schemas';
import type { z } from 'zod';
import type { ContractRecord } from '@/lib/schemas/contract-record.schema';

/**
 * CRUD-Service für die nutzereigene Vertrags-/Beleg-/Garantieakte (Slice B1,
 * Issue #244). Strikt lokal, zod an beiden Boundaries. Die Akte ERGÄNZT die
 * abgeleitete Vertragserkennung (`contract-derivation.ts`) und den schmalen
 * Entscheidungs-Cache `ContractDecision` — beide bleiben unverändert.
 */

export type ContractRecordDraft = Omit<
  z.input<typeof contractRecordSchema>,
  'id' | 'created_at' | 'updated_at'
> & { id?: string };

export async function getContractRecords(): Promise<ContractRecord[]> {
  const raw = await readLocalFinanceList<unknown>('contractRecords');
  const records: ContractRecord[] = [];
  for (const item of raw) {
    const parsed = safeParseAtBoundary(contractRecordSchema, item, 'ContractRecord');
    if (parsed.ok) records.push(parsed.data);
  }
  return records;
}

export async function upsertContractRecord(draft: ContractRecordDraft): Promise<ContractRecord> {
  const id = draft.id ?? crypto.randomUUID();
  const validated = parseAtBoundary(contractRecordSchema, { ...draft, id }, 'ContractRecord');
  return upsertLocalFinanceItem<ContractRecord>('contractRecords', validated);
}

export async function deleteContractRecord(id: string): Promise<void> {
  await deleteLocalFinanceItem<ContractRecord>('contractRecords', id);
}
