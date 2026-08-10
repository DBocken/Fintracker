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

/**
 * Grenzfälle beider Sankey-Aufbereitungen: Nullbeträge, Einkommens-Korrekturen
 * und Überträge dürfen die Ausgaben-Seite nicht verfälschen.
 */
describe('Sankey — Nullbeträge, Einkommens-Korrekturen und Überträge', () => {
  beforeEach(() => {
    window.localStorage.setItem('ausgabentracker_locale_v1', 'de');
  });

  afterEach(() => {
    window.localStorage.removeItem('ausgabentracker_locale_v1');
  });

  function stx(partial: Omit<Partial<Transaction>, 'id'> & { id?: string }): Transaction {
    return {
      date: '2026-02-10',
      amount: -10,
      payee: 'Test',
      description: '',
      original_text: '',
      auto_mapped: false,
      confirmed: true,
      account_id: 'giro',
      ...partial,
      id: partial.id !== undefined ? asTransactionId(partial.id) : undefined,
    };
  }

  const cats: Category[] = [
    { id: 'gehalt', name: 'Gehalt', filters: [], attributes: { ausgabenklasse: 'einkommen' } },
    { id: 'wohnen', name: 'Wohnen', filters: [], attributes: { ausgabenklasse: 'essenziell' } },
    { id: 'miete', name: 'Miete', filters: [], parent_id: 'wohnen' },
    { id: 'ohneklasse', name: 'Sonstiges', filters: [] },
  ];

  it('ignoriert Nullbuchungen und interne Überträge in beiden Aufbereitungen', () => {
    const txs = [
      stx({ id: 'n1', amount: 0, category_id: 'wohnen' }),
      stx({ id: 'u1', amount: -500, category_id: 'wohnen', is_transfer: true }),
      stx({ id: 'e1', amount: -100, category_id: 'miete' }),
    ];
    const flach = buildSankeyData(txs, cats);
    const klassen = buildSankeyDataByKlasse(txs, cats);
    expect(flach.mainCategories.find((m) => m.id === 'wohnen')?.amount).toBeCloseTo(100, 2);
    expect(flach.accounts[0].expenses).toBeCloseTo(100, 2);
    expect(klassen.klassen.find((k) => k.id === 'essenziell')?.amount).toBeCloseTo(100, 2);
    expect(klassen.accounts[0].expenses).toBeCloseTo(100, 2);
  });

  it('[REGRESSION] hält eine Gehaltsrückzahlung aus den Ausgaben heraus', () => {
    // Eine negative Buchung in einer EINKOMMENS-Kategorie ist eine Korrektur
    // des Zuflusses, keine Ausgabe. Landet sie im Ausgabenfluss, erscheint eine
    // Lohnrückforderung als Ausgabenkategorie „Gehalt" — und die
    // Ausgabensumme steigt um einen Betrag, der nie ausgegeben wurde.
    const txs = [
      stx({ id: 'g1', amount: 2000, category_id: 'gehalt' }),
      stx({ id: 'g2', amount: -300, category_id: 'gehalt' }),
      stx({ id: 'm1', amount: -800, category_id: 'miete' }),
    ];
    const flach = buildSankeyData(txs, cats);
    expect(flach.totalIncome).toBeCloseTo(2000, 2);
    expect(flach.mainCategories.some((m) => m.id === 'gehalt')).toBe(false);
    expect(flach.accounts[0].expenses).toBeCloseTo(800, 2);

    const klassen = buildSankeyDataByKlasse(txs, cats);
    expect(klassen.totalIncome).toBeCloseTo(2000, 2);
    expect(klassen.klassen.some((k) => k.id === 'einkommen')).toBe(false);
    expect(klassen.accounts[0].expenses).toBeCloseTo(800, 2);
  });

  it('hält einen Einkommens-ANTEIL einer Aufteilung aus den Kategorie-Knoten heraus', () => {
    // Die Kontosumme folgt der Originalbuchung (–500), die Kategorie-Knoten
    // folgen den Anteilen: der als Gehaltskorrektur gebuchte Anteil zählt dort
    // nicht mit, sonst summieren Kategorien mehr als tatsächlich ausgegeben.
    const t = stx({ id: 's1', amount: -500, category_id: 'ohneklasse' });
    const map = new Map([[
      's1',
      [
        { id: 'a', transaction_id: 's1', amount_minor: -30000, category_id: 'miete', source: 'manual' as const },
        { id: 'b', transaction_id: 's1', amount_minor: -20000, category_id: 'gehalt', source: 'manual' as const },
      ],
    ]]);
    const flach = buildSankeyData([t], cats, [], map);
    expect(flach.mainCategories.find((m) => m.id === 'wohnen')?.amount).toBeCloseTo(300, 2);
    expect(flach.mainCategories.some((m) => m.id === 'gehalt')).toBe(false);

    const klassen = buildSankeyDataByKlasse([t], cats, [], map);
    expect(klassen.klassen.find((k) => k.id === 'essenziell')?.amount).toBeCloseTo(300, 2);
    expect(klassen.klassen.some((k) => k.id === 'einkommen')).toBe(false);
  });

  it('führt Ausgaben ohne Ausgabenklasse in der Klasse „unkategorisiert"', () => {
    const klassen = buildSankeyDataByKlasse([stx({ id: 'x1', amount: -40, category_id: 'ohneklasse' })], cats);
    expect(klassen.klassen.find((k) => k.id === 'unkategorisiert')?.amount).toBeCloseTo(40, 2);
  });
});
