import { describe, expect, it } from 'vitest';
import { explainCategorization } from '../transaction-service';
import type { Category, Transaction } from '../../types';

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    date: '2024-01-15',
    amount: -10,
    payee: '',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: false,
    ...overrides,
  };
}

function category(overrides: Partial<Category>): Category {
  return {
    id: overrides.id || crypto.randomUUID(),
    name: 'Kategorie',
    filters: [],
    ...overrides,
  };
}

describe('explainCategorization', () => {
  it('explains a learned merchant rule with high confidence', () => {
    const result = explainCategorization(
      tx({ payee: 'REWE Markt GmbH' }),
      [category({ id: 'food', filters: ['rewe'] })],
      [{ id: '1', user_id: 'local', merchant_pattern: 'rewe markt', category_id: 'personal' }],
    );
    expect(result.source).toBe('merchant_rule');
    expect(result.categoryId).toBe('personal');
    expect(result.confidence).toBe(0.95);
    expect(result.reasons[0]).toContain('rewe markt');
  });

  it('explains a single-filter match with 0.7 confidence', () => {
    const result = explainCategorization(
      tx({ payee: 'REWE Markt GmbH' }),
      [category({ id: 'food', filters: ['rewe'] })],
    );
    expect(result.source).toBe('category_filter');
    expect(result.categoryId).toBe('food');
    expect(result.confidence).toBe(0.7);
    expect(result.reasons).toHaveLength(1);
  });

  it('raises confidence to 0.85 when two filters match', () => {
    const result = explainCategorization(
      tx({ payee: 'Rewe Markt', description: 'Milch und Joghurt' }),
      [category({ id: 'dairy', filters: ['rewe', 'milch', 'joghurt'] })],
    );
    expect(result.source).toBe('category_filter');
    expect(result.confidence).toBe(0.85);
    expect(result.reasons.length).toBeGreaterThanOrEqual(2);
  });

  it('explains a regex fallback with 0.55 confidence', () => {
    const result = explainCategorization(
      tx({ payee: 'Aral Tankstelle Berlin', description: 'Tanken' }),
      [category({ id: 'mobility', name: 'Mobilität', filters: [] })],
    );
    expect(result.source).toBe('regex_fallback');
    expect(result.categoryId).toBe('mobility');
    expect(result.confidence).toBe(0.55);
    expect(result.reasons[0]).toContain('Mobilität');
  });

  it('returns none with zero confidence when nothing matches', () => {
    const result = explainCategorization(
      tx({ payee: 'Unbekannt', description: 'Sonstiges' }),
      [category({ id: 'food', filters: ['rewe'] })],
    );
    expect(result.source).toBe('none');
    expect(result.categoryId).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.reasons).toHaveLength(0);
  });
});
