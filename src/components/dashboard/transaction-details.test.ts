import { describe, expect, it } from 'vitest';
import type { Category, Transaction } from '@/types';
import {
  ausgabenklasseLabel,
  currentCategoryValue,
  diffTransactionDraft,
  draftFromTransaction,
  resolveCategorySelection,
  type TransactionDetailDraft,
} from './transaction-details';

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: 't1',
    date: '2026-01-01',
    amount: -10,
    payee: 'Test',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: false,
    ...partial,
  };
}

const cats: Category[] = [
  { id: 'wohnen', name: 'Wohnen', filters: [], attributes: { ausgabenklasse: 'essenziell' } },
  { id: 'strom', name: 'Strom', filters: [], parent_id: 'wohnen' },
];
const byId = new Map(cats.map((c) => [c.id, c]));

describe('ausgabenklasseLabel', () => {
  it('übersetzt jede Klasse', () => {
    expect(ausgabenklasseLabel('essenziell')).toBe('Essenziell');
    expect(ausgabenklasseLabel('diskretionaer')).toBe('Nicht-Essenziell');
    expect(ausgabenklasseLabel('sparen')).toBe('Sparen');
    expect(ausgabenklasseLabel('einkommen')).toBe('Einkommen');
  });

  it('fällt bei null/undefined auf "Unkategorisiert" zurück', () => {
    expect(ausgabenklasseLabel(null)).toBe('Unkategorisiert');
    expect(ausgabenklasseLabel(undefined)).toBe('Unkategorisiert');
  });
});

describe('resolveCategorySelection', () => {
  it('setzt bei Hauptkategorie nur category_id', () => {
    expect(resolveCategorySelection(byId, 'wohnen')).toEqual({ category_id: 'wohnen', subcategory_id: null });
  });

  it('löst Unterkategorie zu parent + sub auf', () => {
    expect(resolveCategorySelection(byId, 'strom')).toEqual({ category_id: 'wohnen', subcategory_id: 'strom' });
  });

  it('liefert bei leerer oder unbekannter Auswahl beide null', () => {
    expect(resolveCategorySelection(byId, '')).toEqual({ category_id: null, subcategory_id: null });
    expect(resolveCategorySelection(byId, null)).toEqual({ category_id: null, subcategory_id: null });
    expect(resolveCategorySelection(byId, 'gibt-es-nicht')).toEqual({ category_id: null, subcategory_id: null });
  });
});

describe('currentCategoryValue', () => {
  it('bevorzugt die Unterkategorie', () => {
    expect(currentCategoryValue({ category_id: 'wohnen', subcategory_id: 'strom' })).toBe('strom');
  });

  it('fällt auf die Hauptkategorie zurück', () => {
    expect(currentCategoryValue({ category_id: 'wohnen', subcategory_id: null })).toBe('wohnen');
  });

  it('liefert leeren String ohne Kategorie', () => {
    expect(currentCategoryValue({ category_id: null, subcategory_id: null })).toBe('');
  });
});

describe('draftFromTransaction', () => {
  it('übernimmt vorhandene Felder', () => {
    const d = draftFromTransaction(
      tx({ category_id: 'wohnen', subcategory_id: 'strom', is_contract: true, contract_cycle: 'monthly' })
    );
    expect(d).toEqual({
      category_id: 'wohnen',
      subcategory_id: 'strom',
      is_contract: true,
      contract_cycle: 'monthly',
    });
  });

  it('setzt sinnvolle Defaults für fehlende Felder', () => {
    const d = draftFromTransaction(tx({}));
    expect(d).toEqual({ category_id: null, subcategory_id: null, is_contract: false, contract_cycle: null });
  });
});

describe('diffTransactionDraft', () => {
  const base = tx({ category_id: 'wohnen', subcategory_id: 'strom', is_contract: false, contract_cycle: null });

  it('liefert leeres Patch ohne Änderung', () => {
    expect(diffTransactionDraft(base, draftFromTransaction(base))).toEqual({});
  });

  it('erfasst geänderte Kategorie', () => {
    const draft: TransactionDetailDraft = { ...draftFromTransaction(base), category_id: 'wohnen', subcategory_id: null };
    expect(diffTransactionDraft(base, draft)).toEqual({ subcategory_id: null });
  });

  it('erfasst Vertrags-Aktivierung samt Zyklus', () => {
    const draft: TransactionDetailDraft = { ...draftFromTransaction(base), is_contract: true, contract_cycle: 'monthly' };
    expect(diffTransactionDraft(base, draft)).toEqual({ is_contract: true, contract_cycle: 'monthly' });
  });

  it('setzt den Zyklus auf null, wenn is_contract deaktiviert wird', () => {
    const withContract = tx({ is_contract: true, contract_cycle: 'monthly' });
    const draft: TransactionDetailDraft = { ...draftFromTransaction(withContract), is_contract: false };
    const patch = diffTransactionDraft(withContract, draft);
    expect(patch.is_contract).toBe(false);
    expect(patch.contract_cycle).toBeNull();
  });

  it('ignoriert einen Zyklus-Wechsel, solange is_contract aus ist', () => {
    const draft: TransactionDetailDraft = { ...draftFromTransaction(base), is_contract: false, contract_cycle: 'yearly' };
    // contract_cycle wird normalisiert auf null, da is_contract=false → kein Diff
    expect(diffTransactionDraft(base, draft)).toEqual({});
  });
});
