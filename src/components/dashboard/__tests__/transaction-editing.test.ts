import { describe, it, expect } from 'vitest';
import { draftFromTransaction, diffTransactionDraft, currentCategoryValue } from '../transaction-details';
import type { Transaction, Rhythmus } from '@/types';

/**
 * Test suite for transaction editing functionality
 *
 * The TransactionDetailsModal allows editing:
 * - category_id / subcategory_id
 * - is_contract / contract_cycle
 * - visibility (soft delete)
 */

describe('Transaction Editing - Draft Management', () => {
  const mockTransaction: Transaction = {
    id: 'tx-1',
    account_id: 'acc-1',
    date: '2024-06-10',
    amount: -100,
    payee: 'Netflix',
    description: 'Monthly subscription',
    original_text: 'NETFLIX SUBS',
    currency: 'EUR',
    category_id: 'unt-1',
    subcategory_id: 'stream-1',
    auto_mapped: true,
    confirmed: true,
  };

  describe('draftFromTransaction', () => {
    it('creates a draft from transaction with category and contract info', () => {
      const draft = draftFromTransaction(mockTransaction);

      expect(draft.category_id).toBe('unt-1');
      expect(draft.subcategory_id).toBe('stream-1');
      expect(draft.is_contract).toBe(false); // Not set on transaction
      expect(draft.contract_cycle).toBe(null);
    });

    it('preserves contract information when present', () => {
      const contractTx: Transaction = {
        ...mockTransaction,
        is_contract: true,
        contract_cycle: 'monthly' as Rhythmus,
      };

      const draft = draftFromTransaction(contractTx);

      expect(draft.is_contract).toBe(true);
      expect(draft.contract_cycle).toBe('monthly');
    });

    it('handles uncategorized transactions', () => {
      const uncategorizedTx: Transaction = {
        ...mockTransaction,
        category_id: null,
        subcategory_id: null,
      };

      const draft = draftFromTransaction(uncategorizedTx);

      expect(draft.category_id).toBe(null);
      expect(draft.subcategory_id).toBe(null);
    });
  });

  describe('diffTransactionDraft', () => {
    it('creates minimal patch when category changes', () => {
      const draft = { category_id: 'wohnen', subcategory_id: null, is_contract: false, contract_cycle: null };
      const patch = diffTransactionDraft(mockTransaction, draft);

      expect(patch.category_id).toBe('wohnen');
      expect(patch.subcategory_id).toBe(null); // Changed from 'stream-1' to null
      // Should not include is_contract or contract_cycle if they didn't change
      expect(Object.keys(patch).sort()).toEqual(['category_id', 'subcategory_id']);
    });

    it('includes contract changes in patch', () => {
      const draft = {
        category_id: 'unt-1',
        subcategory_id: 'stream-1',
        is_contract: true,
        contract_cycle: 'monthly' as Rhythmus,
      };

      const patch = diffTransactionDraft(mockTransaction, draft);

      expect(patch.is_contract).toBe(true);
      expect(patch.contract_cycle).toBe('monthly');
    });

    it('clears contract_cycle when is_contract is disabled', () => {
      const contractTx: Transaction = {
        ...mockTransaction,
        is_contract: true,
        contract_cycle: 'monthly' as Rhythmus,
      };

      const draft = {
        category_id: 'unt-1',
        subcategory_id: 'stream-1',
        is_contract: false,
        contract_cycle: 'monthly' as Rhythmus, // User forgot to clear
      };

      const patch = diffTransactionDraft(contractTx, draft);

      expect(patch.is_contract).toBe(false);
      expect(patch.contract_cycle).toBe(null); // Should be cleared
    });

    it('returns empty patch when nothing changes', () => {
      const draft = draftFromTransaction(mockTransaction);
      const patch = diffTransactionDraft(mockTransaction, draft);

      expect(Object.keys(patch).length).toBe(0);
    });

    it('only includes changed fields', () => {
      const draft = {
        category_id: 'wohnen',
        subcategory_id: null,
        is_contract: false,
        contract_cycle: null,
      };

      const patch = diffTransactionDraft(mockTransaction, draft);

      // Only category changes should be in patch
      expect(Object.keys(patch).includes('category_id')).toBe(true);
      expect(Object.keys(patch).includes('subcategory_id')).toBe(true);
      // These shouldn't change
      expect(Object.keys(patch).includes('is_contract')).toBe(false);
    });

    it('marks a transaction as internal transfer', () => {
      const draft = { ...draftFromTransaction(mockTransaction), is_transfer: true };
      const patch = diffTransactionDraft(mockTransaction, draft);

      expect(patch.is_transfer).toBe(true);
      // Marking on without a pair must not touch transfer_pair_id
      expect('transfer_pair_id' in patch).toBe(false);
    });

    it('clears the pair when transfer marking is removed', () => {
      const transferTx: Transaction = {
        ...mockTransaction,
        is_transfer: true,
        transfer_pair_id: 'tx-2',
      };
      const draft = { ...draftFromTransaction(transferTx), is_transfer: false };
      const patch = diffTransactionDraft(transferTx, draft);

      expect(patch.is_transfer).toBe(false);
      expect(patch.transfer_pair_id).toBe(null);
    });

    it('ignores transfer state when the draft omits the field', () => {
      const draft = {
        category_id: 'unt-1',
        subcategory_id: 'stream-1',
        is_contract: false,
        contract_cycle: null,
      };
      const patch = diffTransactionDraft(mockTransaction, draft);

      expect('is_transfer' in patch).toBe(false);
    });
  });

  describe('currentCategoryValue', () => {
    it('returns subcategory_id if present', () => {
      const tx = { category_id: 'unt-1', subcategory_id: 'stream-1' };
      expect(currentCategoryValue(tx)).toBe('stream-1');
    });

    it('returns category_id if no subcategory', () => {
      const tx = { category_id: 'wohnen', subcategory_id: null };
      expect(currentCategoryValue(tx)).toBe('wohnen');
    });

    it('returns empty string if uncategorized', () => {
      const tx = { category_id: null, subcategory_id: null };
      expect(currentCategoryValue(tx)).toBe('');
    });
  });
});

describe('Transaction Editing - Modal Scenarios', () => {
  it('should handle category change from uncategorized to essenziell', () => {
    // Scenario: User opens uncategorized transaction and assigns it to "Wohnen"
    const uncategorizedTx: Transaction = {
      id: 'tx-1',
      date: '2024-06-10',
      amount: -50,
      payee: 'Hausmeister',
      description: 'Hausmeister-Gebühr',
      original_text: 'Hausmeister',
      category_id: null,
      subcategory_id: null,
      auto_mapped: false,
      confirmed: false,
      currency: 'EUR',
    };

    const draft = draftFromTransaction(uncategorizedTx);
    // User selects "Wohnen" category
    draft.category_id = 'wohnen';

    const patch = diffTransactionDraft(uncategorizedTx, draft);
    expect(patch.category_id).toBe('wohnen');
    // subcategory_id doesn't change (null to null), so it shouldn't be in patch
    expect(patch.subcategory_id).toBeUndefined();
  });

  it('should handle toggling contract flag with auto-selected cycle', () => {
    // Scenario: User marks Netflix as a contract
    const tx: Transaction = {
      id: 'tx-1',
      date: '2024-06-10',
      amount: -13.99,
      payee: 'Netflix',
      description: 'Monthly subscription',
      original_text: 'NETFLIX',
      category_id: 'unt-1',
      auto_mapped: true,
      confirmed: true,
      currency: 'EUR',
    };

    const draft = draftFromTransaction(tx);
    draft.is_contract = true;
    draft.contract_cycle = 'monthly';

    const patch = diffTransactionDraft(tx, draft);
    expect(patch.is_contract).toBe(true);
    expect(patch.contract_cycle).toBe('monthly');
  });

  it('should preserve unchanged category when toggling contract', () => {
    // Scenario: Category stays the same, only contract flag changes
    const contractTx: Transaction = {
      id: 'tx-1',
      date: '2024-06-01',
      amount: -100,
      payee: 'LSW',
      description: 'Electricity',
      original_text: 'LSW',
      category_id: 'strom',
      auto_mapped: true,
      confirmed: true,
      currency: 'EUR',
      is_contract: false,
    };

    const draft = draftFromTransaction(contractTx);
    draft.is_contract = true;
    draft.contract_cycle = 'monthly';

    const patch = diffTransactionDraft(contractTx, draft);

    // Category should NOT be in the patch (no change)
    expect(patch.category_id).toBeUndefined();
    expect(patch.is_contract).toBe(true);
    expect(patch.contract_cycle).toBe('monthly');
  });
});
