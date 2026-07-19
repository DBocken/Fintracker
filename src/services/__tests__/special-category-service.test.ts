import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Transaction } from '@/types';
import { localEncryption } from '../local-crypto';
import { writeLocalFinanceList } from '../local-finance-store';
import {
  SpecialCategoryError,
  assignTransaction,
  deleteAssignmentsForTransactions,
  deleteSpecialCategory,
  getSpecialCategories,
  getSpecialCategoryAssignments,
  saveSpecialCategory,
} from '../special-category-service';

// getTransactions steuerbar halten – die übrige Persistenz läuft echt über den
// lokalen Finanz-Store (localStorage in jsdom).
const { txStore } = vi.hoisted(() => ({ txStore: { current: [] as Transaction[] } }));
vi.mock('../transaction-service', () => ({
  getTransactions: async () => txStore.current,
}));

function tx(id: string, amount: number): Transaction {
  return {
    id,
    date: '2026-09-05',
    amount,
    payee: 'P',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: true,
  };
}

beforeEach(async () => {
  localStorage.clear();
  window.localStorage.setItem('ausgabentracker_locale_v1', 'de');
  localEncryption.lock();
  txStore.current = [];
  await writeLocalFinanceList('specialCategories', []);
  await writeLocalFinanceList('specialCategoryAssignments', []);
});

describe('special-category-service', () => {
  describe('saveSpecialCategory', () => {
    it('sollte einen Anlass anlegen', async () => {
      const cat = await saveSpecialCategory({ name: 'Hochzeit' });
      expect(cat.id).toBeTruthy();
      expect((await getSpecialCategories()).map((c) => c.name)).toEqual(['Hochzeit']);
    });

    it('sollte einen leeren Namen ablehnen', async () => {
      await expect(saveSpecialCategory({ name: '   ' })).rejects.toBeInstanceOf(SpecialCategoryError);
    });

    it('sollte einen Zyklus ablehnen (I1)', async () => {
      const hochzeit = await saveSpecialCategory({ name: 'Hochzeit' });
      await saveSpecialCategory({ name: 'Flitterwochen', parent_id: hochzeit.id });
      const flitter = (await getSpecialCategories()).find((c) => c.name === 'Flitterwochen')!;
      // Hochzeit unter ihr eigenes Kind hängen → Zyklus.
      await expect(
        saveSpecialCategory({ id: hochzeit.id, name: 'Hochzeit', parent_id: flitter.id }),
      ).rejects.toMatchObject({ code: 'cycle' });
    });
  });

  describe('deleteSpecialCategory (S10/I6)', () => {
    async function seedTree() {
      const hochzeit = await saveSpecialCategory({ name: 'Hochzeit' });
      const flitter = await saveSpecialCategory({ name: 'Flitterwochen', parent_id: hochzeit.id });
      return { hochzeit, flitter };
    }

    it('sollte Kinder standardmäßig zum Großelternteil umhängen', async () => {
      const { hochzeit, flitter } = await seedTree();
      const result = await deleteSpecialCategory(hochzeit.id);
      expect(result.deletedIds).toEqual([hochzeit.id]);
      expect(result.reparentedIds).toEqual([flitter.id]);
      const cats = await getSpecialCategories();
      expect(cats.map((c) => c.id)).toEqual([flitter.id]);
      expect(cats[0].parent_id ?? null).toBeNull(); // jetzt oberste Ebene.
    });

    it('sollte mit deleteChildren den ganzen Teilbaum entfernen', async () => {
      const { hochzeit } = await seedTree();
      const result = await deleteSpecialCategory(hochzeit.id, { deleteChildren: true });
      expect(result.deletedIds.sort()).toHaveLength(2);
      expect(await getSpecialCategories()).toHaveLength(0);
    });

    it('sollte Zuordnungen der gelöschten Anlässe mitentfernen', async () => {
      const { hochzeit } = await seedTree();
      await assignTransaction({ specialCategoryId: hochzeit.id, transactionId: 't1' });
      const result = await deleteSpecialCategory(hochzeit.id, { deleteChildren: true });
      expect(result.removedAssignments).toBe(1);
      expect(await getSpecialCategoryAssignments()).toHaveLength(0);
    });

    it('sollte einen unbekannten Anlass ablehnen', async () => {
      await expect(deleteSpecialCategory('gibtsnicht')).rejects.toMatchObject({ code: 'notFound' });
    });
  });

  describe('assignTransaction', () => {
    it('sollte eine ganze Buchung zuordnen (S2)', async () => {
      const cat = await saveSpecialCategory({ name: 'Flitterwochen' });
      const asg = await assignTransaction({ specialCategoryId: cat.id, transactionId: 't1' });
      expect(asg.special_category_id).toBe(cat.id);
      expect(asg.amount_minor ?? null).toBeNull();
      expect(await getSpecialCategoryAssignments()).toHaveLength(1);
    });

    it('sollte eine Doppelzuordnung ablehnen (I2/S8)', async () => {
      const cat = await saveSpecialCategory({ name: 'Flitterwochen' });
      await assignTransaction({ specialCategoryId: cat.id, transactionId: 't1' });
      await expect(
        assignTransaction({ specialCategoryId: cat.id, transactionId: 't1' }),
      ).rejects.toMatchObject({ code: 'duplicateAssignment' });
    });

    it('sollte einen Teilbetrag über dem freien Rest ablehnen (I3/S9)', async () => {
      txStore.current = [tx('t1', -100)]; // 100,00 € Buchung
      const feier = await saveSpecialCategory({ name: 'Feier' });
      const flitter = await saveSpecialCategory({ name: 'Flitterwochen' });
      await assignTransaction({ specialCategoryId: feier.id, transactionId: 't1', amountMinor: 8000 });
      await expect(
        assignTransaction({ specialCategoryId: flitter.id, transactionId: 't1', amountMinor: 3000 }),
      ).rejects.toMatchObject({ code: 'exceedsAmount' });
    });

    it('sollte einen Anlass unbekannter ID ablehnen', async () => {
      await expect(
        assignTransaction({ specialCategoryId: 'weg', transactionId: 't1' }),
      ).rejects.toMatchObject({ code: 'notFound' });
    });
  });

  describe('deleteAssignmentsForTransactions (Cleanup)', () => {
    it('sollte alle Zuordnungen der genannten Buchungen entfernen', async () => {
      const cat = await saveSpecialCategory({ name: 'Flitterwochen' });
      await assignTransaction({ specialCategoryId: cat.id, transactionId: 't1' });
      await assignTransaction({ specialCategoryId: cat.id, transactionId: 't2' });
      await deleteAssignmentsForTransactions(['t1']);
      const rest = await getSpecialCategoryAssignments();
      expect(rest.map((a) => a.transaction_id)).toEqual(['t2']);
    });
  });
});
