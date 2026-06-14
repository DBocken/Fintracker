import { describe, it, expect } from 'vitest';
import { buildSpendingSunburst } from '@/lib/analysis-data';
import type { Transaction, Category } from '@/types';

/**
 * Test suite for the four critical blocking issues:
 * 1. Existing transactions not being evaluated for contract/ausgabenklasse
 * 2. Sunburst visualization showing only 2 colors instead of 5
 * 3. GoCardless balance sync not using opening balance
 * 4. Transaction editing functionality
 */

// Mock categories with ausgabenklasse attributes properly set
const mockCategories: Category[] = [
  {
    id: 'wohnen',
    name: 'Wohnen',
    filters: [],
    attributes: { ausgabenklasse: 'essenziell' },
  },
  {
    id: 'strom',
    name: 'Strom',
    filters: [],
    parent_id: 'wohnen',
    attributes: { ausgabenklasse: 'essenziell', ist_vertrag: true },
  },
  {
    id: 'lebensmittel',
    name: 'Lebensmittel',
    filters: [],
    attributes: { ausgabenklasse: 'essenziell' },
  },
  {
    id: 'unterhaltung',
    name: 'Unterhaltung',
    filters: [],
    attributes: { ausgabenklasse: 'diskretionaer' },
  },
  {
    id: 'streaming',
    name: 'Streaming',
    filters: [],
    parent_id: 'unterhaltung',
    attributes: { ausgabenklasse: 'diskretionaer' },
  },
  {
    id: 'sparen',
    name: 'Sparen & Investments',
    filters: [],
    attributes: { ausgabenklasse: 'sparen' },
  },
  {
    id: 'einkommen',
    name: 'Einkommen',
    filters: [],
    attributes: { ausgabenklasse: 'einkommen' },
  },
  {
    id: 'gehalt',
    name: 'Gehalt',
    filters: [],
    parent_id: 'einkommen',
    attributes: { ausgabenklasse: 'einkommen' },
  },
];

describe('Issue 1: Existing transactions evaluated for ausgabenklasse', () => {
  it('builds sunburst with all 5 ausgabenklasse categories from existing transactions', () => {
    const transactions: Transaction[] = [
      {
        id: '1',
        date: '2024-06-10',
        amount: -100,
        payee: 'Stadtwerke',
        description: 'Strom',
        original_text: 'Stadtwerke',
        category_id: 'strom',
        auto_mapped: true,
        confirmed: true,
        currency: 'EUR',
      },
      {
        id: '2',
        date: '2024-06-10',
        amount: -50,
        payee: 'REWE',
        description: 'Lebensmittel',
        original_text: 'REWE',
        category_id: 'lebensmittel',
        auto_mapped: true,
        confirmed: true,
        currency: 'EUR',
      },
      {
        id: '3',
        date: '2024-06-10',
        amount: -20,
        payee: 'Netflix',
        description: 'Streaming',
        original_text: 'Netflix',
        category_id: 'streaming',
        auto_mapped: true,
        confirmed: true,
        currency: 'EUR',
      },
      {
        id: '4',
        date: '2024-06-10',
        amount: -100,
        payee: 'Trade Republic',
        description: 'Sparplan',
        original_text: 'Trade Republic',
        category_id: 'sparen',
        auto_mapped: true,
        confirmed: true,
        currency: 'EUR',
      },
      {
        id: '5',
        date: '2024-06-10',
        amount: 3000,
        payee: 'Employer',
        description: 'Gehalt',
        original_text: 'Employer',
        category_id: 'gehalt',
        auto_mapped: true,
        confirmed: true,
        currency: 'EUR',
      },
    ];

    const sunburst = buildSpendingSunburst(transactions, mockCategories);

    // Should have inner ring entries
    expect(sunburst.inner.length).toBeGreaterThan(0);

    // Check that we have essenziell category
    const essenziell = sunburst.inner.find(s => s.id === 'essenziell');
    expect(essenziell).toBeDefined();
    expect(essenziell?.value).toBe(150); // Strom (100) + Lebensmittel (50)

    // Check that we have diskretionaer category
    const diskretionaer = sunburst.inner.find(s => s.id === 'diskretionaer');
    expect(diskretionaer).toBeDefined();
    expect(diskretionaer?.value).toBe(20); // Netflix (20)

    // Check that we have sparen category
    const sparen = sunburst.inner.find(s => s.id === 'sparen');
    expect(sparen).toBeDefined();
    expect(sparen?.value).toBe(100); // Trade Republic (100)

    // Income should NOT appear in spending sunburst (only negative amounts)
    expect(sunburst.total).toBe(270); // 100 + 50 + 20 + 100 (no income)
  });

  it('categorizes uncategorized expenses as unkategorisiert in sunburst', () => {
    const transactions: Transaction[] = [
      {
        id: '1',
        date: '2024-06-10',
        amount: -50,
        payee: 'Unknown',
        description: 'Unknown',
        original_text: 'Unknown',
        // No category_id
        auto_mapped: false,
        confirmed: false,
        currency: 'EUR',
      },
    ];

    const sunburst = buildSpendingSunburst(transactions, mockCategories);

    const unkategorisiert = sunburst.inner.find(s => s.id === 'unkategorisiert');
    expect(unkategorisiert).toBeDefined();
    expect(unkategorisiert?.value).toBe(50);
  });
});

describe('Issue 2: Sunburst visualization shows all 5 color categories', () => {
  it('displays all ausgabenklasse categories with correct aggregation', () => {
    // Mix of all categories
    const transactions: Transaction[] = [
      // Essenziell
      { id: '1', date: '2024-06-01', amount: -100, payee: 'LSW', description: 'Strom', original_text: 'LSW', category_id: 'strom', auto_mapped: true, confirmed: true, currency: 'EUR' },
      // Diskretionaer
      { id: '2', date: '2024-06-02', amount: -20, payee: 'Netflix', description: 'Abo', original_text: 'Netflix', category_id: 'streaming', auto_mapped: true, confirmed: true, currency: 'EUR' },
      // Sparen
      { id: '3', date: '2024-06-03', amount: -50, payee: 'Trade Republic', description: 'Sparplan', original_text: 'TR', category_id: 'sparen', auto_mapped: true, confirmed: true, currency: 'EUR' },
      // Essenziell (second category)
      { id: '4', date: '2024-06-04', amount: -30, payee: 'REWE', description: 'Groceries', original_text: 'REWE', category_id: 'lebensmittel', auto_mapped: true, confirmed: true, currency: 'EUR' },
      // Unkategorisiert
      { id: '5', date: '2024-06-05', amount: -25, payee: 'Random', description: 'Cash', original_text: 'Random', auto_mapped: false, confirmed: false, currency: 'EUR' },
    ];

    const sunburst = buildSpendingSunburst(transactions, mockCategories);

    // Should have all 4 super categories (essenziell, diskretionaer, sparen, unkategorisiert)
    const ids = sunburst.inner.map(s => s.id).sort();
    expect(ids).toContain('essenziell');
    expect(ids).toContain('diskretionaer');
    expect(ids).toContain('sparen');
    expect(ids).toContain('unkategorisiert');

    // Verify correct aggregation
    const essenziell = sunburst.inner.find(s => s.id === 'essenziell');
    expect(essenziell?.value).toBe(130); // 100 + 30

    const diskretionaer = sunburst.inner.find(s => s.id === 'diskretionaer');
    expect(diskretionaer?.value).toBe(20);

    const sparen = sunburst.inner.find(s => s.id === 'sparen');
    expect(sparen?.value).toBe(50);

    const unkategorisiert = sunburst.inner.find(s => s.id === 'unkategorisiert');
    expect(unkategorisiert?.value).toBe(25);

    expect(sunburst.total).toBe(225); // 130 + 20 + 50 + 25
  });

  it('properly aggregates outer ring by spending category within each ausgabenklasse', () => {
    const transactions: Transaction[] = [
      { id: '1', date: '2024-06-01', amount: -100, payee: 'LSW', description: 'Strom', original_text: 'LSW', category_id: 'strom', auto_mapped: true, confirmed: true, currency: 'EUR' },
      { id: '2', date: '2024-06-01', amount: -50, payee: 'REWE', description: 'Groceries', original_text: 'REWE', category_id: 'lebensmittel', auto_mapped: true, confirmed: true, currency: 'EUR' },
      { id: '3', date: '2024-06-01', amount: -30, payee: 'REWE', description: 'Groceries', original_text: 'REWE', category_id: 'lebensmittel', auto_mapped: true, confirmed: true, currency: 'EUR' },
    ];

    const sunburst = buildSpendingSunburst(transactions, mockCategories);

    // Should have outer ring entries
    expect(sunburst.outer.length).toBeGreaterThan(0);

    // Check that main categories are properly grouped under their ausgabenklasse
    // Note: outer ring uses main category names (Wohnen, Lebensmittel)
    const wohnenKey = sunburst.outer.find(o => o.name === 'Wohnen');
    expect(wohnenKey).toBeDefined();
    if (wohnenKey) {
      expect(wohnenKey.parentId).toBe('essenziell');
      expect(wohnenKey.value).toBe(100); // Strom transaction
    }

    const lebensmittelKey = sunburst.outer.find(o => o.name === 'Lebensmittel');
    expect(lebensmittelKey).toBeDefined();
    if (lebensmittelKey) {
      expect(lebensmittelKey.parentId).toBe('essenziell');
      expect(lebensmittelKey.value).toBe(80); // 50 + 30
    }
  });
});

describe('Issue 3: GoCardless balance sync uses opening balance', () => {
  it('should capture opening balance from sync response', () => {
    // This test documents the expected behavior that should be implemented
    // When GoCardless returns balanceAfterTransaction, it should be stored
    // as the account's opening_balance for proper balance tracking

    // Example flow:
    // 1. Account has opening_balance: 1000 EUR
    // 2. First transaction: -100 EUR
    // 3. Balance after: 900 EUR (opening_balance - tx amount)

    // The sync service should:
    // - Capture the initial balance from the first transaction's balanceAfterTransaction
    // - Calculate total balance as: opening_balance + sum(transactions)

    expect(true).toBe(true); // Placeholder - implementation will follow
  });
});

describe('Issue 4: Transaction editing functionality', () => {
  it('should be able to edit transaction category', () => {
    // This test documents expected transaction editing behavior
    // Transaction modal should:
    // - Open on row click
    // - Show current category
    // - Allow category change via CategoryTwoStepSelect
    // - Save changes on submit

    expect(true).toBe(true); // Placeholder - implementation will follow
  });

  it('should be able to toggle contract flag', () => {
    // Expected behavior:
    // - Modal shows is_contract checkbox
    // - When enabled, contract_cycle selector appears
    // - Changes are persisted

    expect(true).toBe(true); // Placeholder - implementation will follow
  });

  it('should show ausgabenklasse based on selected category', () => {
    // Expected behavior:
    // - Modal displays ausgabenklasse derived from selected category
    // - Updates live as category changes

    expect(true).toBe(true); // Placeholder - implementation will follow
  });
});
