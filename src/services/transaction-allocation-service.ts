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
 * Persistenz ausschließlich im verschlüsselbaren lokalen Finanz-Store.
 * CRUD erfolgt „replace-all pro Transaktion“,
 * damit nie ein Satz mit falscher Summe gespeichert werden kann.
 */

export type AllocationValidationError =
  | 'sum_mismatch'
  | 'sign_mismatch'
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

  // Vorzeichen-Invariante (F-MONEY-5): jede Aufteilung hat dasselbe Vorzeichen
  // wie die Originalbuchung (0 erlaubt). Sonst könnte der natürliche „Rest“-
  // Fluss gemischte Vorzeichen erzeugen (z. B. -10 € als 6 € + -16 €), die zwar
  // die signierte Summe erhalten, in den Analysen aber via Math.abs zu
  // Kategorieausgaben ÜBER dem Originalbetrag führen (6 + 16 = 22 €).
  const txSign = Math.sign(expectedMinor);
  if (txSign !== 0) {
    for (const a of allocations) {
      const s = Math.sign(a.amount_minor);
      if (s !== 0 && s !== txSign) {
        return { valid: false, ...base, error: 'sign_mismatch' };
      }
    }
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

export async function getAllocations(): Promise<TransactionAllocation[]> {
  return readLocalFinanceList<TransactionAllocation>('transactionAllocations');
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

  const all = await readLocalFinanceList<TransactionAllocation>('transactionAllocations');
  const rest = all.filter((a) => a.transaction_id !== txId);
  await writeLocalFinanceList('transactionAllocations', [...rest, ...next]);
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

  const all = await readLocalFinanceList<TransactionAllocation>('transactionAllocations');
  await writeLocalFinanceList(
    'transactionAllocations',
    all.filter((a) => !idSet.has(a.transaction_id)),
  );
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
