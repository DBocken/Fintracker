import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAutomationSuggestions,
  getPendingAutomationSuggestions,
  upsertAutomationSuggestion,
  updateAutomationSuggestionStatus,
  deleteAutomationSuggestion,
  buildCategorySuggestion,
  buildCategorySuggestionFromResult,
  type AutomationSuggestion,
} from '../automation-suggestion-service';
import { writeLocalFinanceList } from '../local-finance-store';
import type { Transaction } from '@/types';
import type { CategorizationResult } from '../transaction-service';

beforeEach(async () => {
  await writeLocalFinanceList('automationSuggestions', []);
});

function suggestion(overrides: Partial<AutomationSuggestion> = {}): AutomationSuggestion {
  return {
    id: 'sug-1',
    kind: 'category',
    entityType: 'transaction',
    entityId: 'tx-1',
    title: 'Vorschlag',
    description: 'Test',
    confidence: 0.7,
    reasons: ['Grund'],
    proposedChange: { category_id: 'food' },
    status: 'pending',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    date: '2024-01-15',
    amount: -10,
    payee: 'REWE',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: false,
    ...overrides,
  };
}

describe('automation-suggestion-service (local)', () => {
  it('upserts and reads suggestions', async () => {
    await upsertAutomationSuggestion(suggestion());
    const all = await getAutomationSuggestions();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('sug-1');
  });

  it('updates instead of duplicating on same id', async () => {
    await upsertAutomationSuggestion(suggestion());
    await upsertAutomationSuggestion(suggestion({ title: 'Geändert' }));
    const all = await getAutomationSuggestions();
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe('Geändert');
  });

  it('filters pending suggestions', async () => {
    await upsertAutomationSuggestion(suggestion({ id: 'a', status: 'pending' }));
    await upsertAutomationSuggestion(suggestion({ id: 'b', status: 'accepted' }));
    const pending = await getPendingAutomationSuggestions();
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe('a');
  });

  it('updates status', async () => {
    await upsertAutomationSuggestion(suggestion({ id: 'a' }));
    await updateAutomationSuggestionStatus('a', 'rejected');
    const all = await getAutomationSuggestions();
    expect(all[0].status).toBe('rejected');
    expect(all[0].updated_at).toBeTruthy();
  });

  it('deletes a suggestion', async () => {
    await upsertAutomationSuggestion(suggestion({ id: 'a' }));
    await deleteAutomationSuggestion('a');
    expect(await getAutomationSuggestions()).toHaveLength(0);
  });

  it('builds a category suggestion from a transaction', () => {
    const built = buildCategorySuggestion(tx(), 'food', ['Gelernte Regel'], 0.95);
    expect(built.kind).toBe('category');
    expect(built.entityId).toBe('tx-1');
    expect(built.proposedChange).toEqual({ category_id: 'food' });
    expect(built.status).toBe('pending');
    expect(built.confidence).toBe(0.95);
  });

  describe('buildCategorySuggestionFromResult', () => {
    it('returns null when the result has no categoryId (unmatched)', () => {
      const result: CategorizationResult = {
        categoryId: null,
        confidence: 0,
        reasons: [],
        source: 'none',
      };
      expect(buildCategorySuggestionFromResult(tx(), result)).toBeNull();
    });

    it('builds a suggestion mirroring the CategorizationResult when categoryId is present', () => {
      const result: CategorizationResult = {
        categoryId: 'food',
        confidence: 0.8,
        reasons: ['Filter-Treffer: REWE'],
        source: 'category_filter',
      };
      const built = buildCategorySuggestionFromResult(tx(), result);
      expect(built).not.toBeNull();
      expect(built?.proposedChange).toEqual({ category_id: 'food' });
      expect(built?.confidence).toBe(0.8);
      expect(built?.reasons).toEqual(['Filter-Treffer: REWE']);
    });
  });
});
