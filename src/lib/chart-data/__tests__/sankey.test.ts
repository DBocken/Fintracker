import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildSankeyData, buildSankeyDataByKlasse } from '../sankey';
import { buildSpendingSunburst } from '../sunburst';
import { getCategoryContributions } from '@/lib/analysis-data';
import type { Account, Transaction, Category } from '@/types';
import { asTransactionId } from '@/lib/ids';

/**
 * Lag bis WP 6.6 in `src/lib/__tests__/analysis-data.test.ts` — mit dem Modul
 * mitgewandert (ARCH-6). Die Zusicherungen sind unverändert. Eigener
 * beforeEach/afterEach für die Locale, da die hier geprüften Labels
 * ("Unkategorisiert", "Sonstiges Konto") übersetzt sind.
 */
describe('buildSankeyData (Sankey-Aufbereitung)', () => {
  beforeEach(() => {
    window.localStorage.setItem('ausgabentracker_locale_v1', 'de');
  });

  afterEach(() => {
    window.localStorage.removeItem('ausgabentracker_locale_v1');
  });

  function tx(partial: Omit<Partial<Transaction>, 'id'> & { id?: string }): Transaction {
    return {
      date: '2026-01-05',
      amount: -10,
      payee: 'Test',
      description: '',
      original_text: '',
      auto_mapped: false,
      confirmed: true,
      ...partial,
    id: partial.id !== undefined ? asTransactionId(partial.id) : undefined,
    };
  }

  function acc(partial: Partial<Account>): Account {
    return {
      id: 'acc-default',
      user_id: 'user-1',
      name: 'Konto',
      type: 'checking',
      currency: 'EUR',
      color: '#3b82f6',
      icon: 'bank',
      is_budget_pool_member: true,
      order_index: 0,
      ...partial,
    };
  }

  const categories: Category[] = [
    { id: 'main-wohnen', name: 'Wohnen', filters: [] },
    { id: 'sub-miete', name: 'Miete', filters: [], parent_id: 'main-wohnen' },
    { id: 'sub-strom', name: 'Strom', filters: [], parent_id: 'main-wohnen' },
    { id: 'main-mobil', name: 'Mobilität', filters: [] },
  ];

  describe('buildSankeyData (Issue #40)', () => {
    it('summiert Einnahmen getrennt von Ausgaben', () => {
      const result = buildSankeyData(
        [tx({ amount: 2500 }), tx({ amount: 300 }), tx({ amount: -800, category_id: 'main-wohnen' })],
        categories
      );
      expect(result.totalIncome).toBe(2800);
      expect(result.mainCategories).toHaveLength(1);
      expect(result.mainCategories[0]).toMatchObject({ id: 'main-wohnen', amount: 800 });
    });

    it('rollt Unterkategorien zur Hauptkategorie hoch und führt sie separat', () => {
      const result = buildSankeyData(
        [
          tx({ amount: -700, subcategory_id: 'sub-miete' }),
          tx({ amount: -100, subcategory_id: 'sub-strom' }),
          tx({ amount: -50, category_id: 'main-mobil' }),
        ],
        categories
      );
      const wohnen = result.mainCategories.find((m) => m.id === 'main-wohnen');
      expect(wohnen?.amount).toBe(800);
      expect(result.subCategories.map((s) => s.id)).toEqual(['sub-miete', 'sub-strom']);
      expect(result.subCategories[0]).toMatchObject({ mainId: 'main-wohnen', amount: 700 });
    });

    it('sortiert Hauptkategorien absteigend nach Betrag', () => {
      const result = buildSankeyData(
        [tx({ amount: -50, category_id: 'main-wohnen' }), tx({ amount: -200, category_id: 'main-mobil' })],
        categories
      );
      expect(result.mainCategories.map((m) => m.id)).toEqual(['main-mobil', 'main-wohnen']);
    });

    it("ordnet Transaktionen ohne Kategorie 'Unkategorisiert' zu", () => {
      const result = buildSankeyData([tx({ amount: -42 })], categories);
      expect(result.mainCategories[0].name).toBe('Unkategorisiert');
      expect(result.mainCategories[0].amount).toBe(42);
    });

    it('behandelt unbekannte Kategorie-IDs wie Unkategorisiert', () => {
      const result = buildSankeyData([tx({ amount: -10, category_id: 'gibt-es-nicht' })], categories);
      expect(result.mainCategories[0].name).toBe('Unkategorisiert');
    });

    it('ist robust gegen Zyklen in der Kategorie-Hierarchie', () => {
      const cyclic: Category[] = [
        { id: 'a', name: 'A', filters: [], parent_id: 'b' },
        { id: 'b', name: 'B', filters: [], parent_id: 'a' },
      ];
      const result = buildSankeyData([tx({ amount: -10, category_id: 'a' })], cyclic);
      expect(result.mainCategories).toHaveLength(1);
    });

    it('liefert leere Strukturen ohne Transaktionen', () => {
      const result = buildSankeyData([], categories);
      expect(result).toEqual({ totalIncome: 0, accounts: [], mainCategories: [], subCategories: [] });
    });
  });

  describe('buildSankeyData – Konten (Variante 1: Netto je Konto)', () => {
    const giro = acc({ id: 'acc-giro', name: 'Girokonto', color: '#3b82f6' });
    const spar = acc({ id: 'acc-spar', name: 'Sparkonto', color: '#22c55e' });

    it('berechnet Einnahmen, Ausgaben und Netto je Konto', () => {
      const result = buildSankeyData(
        [
          tx({ amount: 2000, account_id: 'acc-giro' }),
          tx({ amount: -500, account_id: 'acc-giro', category_id: 'main-wohnen' }),
          tx({ amount: 100, account_id: 'acc-spar' }),
        ],
        categories,
        [giro, spar]
      );

      const giroNode = result.accounts.find((a) => a.id === 'acc-giro');
      const sparNode = result.accounts.find((a) => a.id === 'acc-spar');

      expect(giroNode).toMatchObject({ name: 'Girokonto', income: 2000, expenses: 500, net: 1500, color: '#3b82f6' });
      expect(sparNode).toMatchObject({ name: 'Sparkonto', income: 100, expenses: 0, net: 100, color: '#22c55e' });
    });

    it('schlüsselt Ausgaben je Hauptkategorie nach Konto auf', () => {
      const result = buildSankeyData(
        [
          tx({ amount: -300, account_id: 'acc-giro', category_id: 'main-wohnen' }),
          tx({ amount: -200, account_id: 'acc-spar', category_id: 'main-wohnen' }),
        ],
        categories,
        [giro, spar]
      );

      const wohnen = result.mainCategories.find((m) => m.id === 'main-wohnen');
      expect(wohnen?.byAccount).toEqual({ 'acc-giro': 300, 'acc-spar': 200 });
    });

    it("ordnet Transaktionen ohne Konto-Zuordnung 'Sonstiges Konto' zu", () => {
      const result = buildSankeyData([tx({ amount: -50, category_id: 'main-wohnen' })], categories, [giro]);
      expect(result.accounts).toHaveLength(1);
      expect(result.accounts[0]).toMatchObject({ name: 'Sonstiges Konto', expenses: 50 });
    });

    it('ignoriert Konten ohne Einnahmen oder Ausgaben', () => {
      const result = buildSankeyData(
        [tx({ amount: -50, account_id: 'acc-giro', category_id: 'main-wohnen' })],
        categories,
        [giro, spar]
      );
      expect(result.accounts.map((a) => a.id)).toEqual(['acc-giro']);
    });

    it('sortiert Konten absteigend nach Gesamtaktivität (Einnahmen + Ausgaben)', () => {
      const result = buildSankeyData(
        [
          tx({ amount: -50, account_id: 'acc-spar', category_id: 'main-wohnen' }),
          tx({ amount: 2000, account_id: 'acc-giro' }),
          tx({ amount: -500, account_id: 'acc-giro', category_id: 'main-wohnen' }),
        ],
        categories,
        [giro, spar]
      );
      expect(result.accounts.map((a) => a.id)).toEqual(['acc-giro', 'acc-spar']);
    });
  });

  describe('buildSankeyDataByKlasse – Ausgabenklasse-Aggregation', () => {
    const klassCats: Category[] = [
      { id: 'wohnen', name: 'Wohnen', filters: [], attributes: { ausgabenklasse: 'essenziell' } },
      { id: 'miete', name: 'Miete', filters: [], parent_id: 'wohnen', attributes: { ausgabenklasse: 'essenziell' } },
      { id: 'mobil', name: 'Mobilität', filters: [], attributes: { ausgabenklasse: 'diskretionaer' } },
      { id: 'kraftstoff', name: 'Kraftstoff', filters: [], parent_id: 'mobil', attributes: { ausgabenklasse: 'essenziell' } },
      { id: 'streaming', name: 'Streaming', filters: [], attributes: { ausgabenklasse: 'diskretionaer' } },
      { id: 'sparen', name: 'Sparen', filters: [], attributes: { ausgabenklasse: 'sparen' } },
    ];

    it('fügt Ausgabenklassen-Layer zwischen Konten und Hauptkategorien ein', () => {
      const result = buildSankeyDataByKlasse(
        [
          tx({ amount: -700, category_id: 'miete' }),
          tx({ amount: -60, category_id: 'kraftstoff' }),
          tx({ amount: -40, category_id: 'streaming' }),
          tx({ amount: -200, category_id: 'sparen' }),
        ],
        klassCats
      );
      expect(result.klassen).toHaveLength(3);
      const klassen = Object.fromEntries(result.klassen.map((k) => [k.id, k.amount]));
      expect(klassen.essenziell).toBe(760); // Miete 700 + Kraftstoff 60
      expect(klassen.diskretionaer).toBe(40); // Streaming
      expect(klassen.sparen).toBe(200);
    });

    it('behält Hauptkategorien bei (für Drilldown)', () => {
      const result = buildSankeyDataByKlasse(
        [
          tx({ amount: -300, category_id: 'miete' }),
          tx({ amount: -200, category_id: 'streaming' }),
        ],
        klassCats
      );
      expect(result.mainCategories).toHaveLength(2);
      expect(result.mainCategories.map((m) => m.id)).toContain('wohnen');
      expect(result.mainCategories.map((m) => m.id)).toContain('streaming');
    });

    it('behandelt unkategorisierte Ausgaben in eigener Klasse', () => {
      const result = buildSankeyDataByKlasse([tx({ amount: -50 })], klassCats);
      const unkategorisiert = result.klassen.find((k) => k.id === 'unkategorisiert');
      expect(unkategorisiert?.amount).toBe(50);
    });

    it('schließt negative Einkommens-Buchungen aus der Ausgaben-Aggregation aus', () => {
      const incomeCats: Category[] = [
        { id: 'gehalt', name: 'Gehalt', filters: [], attributes: { ausgabenklasse: 'einkommen' } },
        ...klassCats,
      ];
      const result = buildSankeyDataByKlasse(
        [
          tx({ amount: -300, category_id: 'miete' }),
          tx({ amount: -50, category_id: 'gehalt' }),
        ],
        incomeCats
      );
      expect(result.klassen.some((k) => k.id === 'einkommen')).toBe(false);
      expect(result.mainCategories.some((m) => m.id === 'gehalt')).toBe(false);
    });
  });

  describe('getCategoryContributions & Aufteilungen', () => {
    const allocCats: Category[] = [
      { id: 'main-wohnen', name: 'Wohnen', filters: [] },
      { id: 'main-mobil', name: 'Mobilität', filters: [] },
    ];

    it('fällt ohne Aufteilungen auf die Kategorie der Transaktion zurück', () => {
      const t = tx({ id: 't1', amount: -10, category_id: 'main-wohnen' });
      expect(getCategoryContributions(t)).toEqual([{ assignedId: 'main-wohnen', amount: -10 }]);
    });

    it('expandiert in Aufteilungs-Beiträge, deren Summe dem Betrag entspricht', () => {
      const t = tx({ id: 't1', amount: -12.5, category_id: 'main-wohnen' });
      const map = new Map([[
        't1',
        [
          { id: 'a', transaction_id: 't1', amount_minor: -1000, category_id: 'main-wohnen', source: 'manual' as const },
          { id: 'b', transaction_id: 't1', amount_minor: -250, category_id: 'main-mobil', source: 'manual' as const },
        ],
      ]]);
      const contribs = getCategoryContributions(t, map);
      expect(contribs).toEqual([
        { assignedId: 'main-wohnen', amount: -10 },
        { assignedId: 'main-mobil', amount: -2.5 },
      ]);
      expect(contribs.reduce((s, c) => s + c.amount, 0)).toBeCloseTo(t.amount, 2);
    });

    it('verteilt eine aufgeteilte Buchung auf beide Kategorien, Kontosumme bleibt unverändert', () => {
      const t = tx({ id: 't1', amount: -12.5, category_id: 'main-wohnen', account_id: 'acc-default' });
      const map = new Map([[
        't1',
        [
          { id: 'a', transaction_id: 't1', amount_minor: -1000, category_id: 'main-wohnen', source: 'manual' as const },
          { id: 'b', transaction_id: 't1', amount_minor: -250, category_id: 'main-mobil', source: 'manual' as const },
        ],
      ]]);
      const result = buildSankeyData([t], allocCats, [acc({ id: 'acc-default' })], map);

      const wohnen = result.mainCategories.find((m) => m.id === 'main-wohnen');
      const mobil = result.mainCategories.find((m) => m.id === 'main-mobil');
      expect(wohnen?.amount).toBeCloseTo(10, 2);
      expect(mobil?.amount).toBeCloseTo(2.5, 2);
      // Kontosumme nutzt ausschließlich die Originalbuchung.
      expect(result.accounts[0].expenses).toBeCloseTo(12.5, 2);
    });

    it('Sunburst-Gesamtsumme bleibt gleich, ist aber auf Kategorien aufgeteilt', () => {
      const t = tx({ id: 't1', amount: -12.5, category_id: 'main-wohnen' });
      const map = new Map([[
        't1',
        [
          { id: 'a', transaction_id: 't1', amount_minor: -1000, category_id: 'main-wohnen', source: 'manual' as const },
          { id: 'b', transaction_id: 't1', amount_minor: -250, category_id: 'main-mobil', source: 'manual' as const },
        ],
      ]]);
      const withAlloc = buildSpendingSunburst([t], allocCats, map);
      const without = buildSpendingSunburst([t], allocCats);
      expect(withAlloc.total).toBeCloseTo(without.total, 2);
      expect(withAlloc.total).toBeCloseTo(12.5, 2);
    });
  });
});
