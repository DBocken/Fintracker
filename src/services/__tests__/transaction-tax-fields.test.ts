import { describe, it, expect, beforeEach } from 'vitest';
import { saveTransactions, updateTransaction, getAllTransactions } from '../transaction-service';
import { transactionStorage } from '../transaction-storage-service';
import type { Transaction } from '../../types';
import { asTransactionId } from '@/lib/ids';

function tx(overrides: Omit<Partial<Transaction>, 'id'> & { id?: string }): Transaction {
  return {
    date: '2025-03-10',
    amount: -1800,
    payee: 'Malerbetrieb Müller',
    description: 'Renovierung',
    original_text: 'Malerbetrieb Müller',
    auto_mapped: true,
    confirmed: false,
    ...overrides,
    id: overrides.id !== undefined ? asTransactionId(overrides.id) : asTransactionId(overrides.id || crypto.randomUUID()),
  };
}

async function seed(t: Transaction): Promise<string> {
  await saveTransactions([t]);
  return t.id!;
}

async function reload(id: string): Promise<Transaction> {
  const all = await getAllTransactions();
  const found = all.find((x) => x.id === id);
  if (!found) throw new Error('transaction not found after reload');
  return found;
}

describe('Transaction Steuer-Felder', () => {
  beforeEach(async () => {
    localStorage.setItem('ausgabentracker_locale_v1', 'de');
    await transactionStorage.clearLocalCache();
  });

  describe('Normal Behavior', () => {
    it('sollte tax_category_id, tax_labor_costs und tax_note durchleiten', async () => {
      const id = await seed(tx({}));

      await updateTransaction([
        { id, tax_category_id: 'tax-35a3-handwerker', tax_labor_costs: 1200, tax_note: 'Rechnung 2025-104' },
      ]);

      const after = await reload(id);
      expect(after.tax_category_id).toBe('tax-35a3-handwerker');
      expect(after.tax_labor_costs).toBe(1200);
      expect(after.tax_note).toBe('Rechnung 2025-104');
    });

    it('sollte die Markierung per null wieder entfernen', async () => {
      const id = await seed(tx({ tax_category_id: 'tax-35a3-handwerker', tax_labor_costs: 1200 }));

      await updateTransaction([{ id, tax_category_id: null, tax_labor_costs: null, tax_note: null }]);

      const after = await reload(id);
      expect(after.tax_category_id).toBeNull();
      expect(after.tax_labor_costs).toBeNull();
      expect(after.tax_note).toBeNull();
    });
  });

  describe('Regression Protection', () => {
    it('[REGRESSION] sollte bei reiner Steuer-Markierung confirmed/auto_mapped NICHT verändern', async () => {
      // Ausgangslage: automatisch zugeordnet, noch nicht bestätigt.
      const id = await seed(tx({ auto_mapped: true, confirmed: false }));

      await updateTransaction([{ id, tax_category_id: 'tax-35a3-handwerker' }]);

      const after = await reload(id);
      // Eine Steuer-Markierung ist keine Kategorie-Korrektur — Status bleibt unberührt.
      expect(after.auto_mapped).toBe(true);
      expect(after.confirmed).toBe(false);
    });

    it('[REGRESSION] sollte bei Kategorie-Korrektur weiterhin confirmed=true/auto_mapped=false setzen', async () => {
      const id = await seed(tx({ auto_mapped: true, confirmed: false }));

      await updateTransaction([{ id, category_id: 'local-cat-wohnen' }]);

      const after = await reload(id);
      expect(after.auto_mapped).toBe(false);
      expect(after.confirmed).toBe(true);
    });

    it('[REGRESSION] sollte nicht übergebene Steuer-Felder unangetastet lassen', async () => {
      const id = await seed(tx({ tax_category_id: 'tax-35a3-handwerker', tax_labor_costs: 1200 }));

      // Nur die Notiz patchen — Rubrik und Arbeitskosten dürfen erhalten bleiben.
      await updateTransaction([{ id, tax_note: 'ergänzt' }]);

      const after = await reload(id);
      expect(after.tax_category_id).toBe('tax-35a3-handwerker');
      expect(after.tax_labor_costs).toBe(1200);
      expect(after.tax_note).toBe('ergänzt');
    });
  });
});
