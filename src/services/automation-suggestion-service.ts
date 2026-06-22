import {
  readLocalFinanceList,
  writeLocalFinanceList,
  upsertLocalFinanceItem,
  deleteLocalFinanceItem,
} from './local-finance-store';
import type { Transaction } from '@/types';
import type { CategorizationResult } from './transaction-service';

/**
 * Generisches Modell für automatische Vorschläge („Automatisch, aber nie
 * bevormundend“): Automatik erzeugt Vorschläge, der Nutzer entscheidet. Alles wird
 * **ausschließlich lokal** gespeichert.
 */

export type AutomationSuggestionKind =
  | 'category'
  | 'contract'
  | 'transfer'
  | 'salary'
  | 'receipt';

export type AutomationSuggestionStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'ignored';

export type AutomationSuggestionActionId =
  | 'accept_once'
  | 'accept_always'
  | 'reject_once'
  | 'reject_always'
  | 'edit';

export interface AutomationSuggestionAction {
  id: AutomationSuggestionActionId;
  label: string;
}

export interface AutomationSuggestion {
  id: string;
  kind: AutomationSuggestionKind;
  entityType: 'transaction' | 'contract' | 'account' | 'receipt';
  entityId: string;
  title: string;
  description: string;
  /** Heuristik (kein Wahrscheinlichkeitsmodell); UI zeigt Sicherheitsstufen. */
  confidence: number;
  reasons: string[];
  proposedChange: Record<string, unknown>;
  status: AutomationSuggestionStatus;
  created_at: string;
  updated_at?: string;
}

export async function getAutomationSuggestions(): Promise<AutomationSuggestion[]> {
  return readLocalFinanceList<AutomationSuggestion>('automationSuggestions');
}

export async function getPendingAutomationSuggestions(): Promise<AutomationSuggestion[]> {
  const all = await getAutomationSuggestions();
  return all.filter((s) => s.status === 'pending');
}

export async function upsertAutomationSuggestion(
  suggestion: AutomationSuggestion,
): Promise<AutomationSuggestion> {
  return upsertLocalFinanceItem<AutomationSuggestion>('automationSuggestions', suggestion);
}

export async function updateAutomationSuggestionStatus(
  id: string,
  status: AutomationSuggestionStatus,
): Promise<void> {
  const all = await getAutomationSuggestions();
  const index = all.findIndex((s) => s.id === id);
  if (index < 0) return;
  all[index] = { ...all[index], status, updated_at: new Date().toISOString() };
  await writeLocalFinanceList('automationSuggestions', all);
}

export async function deleteAutomationSuggestion(id: string): Promise<void> {
  await deleteLocalFinanceItem<AutomationSuggestion>('automationSuggestions', id);
}

/**
 * Brücke zwischen `explainCategorization` und dem Vorschlagsmodell: erzeugt aus einer
 * erkannten (aber nicht hochsicheren) Kategorisierung einen Vorschlag statt einer
 * stillen Änderung. `entityId` ist idempotent die Transaktions-ID, damit nicht
 * mehrere Vorschläge für dieselbe Transaktion entstehen.
 */
export function buildCategorySuggestion(
  transaction: Transaction,
  categoryId: string,
  reasons: string[],
  confidence: number,
): AutomationSuggestion {
  return {
    id: `category:${transaction.id ?? transaction.original_text}`,
    kind: 'category',
    entityType: 'transaction',
    entityId: transaction.id ?? '',
    title: `Kategorie-Vorschlag für ${transaction.payee || 'Buchung'}`,
    description: reasons[0] ?? 'Automatisch erkannter Kategorievorschlag',
    confidence,
    reasons,
    proposedChange: { category_id: categoryId },
    status: 'pending',
    created_at: new Date().toISOString(),
  };
}

/** Convenience: erzeugt einen Vorschlag direkt aus einem CategorizationResult. */
export function buildCategorySuggestionFromResult(
  transaction: Transaction,
  result: CategorizationResult,
): AutomationSuggestion | null {
  if (!result.categoryId) return null;
  return buildCategorySuggestion(
    transaction,
    result.categoryId,
    result.reasons,
    result.confidence,
  );
}
