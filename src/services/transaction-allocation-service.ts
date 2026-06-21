import { supabase } from '../integrations/supabase/client';
import { getCurrentUserId } from './auth-service';
import { readLocalFinanceList, writeLocalFinanceList } from './local-finance-store';
import { toMinor, sumMinor } from '@/lib/money';
import type { Transaction, TransactionAllocation } from '@/types';

/**
 * Aufteilung von Transaktionen auf mehrere Kategorien (Split-Buchungen).
 *
 * Invarianten (siehe TransactionAllocation in types.ts):
 *  - Summe der Aufteilungen entspricht exakt dem Betrag der Originalbuchung
 *    (cent-genau, Integer-Vergleich).
 *  - Aufteilungen sind kontoneutral – der Kontostand nutzt nur die Originalbuchung.
 *  - Manuelle Aufteilungen werden nicht ungefragt durch automatische
 *    Familien-/Ähnlichkeitsänderungen überschrieben (hasManualAllocations()).
 *
 * Persistenz wie contract-decision-service: Supabase wenn eingeloggt, sonst der
 * verschlüsselbare lokale Finanz-Store. CRUD erfolgt „replace-all pro Transaktion“,
 * damit nie ein Satz mit falscher Summe gespeichert werden kann.
 */

export type AllocationValidationError =
  | 'sum_mismatch'
  | 'orphan_transaction'
  | 'duplicate_id';

export interface AllocationValidationResult {
  valid: boolean;
  /** Erwartete Summe in Cent (toMinor(tx.amount)). */
  expectedMinor: number;
  /** Tatsächliche Summe der Aufteilungen in Cent. */
  actualMinor: number;
  /** actual - expected (0 wenn gültig). */
  deltaMinor: number;
  error?: AllocationValidationError;
}

/**
 * Reine, testbare Invarianten-Prüfung. Ein leeres Array ist gültig und bedeutet
 * „keine Aufteilung“ (Analytik fällt auf die Kategorie der Transaktion zurück).
 */
export function validateAllocations(
  transaction: Pick<Transaction, 'id' | 'amount'>,
  allocations: TransactionAllocation[],
): AllocationValidationResult {
  const expectedMinor = toMinor(transaction.amount);
  const actualMinor = sumMinor(allocations.map((a) => a.amount_minor));
  const base = { expectedMinor, actualMinor, deltaMinor: actualMinor - expectedMinor };

  if (allocations.length === 0) {
    return { valid: true, ...base, deltaMinor: 0 };
  }

  const ids = new Set<string>();
  for (const a of allocations) {
    if (a.transaction_id !== transaction.id) {
      return { valid: false, ...base, error: 'orphan_transaction' };
    }
    if (ids.has(a.id)) {
      return { valid: false, ...base, error: 'duplicate_id' };
    }
    ids.add(a.id);
  }

  if (actualMinor !== expectedMinor) {
    return { valid: false, ...base, error: 'sum_mismatch' };
  }
  return { valid: true, ...base };
}

export class AllocationInvariantError extends Error {
  constructor(public readonly result: AllocationValidationResult) {
    super(`Ungültige Transaktionsaufteilung: ${result.error} (Δ ${result.deltaMinor} Cent)`);
    this.name = 'AllocationInvariantError';
  }
}

type DbRow = {
  id: string;
  transaction_id: string;
  amount_minor: number;
  category_id: string | null;
  subcategory_id: string | null;
  label: string | null;
  source: string;
  external_origin_id: string | null;
  created_at?: string;
  updated_at?: string;
};

function fromDbRow(row: DbRow): TransactionAllocation {
  return {
    id: row.id,
    transaction_id: row.transaction_id,
    amount_minor: row.amount_minor,
    category_id: row.category_id,
    subcategory_id: row.subcategory_id,
    label: row.label,
    source: (row.source as TransactionAllocation['source']) || 'manual',
    external_origin_id: row.external_origin_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getAllocations(): Promise<TransactionAllocation[]> {
  const maybeUid = await getCurrentUserId();
  if (!maybeUid) return readLocalFinanceList<TransactionAllocation>('transactionAllocations');

  const { data, error } = await supabase
    .from('user_transaction_allocations')
    .select('*')
    .eq('user_id', maybeUid);

  if (error) throw new Error(error.message);
  return (data || []).map((r) => fromDbRow(r as DbRow));
}

export async function getAllocationsForTransaction(transactionId: string): Promise<TransactionAllocation[]> {
  const all = await getAllocations();
  return all.filter((a) => a.transaction_id === transactionId);
}

/** Map transaction_id -> Aufteilungen, für die Analytik (analysis-data). */
export async function getAllocationMap(): Promise<Map<string, TransactionAllocation[]>> {
  const all = await getAllocations();
  const map = new Map<string, TransactionAllocation[]>();
  for (const a of all) {
    const list = map.get(a.transaction_id) || [];
    list.push(a);
    map.set(a.transaction_id, list);
  }
  return map;
}

export interface AllocationInput {
  amount_minor: number;
  category_id: string | null;
  subcategory_id?: string | null;
  label?: string | null;
  source?: TransactionAllocation['source'];
  external_origin_id?: string | null;
}

/**
 * Ersetzt alle Aufteilungen einer Transaktion atomar. Validiert vorab gegen den
 * Originalbetrag und wirft bei Verletzung der Invariante – es wird in dem Fall
 * nichts persistiert. Ein leerer Eingabesatz entfernt die Aufteilung (= unsplit).
 */
export async function setAllocations(
  transaction: Pick<Transaction, 'id' | 'amount'>,
  inputs: AllocationInput[],
): Promise<TransactionAllocation[]> {
  if (!transaction.id) throw new Error('Transaktion ohne ID kann nicht aufgeteilt werden.');
  const now = new Date().toISOString();
  const txId = transaction.id;

  const next: TransactionAllocation[] = inputs.map((input) => ({
    id: crypto.randomUUID(),
    transaction_id: txId,
    amount_minor: input.amount_minor,
    category_id: input.category_id,
    subcategory_id: input.subcategory_id ?? null,
    label: input.label ?? null,
    source: input.source ?? 'manual',
    external_origin_id: input.external_origin_id ?? null,
    created_at: now,
    updated_at: now,
  }));

  const result = validateAllocations(transaction, next);
  if (!result.valid) throw new AllocationInvariantError(result);

  const maybeUid = await getCurrentUserId();
  if (!maybeUid) {
    const all = await readLocalFinanceList<TransactionAllocation>('transactionAllocations');
    const rest = all.filter((a) => a.transaction_id !== txId);
    await writeLocalFinanceList('transactionAllocations', [...rest, ...next]);
    return next;
  }

  const { error: delError } = await supabase
    .from('user_transaction_allocations')
    .delete()
    .eq('user_id', maybeUid)
    .eq('transaction_id', txId);
  if (delError) throw new Error(delError.message);

  if (next.length > 0) {
    const { error: insError } = await supabase
      .from('user_transaction_allocations')
      .insert(next.map((a) => ({ ...a, user_id: maybeUid })));
    if (insError) throw new Error(insError.message);
  }
  return next;
}

/** Entfernt alle Aufteilungen einer Transaktion (zurück zu unsplit). */
export async function clearAllocations(transactionId: string): Promise<void> {
  await deleteAllocationsForTransactions([transactionId]);
}

/** Cascade-Löschung beim Löschen von Transaktionen. */
export async function deleteAllocationsForTransactions(transactionIds: string[]): Promise<void> {
  if (transactionIds.length === 0) return;
  const idSet = new Set(transactionIds);

  const maybeUid = await getCurrentUserId();
  if (!maybeUid) {
    const all = await readLocalFinanceList<TransactionAllocation>('transactionAllocations');
    await writeLocalFinanceList(
      'transactionAllocations',
      all.filter((a) => !idSet.has(a.transaction_id)),
    );
    return;
  }

  const { error } = await supabase
    .from('user_transaction_allocations')
    .delete()
    .eq('user_id', maybeUid)
    .in('transaction_id', transactionIds);
  if (error) throw new Error(error.message);
}

/**
 * Schutz-Prädikat: enthält der Aufteilungssatz einer Transaktion manuelle
 * Einträge? Automatische Recategorisierung darf manuelle Aufteilungen nicht
 * still überschreiben.
 */
export function hasManualAllocations(
  transactionId: string,
  map: Map<string, TransactionAllocation[]>,
): boolean {
  return (map.get(transactionId) || []).some((a) => a.source === 'manual');
}
