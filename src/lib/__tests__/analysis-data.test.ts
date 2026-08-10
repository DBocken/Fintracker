import { describe, it, expect } from 'vitest';
import {
  sumIncome,
  sumExpenses,
  isCategoryInFilter,
  sumCategoryFlow,
  getCategoryContributions,
  resolveEssenziell,
  resolveHierarchy,
} from '../analysis-data';
import type { Transaction, Category, TransactionAllocation } from '@/types';
import { asTransactionId } from '@/lib/ids';

/**
 * Schmaler Kern der Auswertung. Der Diagramm-Aufbau (Sankey, Sunburst,
 * Einnahmen-Aufschlüsselung, Wochenmuster) lag bis WP 6.6 ebenfalls hier und
 * wird seither in `src/lib/chart-data/__tests__/` geprüft (ARCH-6) — dieselben
 * Zusicherungen, nur beim jeweiligen Modul.
 */

describe('sumIncome / sumExpenses (transferbereinigt)', () => {
  const tx = (over: Partial<Transaction>): Transaction =>
    ({ id: 'x', account_id: 'a', date: '2026-01-01', amount: 0, payee: '', description: '', ...over }) as Transaction;

  it('summiert Einnahmen und Ausgaben ohne interne Überträge (Invariante 2)', () => {
    const txs = [
      tx({ id: asTransactionId('1'), amount: 2000 }),
      tx({ id: asTransactionId('2'), amount: -500 }),
      tx({ id: asTransactionId('3'), amount: 1000, is_transfer: true }),
      tx({ id: asTransactionId('4'), amount: -1000, is_transfer: true }),
    ];
    expect(sumIncome(txs)).toBe(2000);
    expect(sumExpenses(txs)).toBe(500);
  });

  it('[REGRESSION] ein Transfer-Paar verändert die Summen nicht', () => {
    const base = [tx({ id: asTransactionId('1'), amount: 2000 }), tx({ id: asTransactionId('2'), amount: -500 })];
    const withTransfer = [...base, tx({ id: asTransactionId('3'), amount: 800, is_transfer: true }), tx({ id: asTransactionId('4'), amount: -800, is_transfer: true })];
    expect(sumIncome(withTransfer)).toBe(sumIncome(base));
    expect(sumExpenses(withTransfer)).toBe(sumExpenses(base));
  });

  it('liefert 0 für leere Eingaben', () => {
    expect(sumIncome([])).toBe(0);
    expect(sumExpenses([])).toBe(0);
  });
});

describe('sumCategoryFlow', () => {
  const tx = (over: Partial<Transaction>): Transaction =>
    ({ id: 'x', account_id: 'a', date: '2026-01-01', amount: 0, payee: '', description: '', ...over }) as Transaction;
  const cats = new Map<string, Category>([
    ['food', { id: 'food', name: 'Lebensmittel', filters: [], parent_id: null } as Category],
    ['clothes', { id: 'clothes', name: 'Kleidung', filters: [], parent_id: null } as Category],
    ['shoes', { id: 'shoes', name: 'Schuhe', filters: [], parent_id: 'clothes' } as Category],
  ]);
  const aldi = tx({ id: asTransactionId('aldi'), amount: -50, category_id: 'food' });
  const cua = tx({ id: asTransactionId('cua'), amount: -30, category_id: 'clothes' });
  const allocations = new Map<string, TransactionAllocation[]>([
    ['aldi', [
      { id: 'a-food', transaction_id: 'aldi', amount_minor: -3700, category_id: 'food', source: 'manual' } as TransactionAllocation,
      { id: 'a-clothes', transaction_id: 'aldi', amount_minor: -1300, category_id: 'clothes', source: 'manual' } as TransactionAllocation,
    ]],
  ]);

  it('sollte aufgeteilte Buchungen anteilig der gefilterten Kategorie zurechnen', () => {
    const result = sumCategoryFlow([aldi, cua], allocations, (id) => isCategoryInFilter(id, cats, 'clothes'));
    expect(result.expenses).toBeCloseTo(43, 2);
    expect(result.income).toBe(0);
  });

  it('sollte über die Hauptkategorie auch Unterkategorie-Anteile erfassen', () => {
    const withSub = new Map<string, TransactionAllocation[]>([
      ['aldi', [
        { id: 'a-shoes', transaction_id: 'aldi', amount_minor: -2000, category_id: 'clothes', subcategory_id: 'shoes', source: 'manual' } as TransactionAllocation,
        { id: 'a-food', transaction_id: 'aldi', amount_minor: -3000, category_id: 'food', source: 'manual' } as TransactionAllocation,
      ]],
    ]);
    const result = sumCategoryFlow([aldi], withSub, (id) => isCategoryInFilter(id, cats, 'clothes'));
    expect(result.expenses).toBeCloseTo(20, 2);
  });

  it('sollte Einnahmen und Ausgaben getrennt führen und Transfers ausschließen', () => {
    const gehalt = tx({ id: asTransactionId('inc'), amount: 2000, category_id: 'food' });
    const transfer = tx({ id: asTransactionId('tr'), amount: -500, category_id: 'food', is_transfer: true });
    const result = sumCategoryFlow([gehalt, transfer, aldi], undefined, (id) => isCategoryInFilter(id, cats, 'food'));
    expect(result.income).toBeCloseTo(2000, 2);
    // Ohne Aufteilungs-Map zählt die Aldi-Buchung voll in ihrer eigenen Kategorie.
    expect(result.expenses).toBeCloseTo(50, 2);
  });

  it('sollte cent-genau summieren (keine Float-Drift)', () => {
    const a = tx({ id: asTransactionId('a'), amount: -0.1, category_id: 'food' });
    const b = tx({ id: asTransactionId('b'), amount: -0.2, category_id: 'food' });
    const result = sumCategoryFlow([a, b], undefined, (id) => isCategoryInFilter(id, cats, 'food'));
    expect(result.expenses).toBe(0.3);
  });
});

describe('isCategoryInFilter', () => {
  const cats = new Map<string, Category>([
    ['main', { id: 'main', name: 'Wohnen', filters: [], parent_id: null } as Category],
    ['sub', { id: 'sub', name: 'Strom', filters: [], parent_id: 'main' } as Category],
  ]);

  it('sollte Nachfahren erfassen, Fremdkategorien ablehnen und null verkraften', () => {
    expect(isCategoryInFilter('sub', cats, 'main')).toBe(true);
    expect(isCategoryInFilter('main', cats, 'sub')).toBe(false);
    expect(isCategoryInFilter(null, cats, 'main')).toBe(false);
  });
});

describe('getCategoryContributions – Aufteilungen ohne Kategorie', () => {
  const split = (over: Partial<TransactionAllocation>): TransactionAllocation => ({
    id: 'a',
    transaction_id: 'tx',
    amount_minor: 0,
    category_id: null,
    source: 'manual',
    ...over,
  });

  it('behält den Betrag einer Aufteilung OHNE Kategorie und meldet ihn als nicht zugeordnet', () => {
    // Eine Aufteilung darf keine Kategorie tragen (Restbetrag „noch offen").
    // Fällt sie hier heraus, verschwindet echtes Geld aus jeder Auswertung, die
    // über die Beiträge summiert — die Summe der Beiträge muss dem
    // Buchungsbetrag entsprechen (Invariante des Allocation-Service).
    const t = {
      id: asTransactionId('tx'),
      account_id: 'a',
      date: '2026-01-05',
      amount: -30,
      payee: '',
      description: '',
      category_id: 'food',
    } as Transaction;
    const map = new Map<string, TransactionAllocation[]>([
      ['tx', [split({ id: 's1', amount_minor: -2000, category_id: 'food' }), split({ id: 's2', amount_minor: -1000, category_id: null, subcategory_id: null })]],
    ]);

    const parts = getCategoryContributions(t, map);
    expect(parts).toHaveLength(2);
    expect(parts[1]).toEqual({ assignedId: null, amount: -10 });
    expect(parts.reduce((s, p) => s + p.amount, 0)).toBeCloseTo(-30, 2);
  });
});

describe('resolveHierarchy – kaputte Elternkette', () => {
  it('behandelt eine Unterkategorie mit gelöschtem Elternteil als eigene Hauptkategorie', () => {
    // Wird eine Hauptkategorie gelöscht, ohne ihre Kinder umzuhängen, zeigt
    // parent_id ins Leere. Die Ausgaben müssen trotzdem irgendwo landen —
    // sonst fehlt der Betrag im Sankey/Sunburst komplett.
    const byId = new Map<string, Category>([
      ['waise', { id: 'waise', name: 'Strom', filters: [], parent_id: 'geloescht' } as Category],
    ]);
    expect(resolveHierarchy(byId, 'waise')).toEqual({
      mainId: 'waise',
      mainName: 'Strom',
      subId: null,
      subName: null,
    });
  });
});

describe('resolveEssenziell (F-UX-5)', () => {
  const cats = (list: Category[]) => new Map(list.map((c) => [c.id, c]));

  it('liefert null ohne Kategorie-ID und für eine unbekannte ID', () => {
    const byId = cats([]);
    expect(resolveEssenziell(byId, null)).toBeNull();
    expect(resolveEssenziell(byId, undefined)).toBeNull();
    expect(resolveEssenziell(byId, 'gibtsnicht')).toBeNull();
  });

  it('nimmt den eigenen Wert der Unterkategorie, bevor er geerbt wird', () => {
    const byId = cats([
      { id: 'wohnen', name: 'Wohnen', filters: [], attributes: { essenziell: true } } as Category,
      { id: 'deko', name: 'Deko', filters: [], parent_id: 'wohnen', attributes: { essenziell: false } } as Category,
    ]);
    // Nicht-essenziell trotz essenzieller Hauptkategorie: Wer den Regler auf
    // „kann weg" stellt, muss ihn im Puffer-/Kürzungsvorschlag wiederfinden.
    expect(resolveEssenziell(byId, 'deko')).toBe(false);
    expect(resolveEssenziell(byId, 'wohnen')).toBe(true);
  });

  it('erbt den Wert von der Hauptkategorie, wenn die Unterkategorie keinen hat', () => {
    const byId = cats([
      { id: 'wohnen', name: 'Wohnen', filters: [], attributes: { essenziell: true } } as Category,
      { id: 'miete', name: 'Miete', filters: [], parent_id: 'wohnen' } as Category,
    ]);
    expect(resolveEssenziell(byId, 'miete')).toBe(true);
  });

  it('liefert null, wenn die ganze Kette nichts definiert', () => {
    const byId = cats([
      { id: 'wohnen', name: 'Wohnen', filters: [] } as Category,
      { id: 'miete', name: 'Miete', filters: [], parent_id: 'wohnen' } as Category,
    ]);
    expect(resolveEssenziell(byId, 'miete')).toBeNull();
  });

  it('bricht bei einem Zyklus in der Elternkette ab, statt zu hängen', () => {
    const byId = cats([
      { id: 'a', name: 'A', filters: [], parent_id: 'b' } as Category,
      { id: 'b', name: 'B', filters: [], parent_id: 'a' } as Category,
    ]);
    expect(resolveEssenziell(byId, 'a')).toBeNull();
  });
});
