import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  buildSankeyData,
  buildSankeyDataByKlasse,
  buildSpendingSunburst,
  buildSunburstBreakdown,
  buildSunburstTree,
  buildWeekdayPattern,
  getCategoryContributions,
  resolveAusgabenklasse,
  sumIncome,
  sumExpenses,
  buildIncomeBreakdown,
  buildIncomeOverTime,
} from '../analysis-data';
import type { SunburstNode } from '../analysis-data';
import type { Account, Transaction, Category, TransactionAllocation } from '@/types';

/**
 * Integration tests for the analysis-data sunburst visualization
 */

describe('Analysis Data - Sunburst Visualization Integration', () => {
  // Full category hierarchy with all ausgabenklasse values
  const fullCategoryHierarchy: Category[] = [
    // Essenziell categories
    {
      id: 'wohnen',
      name: 'Wohnen',
      filters: [],
      attributes: { ausgabenklasse: 'essenziell' },
    },
    {
      id: 'strom',
      name: 'Strom',
      parent_id: 'wohnen',
      filters: [],
      attributes: { ausgabenklasse: 'essenziell', ist_vertrag: true },
    },
    {
      id: 'wasser',
      name: 'Wasser',
      parent_id: 'wohnen',
      filters: [],
      attributes: { ausgabenklasse: 'essenziell' },
    },
    {
      id: 'lebensmittel',
      name: 'Lebensmittel',
      filters: [],
      attributes: { ausgabenklasse: 'essenziell' },
    },
    // Diskretionaer categories
    {
      id: 'unterhaltung',
      name: 'Unterhaltung',
      filters: [],
      attributes: { ausgabenklasse: 'diskretionaer' },
    },
    {
      id: 'streaming',
      name: 'Streaming',
      parent_id: 'unterhaltung',
      filters: [],
      attributes: { ausgabenklasse: 'diskretionaer' },
    },
    {
      id: 'restaurants',
      name: 'Restaurants',
      parent_id: 'unterhaltung',
      filters: [],
      attributes: { ausgabenklasse: 'diskretionaer' },
    },
    // Sparen categories
    {
      id: 'sparen',
      name: 'Sparen & Investments',
      filters: [],
      attributes: { ausgabenklasse: 'sparen' },
    },
    {
      id: 'tagesgeld',
      name: 'Tagesgeld',
      parent_id: 'sparen',
      filters: [],
      attributes: { ausgabenklasse: 'sparen' },
    },
    {
      id: 'etf',
      name: 'ETF Sparpläne',
      parent_id: 'sparen',
      filters: [],
      attributes: { ausgabenklasse: 'sparen' },
    },
    // Einkommen categories (should not appear in spending sunburst)
    {
      id: 'einkommen',
      name: 'Einkommen',
      filters: [],
      attributes: { ausgabenklasse: 'einkommen' },
    },
    {
      id: 'gehalt',
      name: 'Gehalt',
      parent_id: 'einkommen',
      filters: [],
      attributes: { ausgabenklasse: 'einkommen' },
    },
  ];

  describe('Sunburst with all category types', () => {
    it('builds sunburst with all 4 super categories from spending transactions', () => {
      const transactions: Transaction[] = [
        // Essenziell - Wohnen
        { id: '1', date: '2024-06-01', amount: -100, payee: 'Landlord', description: 'Rent', original_text: 'Rent', category_id: 'wohnen', auto_mapped: true, confirmed: true, currency: 'EUR' },
        // Essenziell - Strom (contract)
        { id: '2', date: '2024-06-01', amount: -80, payee: 'LSW', description: 'Electricity', original_text: 'LSW', category_id: 'strom', auto_mapped: true, confirmed: true, currency: 'EUR', is_contract: true, contract_cycle: 'monthly' },
        // Essenziell - Wasser
        { id: '3', date: '2024-06-01', amount: -30, payee: 'Water Co', description: 'Water', original_text: 'Water', category_id: 'wasser', auto_mapped: true, confirmed: true, currency: 'EUR' },
        // Essenziell - Lebensmittel
        { id: '4', date: '2024-06-02', amount: -50, payee: 'REWE', description: 'Groceries', original_text: 'REWE', category_id: 'lebensmittel', auto_mapped: true, confirmed: true, currency: 'EUR' },
        // Diskretionaer - Streaming
        { id: '5', date: '2024-06-02', amount: -15, payee: 'Netflix', description: 'Subscription', original_text: 'Netflix', category_id: 'streaming', auto_mapped: true, confirmed: true, currency: 'EUR' },
        // Diskretionaer - Restaurants
        { id: '6', date: '2024-06-03', amount: -45, payee: 'Pizza Palace', description: 'Dinner', original_text: 'Pizza', category_id: 'restaurants', auto_mapped: true, confirmed: true, currency: 'EUR' },
        // Sparen - Tagesgeld
        { id: '7', date: '2024-06-03', amount: -200, payee: 'Trade Republic', description: 'Savings', original_text: 'TR', category_id: 'tagesgeld', auto_mapped: true, confirmed: true, currency: 'EUR' },
        // Sparen - ETF
        { id: '8', date: '2024-06-04', amount: -500, payee: 'Trade Republic', description: 'ETF Plan', original_text: 'TR', category_id: 'etf', auto_mapped: true, confirmed: true, currency: 'EUR' },
        // Uncategorized
        { id: '9', date: '2024-06-04', amount: -25, payee: 'Unknown', description: 'Cash withdrawal', original_text: 'ATM', auto_mapped: false, confirmed: false, currency: 'EUR' },
        // Income (should not appear in spending sunburst)
        { id: '10', date: '2024-06-05', amount: 3000, payee: 'Employer', description: 'Monthly salary', original_text: 'Salary', category_id: 'gehalt', auto_mapped: true, confirmed: true, currency: 'EUR' },
      ];

      const sunburst = buildSpendingSunburst(transactions, fullCategoryHierarchy);

      // Verify all spending categories are present
      const innerIds = sunburst.inner.map(s => s.id).sort();
      expect(innerIds).toContain('essenziell');
      expect(innerIds).toContain('diskretionaer');
      expect(innerIds).toContain('sparen');
      expect(innerIds).toContain('unkategorisiert');
      // Income should NOT appear in spending sunburst
      expect(innerIds).not.toContain('einkommen');

      // Verify correct aggregation
      const essenziell = sunburst.inner.find(s => s.id === 'essenziell');
      expect(essenziell?.value).toBe(260); // 100 + 80 + 30 + 50

      const diskretionaer = sunburst.inner.find(s => s.id === 'diskretionaer');
      expect(diskretionaer?.value).toBe(60); // 15 + 45

      const sparen = sunburst.inner.find(s => s.id === 'sparen');
      expect(sparen?.value).toBe(700); // 200 + 500

      const unkategorisiert = sunburst.inner.find(s => s.id === 'unkategorisiert');
      expect(unkategorisiert?.value).toBe(25);

      // Total should exclude income
      expect(sunburst.total).toBe(1045); // 260 + 60 + 700 + 25
    });

    it('properly categorizes subcategories under correct parent ausgabenklasse', () => {
      const transactions: Transaction[] = [
        { id: '1', date: '2024-06-01', amount: -100, payee: 'LSW', description: 'Electricity', original_text: 'LSW', category_id: 'strom', auto_mapped: true, confirmed: true, currency: 'EUR' },
        { id: '2', date: '2024-06-01', amount: -30, payee: 'Water Co', description: 'Water', original_text: 'Water', category_id: 'wasser', auto_mapped: true, confirmed: true, currency: 'EUR' },
        { id: '3', date: '2024-06-02', amount: -15, payee: 'Netflix', description: 'Subscription', original_text: 'Netflix', category_id: 'streaming', auto_mapped: true, confirmed: true, currency: 'EUR' },
      ];

      const sunburst = buildSpendingSunburst(transactions, fullCategoryHierarchy);

      // Check outer ring groupings
      const stromelKey = sunburst.outer.find(o => o.name === 'Wohnen' && o.parentId === 'essenziell');
      expect(stromelKey?.value).toBe(130); // Strom + Wasser

      const streamingKey = sunburst.outer.find(o => o.name === 'Unterhaltung' && o.parentId === 'diskretionaer');
      expect(streamingKey?.value).toBe(15);
    });

    it('handles subcategories with explicit ausgabenklasse that differs from parent', () => {
      // Scenario: A subcategory explicitly sets its own ausgabenklasse
      // The resolveAusgabenklasse should use the subcategory's value, not parent's
      const customCategories: Category[] = [
        { id: 'custom-parent', name: 'Parent', filters: [], attributes: { ausgabenklasse: 'essenziell' } },
        { id: 'custom-sub', name: 'Sub', parent_id: 'custom-parent', filters: [], attributes: { ausgabenklasse: 'sparen' } },
      ];

      const byId = new Map(customCategories.map(c => [c.id, c]));

      // Subcategory should use its own ausgabenklasse
      const subKlasse = resolveAusgabenklasse(byId, 'custom-sub');
      expect(subKlasse).toBe('sparen');

      // Parent should use its ausgabenklasse
      const parentKlasse = resolveAusgabenklasse(byId, 'custom-parent');
      expect(parentKlasse).toBe('essenziell');
    });

    it('inherits ausgabenklasse from parent when subcategory does not have one', () => {
      const customCategories: Category[] = [
        { id: 'parent', name: 'Parent', filters: [], attributes: { ausgabenklasse: 'diskretionaer' } },
        { id: 'sub', name: 'Sub', parent_id: 'parent', filters: [], attributes: {} }, // No ausgabenklasse
      ];

      const byId = new Map(customCategories.map(c => [c.id, c]));

      // Subcategory without ausgabenklasse should inherit from parent
      const subKlasse = resolveAusgabenklasse(byId, 'sub');
      expect(subKlasse).toBe('diskretionaer');
    });

    it('returns null for uncategorized transactions', () => {
      const byId = new Map(fullCategoryHierarchy.map(c => [c.id, c]));

      // No category should return null
      const klasse = resolveAusgabenklasse(byId, null);
      expect(klasse).toBe(null);

      // Unknown category should return null
      const unknownKlasse = resolveAusgabenklasse(byId, 'unknown-id');
      expect(unknownKlasse).toBe(null);
    });
  });

  describe('Edge cases and robustness', () => {
    it('handles mixed transactions with some having no category', () => {
      const transactions: Transaction[] = [
        { id: '1', date: '2024-06-01', amount: -100, payee: 'LSW', description: 'Electricity', original_text: 'LSW', category_id: 'strom', auto_mapped: true, confirmed: true, currency: 'EUR' },
        { id: '2', date: '2024-06-02', amount: -50, payee: 'Unknown', description: 'Cash', original_text: 'ATM', auto_mapped: false, confirmed: false, currency: 'EUR' },
        { id: '3', date: '2024-06-03', amount: -30, payee: 'Another', description: 'Unknown', original_text: 'Unknown', auto_mapped: false, confirmed: false, currency: 'EUR' },
      ];

      const sunburst = buildSpendingSunburst(transactions, fullCategoryHierarchy);

      const unkategorisiert = sunburst.inner.find(s => s.id === 'unkategorisiert');
      expect(unkategorisiert?.value).toBe(80); // 50 + 30
    });

    it('handles empty transaction list', () => {
      const sunburst = buildSpendingSunburst([], fullCategoryHierarchy);

      expect(sunburst.inner.length).toBe(0);
      expect(sunburst.outer.length).toBe(0);
      expect(sunburst.total).toBe(0);
    });

    it('ignores transfer transactions (is_transfer flag)', () => {
      const transactions: Transaction[] = [
        { id: '1', date: '2024-06-01', amount: -100, payee: 'LSW', description: 'Electricity', original_text: 'LSW', category_id: 'strom', auto_mapped: true, confirmed: true, currency: 'EUR' },
        { id: '2', date: '2024-06-01', amount: -500, payee: 'Savings Account', description: 'Transfer', original_text: 'Transfer', is_transfer: true, auto_mapped: true, confirmed: true, currency: 'EUR' },
      ];

      const sunburst = buildSpendingSunburst(transactions, fullCategoryHierarchy);

      // Only the electricity transaction should be included
      expect(sunburst.total).toBe(100);
    });
  });

  // Mobile-Aufschlüsselung: macht die tieferen Sunburst-Ebenen (Hauptkategorien
  // je Klasse) als geordnete, antippbare Hierarchie sichtbar — auf Touch, wo der
  // Donut-Hover nicht greift.
  describe('buildSunburstBreakdown (mobile hierarchy)', () => {
    const transactions: Transaction[] = [
      { id: '1', date: '2024-06-01', amount: -100, payee: 'Landlord', description: 'Rent', original_text: 'Rent', category_id: 'wohnen', auto_mapped: true, confirmed: true, currency: 'EUR' },
      { id: '2', date: '2024-06-01', amount: -80, payee: 'LSW', description: 'Electricity', original_text: 'LSW', category_id: 'strom', auto_mapped: true, confirmed: true, currency: 'EUR' },
      { id: '3', date: '2024-06-02', amount: -50, payee: 'REWE', description: 'Groceries', original_text: 'REWE', category_id: 'lebensmittel', auto_mapped: true, confirmed: true, currency: 'EUR' },
      { id: '4', date: '2024-06-02', amount: -15, payee: 'Netflix', description: 'Subscription', original_text: 'Netflix', category_id: 'streaming', auto_mapped: true, confirmed: true, currency: 'EUR' },
      { id: '5', date: '2024-06-04', amount: -25, payee: 'Unknown', description: 'Cash', original_text: 'ATM', auto_mapped: false, confirmed: false, currency: 'EUR' },
    ];

    describe('Normal Behavior', () => {
      it('sollte jede Klasse als Gruppe mit ihren Hauptkategorien als Kinder abbilden', () => {
        const sunburst = buildSpendingSunburst(transactions, fullCategoryHierarchy);
        const groups = buildSunburstBreakdown(sunburst);

        const essenziell = groups.find((g) => g.id === 'essenziell');
        // Wohnen (Miete + Strom = 180) und Lebensmittel (50)
        expect(essenziell?.children.map((c) => c.name)).toEqual(['Wohnen', 'Lebensmittel']);
        expect(essenziell?.value).toBe(230);
      });

      it('sollte Kinder absteigend nach Wert sortieren', () => {
        const sunburst = buildSpendingSunburst(transactions, fullCategoryHierarchy);
        const groups = buildSunburstBreakdown(sunburst);
        const essenziell = groups.find((g) => g.id === 'essenziell');
        const values = essenziell?.children.map((c) => c.value) ?? [];
        expect(values).toEqual([...values].sort((a, b) => b - a));
      });

      it('sollte Anteile relativ berechnen (Gruppe zu Gesamt, Kind zur Klasse)', () => {
        const sunburst = buildSpendingSunburst(transactions, fullCategoryHierarchy);
        const groups = buildSunburstBreakdown(sunburst);
        const essenziell = groups.find((g) => g.id === 'essenziell')!;
        // 230 von 270 Gesamtausgaben
        expect(essenziell.share).toBeCloseTo(230 / 270, 5);
        // Wohnen (180) von 230 Klassenwert
        const wohnen = essenziell.children.find((c) => c.name === 'Wohnen')!;
        expect(wohnen.share).toBeCloseTo(180 / 230, 5);
      });

      it('sollte die Außenring-ID `${superId}::${mainId}` als Kind-ID durchreichen (für Navigation)', () => {
        const sunburst = buildSpendingSunburst(transactions, fullCategoryHierarchy);
        const groups = buildSunburstBreakdown(sunburst);
        const wohnen = groups.flatMap((g) => g.children).find((c) => c.name === 'Wohnen')!;
        expect(wohnen.id).toBe('essenziell::wohnen');
      });
    });

    describe('Edge Cases', () => {
      it('sollte eine leere Liste für ein leeres Sunburst liefern', () => {
        const groups = buildSunburstBreakdown(buildSpendingSunburst([], fullCategoryHierarchy));
        expect(groups).toEqual([]);
      });

      it('sollte unkategorisierte Klasse ohne Kinder als Blatt-Gruppe behalten', () => {
        const sunburst = buildSpendingSunburst(transactions, fullCategoryHierarchy);
        const groups = buildSunburstBreakdown(sunburst);
        const unkat = groups.find((g) => g.id === 'unkategorisiert');
        expect(unkat).toBeDefined();
        expect(unkat?.children).toEqual([]);
        expect(unkat?.value).toBe(25);
      });

      it('sollte Gruppen in Innenring-Reihenfolge (Wert absteigend) ausgeben', () => {
        const sunburst = buildSpendingSunburst(transactions, fullCategoryHierarchy);
        const groups = buildSunburstBreakdown(sunburst);
        const values = groups.map((g) => g.value);
        expect(values).toEqual([...values].sort((a, b) => b - a));
      });
    });
  });

  // Mehrstufiger Sunburst-Baum für das grafische, zoombare Diagramm.
  describe('buildSunburstTree (mehrstufige Hierarchie)', () => {
    const find = (nodes: SunburstNode[], id: string): SunburstNode | undefined => {
      for (const n of nodes) {
        if (n.id === id) return n;
        const hit = find(n.children, id);
        if (hit) return hit;
      }
      return undefined;
    };

    const transactions: Transaction[] = [
      // Essenziell > Wohnen > Strom (Unterkategorie)
      { id: '1', date: '2024-06-01', amount: -80, payee: 'LSW', description: 'Strom', original_text: 'LSW', category_id: 'strom', auto_mapped: true, confirmed: true, currency: 'EUR' },
      // Essenziell > Wohnen > Wasser (Unterkategorie)
      { id: '2', date: '2024-06-01', amount: -30, payee: 'Water', description: 'Wasser', original_text: 'Water', category_id: 'wasser', auto_mapped: true, confirmed: true, currency: 'EUR' },
      // Essenziell > Wohnen direkt (ohne Unterkategorie)
      { id: '3', date: '2024-06-01', amount: -100, payee: 'Landlord', description: 'Miete', original_text: 'Rent', category_id: 'wohnen', auto_mapped: true, confirmed: true, currency: 'EUR' },
      // Essenziell > Lebensmittel (Hauptkategorie ohne Unterkategorien)
      { id: '4', date: '2024-06-02', amount: -50, payee: 'REWE', description: 'Einkauf', original_text: 'REWE', category_id: 'lebensmittel', auto_mapped: true, confirmed: true, currency: 'EUR' },
      // Diskretionaer > Unterhaltung > Streaming
      { id: '5', date: '2024-06-02', amount: -15, payee: 'Netflix', description: 'Abo', original_text: 'Netflix', category_id: 'streaming', auto_mapped: true, confirmed: true, currency: 'EUR' },
      // Unkategorisiert
      { id: '6', date: '2024-06-04', amount: -25, payee: 'Unknown', description: 'Bar', original_text: 'ATM', auto_mapped: false, confirmed: false, currency: 'EUR' },
      // Einkommen — darf nicht auftauchen
      { id: '7', date: '2024-06-05', amount: 3000, payee: 'Employer', description: 'Gehalt', original_text: 'Salary', category_id: 'gehalt', auto_mapped: true, confirmed: true, currency: 'EUR' },
    ];

    describe('Normal Behavior', () => {
      it('sollte drei Ebenen aufbauen: Klasse -> Hauptkategorie -> Unterkategorie', () => {
        const tree = buildSunburstTree(transactions, fullCategoryHierarchy);
        const wohnen = find(tree.children, 'essenziell::wohnen');
        expect(wohnen?.name).toBe('Wohnen');
        const strom = find(tree.children, 'essenziell::wohnen::strom');
        expect(strom?.name).toBe('Strom');
        expect(strom?.value).toBe(80);
      });

      it('sollte Eltern-Werte als exakte Summe der Kinder halten (lückenlose Ringe)', () => {
        const tree = buildSunburstTree(transactions, fullCategoryHierarchy);
        const sumChildren = (n: SunburstNode): void => {
          if (n.children.length > 0) {
            const sum = n.children.reduce((s, c) => s + c.value, 0);
            expect(sum).toBeCloseTo(n.value, 5);
            n.children.forEach(sumChildren);
          }
        };
        tree.children.forEach(sumChildren);
      });

      it('sollte für direkt gebuchten Rest einer Hauptkategorie ein synthetisches Kind anlegen', () => {
        const tree = buildSunburstTree(transactions, fullCategoryHierarchy);
        const wohnen = find(tree.children, 'essenziell::wohnen')!;
        const direct = find([wohnen], 'essenziell::wohnen::__direct');
        expect(direct?.value).toBe(100); // Miete ohne Unterkategorie
        expect(direct?.categoryId).toBe('wohnen'); // navigiert zur Hauptkategorie
        expect(wohnen.value).toBe(210); // 80 + 30 + 100
      });

      it('sollte Hauptkategorien ohne Unterkategorien als Blatt belassen', () => {
        const tree = buildSunburstTree(transactions, fullCategoryHierarchy);
        const lebensmittel = find(tree.children, 'essenziell::lebensmittel')!;
        expect(lebensmittel.children).toEqual([]);
        expect(lebensmittel.categoryId).toBe('lebensmittel');
      });

      it('sollte die Wurzel-Klasse für die Einfärbung an alle Nachkommen durchreichen', () => {
        const tree = buildSunburstTree(transactions, fullCategoryHierarchy);
        const strom = find(tree.children, 'essenziell::wohnen::strom')!;
        expect(strom.klasseId).toBe('essenziell');
      });
    });

    describe('Edge Cases', () => {
      it('sollte Einkommen und Transfers aus dem Gesamtwert ausnehmen', () => {
        const tree = buildSunburstTree(transactions, fullCategoryHierarchy);
        // 80 + 30 + 100 + 50 + 15 + 25
        expect(tree.total).toBe(300);
        expect(find(tree.children, 'einkommen')).toBeUndefined();
      });

      it('sollte unkategorisierte Ausgaben als Blatt auf Klassen-Ebene halten', () => {
        const tree = buildSunburstTree(transactions, fullCategoryHierarchy);
        const unkat = find(tree.children, 'unkategorisiert')!;
        expect(unkat.value).toBe(25);
        expect(unkat.children).toEqual([]);
        expect(unkat.categoryId).toBeNull();
      });

      it('sollte einen leeren Baum für leere Eingaben liefern', () => {
        const tree = buildSunburstTree([], fullCategoryHierarchy);
        expect(tree.total).toBe(0);
        expect(tree.children).toEqual([]);
      });

      it('sollte Geschwister je Ebene absteigend nach Wert sortieren', () => {
        const tree = buildSunburstTree(transactions, fullCategoryHierarchy);
        const klasseValues = tree.children.map((c) => c.value);
        expect(klasseValues).toEqual([...klasseValues].sort((a, b) => b - a));
      });
    });
  });

  describe('sumIncome / sumExpenses (transferbereinigt)', () => {
    const tx = (over: Partial<Transaction>): Transaction =>
      ({ id: 'x', account_id: 'a', date: '2026-01-01', amount: 0, payee: '', description: '', ...over }) as Transaction;

    it('summiert Einnahmen und Ausgaben ohne interne Überträge (Invariante 2)', () => {
      const txs = [
        tx({ id: '1', amount: 2000 }),
        tx({ id: '2', amount: -500 }),
        tx({ id: '3', amount: 1000, is_transfer: true }),
        tx({ id: '4', amount: -1000, is_transfer: true }),
      ];
      expect(sumIncome(txs)).toBe(2000);
      expect(sumExpenses(txs)).toBe(500);
    });

    it('[REGRESSION] ein Transfer-Paar verändert die Summen nicht', () => {
      const base = [tx({ id: '1', amount: 2000 }), tx({ id: '2', amount: -500 })];
      const withTransfer = [...base, tx({ id: '3', amount: 800, is_transfer: true }), tx({ id: '4', amount: -800, is_transfer: true })];
      expect(sumIncome(withTransfer)).toBe(sumIncome(base));
      expect(sumExpenses(withTransfer)).toBe(sumExpenses(base));
    });

    it('liefert 0 für leere Eingaben', () => {
      expect(sumIncome([])).toBe(0);
      expect(sumExpenses([])).toBe(0);
    });
  });
});

describe('Income Breakdown & Over Time', () => {
  const incomeCategories: Category[] = [
    { id: 'anstellung', name: 'Anstellung', filters: [], parent_id: null, attributes: { ausgabenklasse: 'einkommen' } },
    { id: 'gehalt', name: 'Gehalt', filters: [], parent_id: 'anstellung', attributes: { ausgabenklasse: 'einkommen' } },
    { id: 'verkaeufe', name: 'Verkäufe', filters: [], parent_id: null, attributes: { ausgabenklasse: 'einkommen' } },
    { id: 'onlineverkauf', name: 'Online-Verkäufe', filters: [], parent_id: 'verkaeufe', attributes: { ausgabenklasse: 'einkommen' } },
    { id: 'versicherungen', name: 'Versicherungen', filters: [], parent_id: null, attributes: { ausgabenklasse: 'essenziell' } },
  ];

  function itx(overrides: Partial<Transaction>): Transaction {
    return {
      id: overrides.id ?? crypto.randomUUID(),
      date: '2024-03-15',
      amount: 0,
      payee: '',
      description: '',
      original_text: '',
      auto_mapped: false,
      confirmed: false,
      ...overrides,
    };
  }

  describe('buildIncomeBreakdown', () => {
    it('gruppiert Einnahmen nach Haupt- und Unterkategorie, total === Summe', () => {
      const txs: Transaction[] = [
        itx({ id: '1', amount: 2000, category_id: 'anstellung', subcategory_id: 'gehalt' }),
        itx({ id: '2', amount: 300, category_id: 'verkaeufe', subcategory_id: 'onlineverkauf' }),
      ];
      const result = buildIncomeBreakdown(txs, incomeCategories);
      expect(result.total).toBe(2300);
      expect(result.groups).toHaveLength(2);
      const anstellung = result.groups.find((g) => g.id === 'anstellung');
      expect(anstellung?.value).toBe(2000);
      expect(anstellung?.children[0]).toMatchObject({ id: 'gehalt', value: 2000, share: 1 });
    });

    it('schließt Transfers und Ausgaben aus', () => {
      const txs: Transaction[] = [
        itx({ id: '1', amount: 2000, category_id: 'anstellung', subcategory_id: 'gehalt' }),
        itx({ id: '2', amount: 1000, is_transfer: true }),
        itx({ id: '3', amount: -50, category_id: 'versicherungen' }),
      ];
      const result = buildIncomeBreakdown(txs, incomeCategories);
      expect(result.total).toBe(2000);
    });

    it('positive Buchung in einer Nicht-Einkommens-Kategorie landet unter "Sonstige Zuflüsse"', () => {
      const txs: Transaction[] = [
        itx({ id: '1', amount: 15, category_id: 'versicherungen', description: 'Beitragsrückerstattung' }),
      ];
      const result = buildIncomeBreakdown(txs, incomeCategories);
      expect(result.total).toBe(15);
      expect(result.groups[0].id).toBe('__nonincome');
    });

    it('teilt eine aufgeteilte Buchung (Splits) korrekt auf zwei Einkommens-Subs auf', () => {
      const allocationsByTx = new Map<string, TransactionAllocation[]>([
        ['1', [
          { id: 'a1', transaction_id: '1', category_id: 'anstellung', subcategory_id: 'gehalt', amount_minor: 150000, source: 'manual' },
          { id: 'a2', transaction_id: '1', category_id: 'verkaeufe', subcategory_id: 'onlineverkauf', amount_minor: 50000, source: 'manual' },
        ]],
      ]);
      const txs: Transaction[] = [itx({ id: '1', amount: 2000 })];
      const result = buildIncomeBreakdown(txs, incomeCategories, allocationsByTx);
      expect(result.total).toBe(2000);
      expect(result.groups.find((g) => g.id === 'anstellung')?.value).toBe(1500);
      expect(result.groups.find((g) => g.id === 'verkaeufe')?.value).toBe(500);
    });

    it('liefert leere Aufschlüsselung für leere Eingabe', () => {
      const result = buildIncomeBreakdown([], incomeCategories);
      expect(result).toEqual({ total: 0, groups: [] });
    });
  });

  describe('buildIncomeOverTime', () => {
    it('aggregiert Einnahmen je Monat und Hauptkategorie, aufsteigend sortiert', () => {
      const txs: Transaction[] = [
        itx({ id: '1', date: '2024-02-01', amount: 2000, category_id: 'anstellung', subcategory_id: 'gehalt' }),
        itx({ id: '2', date: '2024-01-01', amount: 300, category_id: 'verkaeufe', subcategory_id: 'onlineverkauf' }),
      ];
      const result = buildIncomeOverTime(txs, incomeCategories);
      expect(result.map((p) => p.month)).toEqual(['2024-01', '2024-02']);
      expect(result[1].byMain['anstellung']).toBe(2000);
    });

    it('liefert ein leeres Array für leere Eingabe', () => {
      expect(buildIncomeOverTime([], incomeCategories)).toEqual([]);
    });
  });
});

// Vormals src/lib/analysis-data.test.ts (Root-Duplikat neben dem Code statt in
// __tests__/) — hierher zusammengeführt, damit dieses Source-Modul nur noch an
// einer Stelle getestet wird. Eigener beforeEach/afterEach für die Locale, da
// die hier getesteten Labels ("Unkategorisiert", "Sonstiges Konto") übersetzt sind.
describe('buildSankeyData & buildWeekdayPattern (Sankey/Wochenmuster-Aufbereitung)', () => {
  beforeEach(() => {
    window.localStorage.setItem('ausgabentracker_locale_v1', 'de');
  });

  afterEach(() => {
    window.localStorage.removeItem('ausgabentracker_locale_v1');
  });

  function tx(partial: Partial<Transaction>): Transaction {
    return {
      date: '2026-01-05',
      amount: -10,
      payee: 'Test',
      description: '',
      original_text: '',
      auto_mapped: false,
      confirmed: true,
      ...partial,
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

  describe('buildWeekdayPattern (Issue #40)', () => {
    it('liefert immer 7 Wochentage in Mo–So-Reihenfolge', () => {
      const result = buildWeekdayPattern([]);
      expect(result.map((e) => e.day)).toEqual(['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']);
    });

    it('bucketiert Einnahmen und Ausgaben auf den richtigen Wochentag', () => {
      // 2026-01-05 ist ein Montag, 2026-01-10 ein Samstag.
      const result = buildWeekdayPattern([
        tx({ date: '2026-01-05', amount: 1000 }),
        tx({ date: '2026-01-05', amount: -200 }),
        tx({ date: '2026-01-10', amount: -50 }),
      ]);
      expect(result[0]).toEqual({ day: 'Mo', income: 1000, expenses: 200 });
      expect(result[5]).toEqual({ day: 'Sa', income: 0, expenses: 50 });
    });

    it('ignoriert Transaktionen mit unparsebarem Datum', () => {
      const result = buildWeekdayPattern([tx({ date: 'kein-datum', amount: -99 })]);
      expect(result.every((e) => e.income === 0 && e.expenses === 0)).toBe(true);
    });
  });

  describe('buildSpendingSunburst (Superkategorie -> Hauptkategorie, kompakte Fixtures)', () => {
    const klassCats: Category[] = [
      { id: 'wohnen', name: 'Wohnen', filters: [], attributes: { ausgabenklasse: 'essenziell' } },
      { id: 'miete', name: 'Miete', filters: [], parent_id: 'wohnen', attributes: { ausgabenklasse: 'essenziell' } },
      { id: 'mobil', name: 'Mobilität', filters: [], attributes: { ausgabenklasse: 'diskretionaer' } },
      { id: 'kraftstoff', name: 'Kraftstoff', filters: [], parent_id: 'mobil', attributes: { ausgabenklasse: 'essenziell' } },
      { id: 'parken', name: 'Parken', filters: [], parent_id: 'mobil', attributes: { ausgabenklasse: 'diskretionaer' } },
      { id: 'sparen', name: 'Sparen & Investieren', filters: [], attributes: { ausgabenklasse: 'sparen' } },
    ];

    it('gruppiert Ausgaben nach Ausgabenklasse im Innenring', () => {
      const result = buildSpendingSunburst(
        [
          tx({ amount: -700, category_id: 'miete' }),
          tx({ amount: -60, category_id: 'kraftstoff' }),
          tx({ amount: -40, category_id: 'parken' }),
          tx({ amount: -200, category_id: 'sparen' }),
        ],
        klassCats
      );
      expect(result.total).toBe(1000);
      const inner = Object.fromEntries(result.inner.map((i) => [i.id, i.value]));
      expect(inner.essenziell).toBe(760); // Miete 700 + Kraftstoff 60
      expect(inner.diskretionaer).toBe(40); // Parken
      expect(inner.sparen).toBe(200);
    });

    it('spaltet eine Hauptkategorie über Klassen im Außenring auf', () => {
      const result = buildSpendingSunburst(
        [
          tx({ amount: -60, category_id: 'kraftstoff' }),
          tx({ amount: -40, category_id: 'parken' }),
        ],
        klassCats
      );
      // Mobilität erscheint sowohl unter essenziell als auch unter diskretionaer
      const mobilOuter = result.outer.filter((o) => o.name === 'Mobilität');
      expect(mobilOuter).toHaveLength(2);
      expect(mobilOuter.find((o) => o.parentId === 'essenziell')?.value).toBe(60);
      expect(mobilOuter.find((o) => o.parentId === 'diskretionaer')?.value).toBe(40);
    });

    it('legt unkategorisierte Ausgaben in einen eigenen Innenring-Slice ohne Außenring', () => {
      const result = buildSpendingSunburst([tx({ amount: -25 })], klassCats);
      expect(result.inner).toEqual([{ id: 'unkategorisiert', name: 'Unkategorisiert', value: 25 }]);
      expect(result.outer).toEqual([]);
    });

    it('ignoriert Einnahmen und Nullbeträge', () => {
      const result = buildSpendingSunburst(
        [tx({ amount: 2000 }), tx({ amount: 0, category_id: 'miete' })],
        klassCats
      );
      expect(result.total).toBe(0);
      expect(result.inner).toEqual([]);
    });

    it("schließt negative Buchungen in Einkommens-Kategorien aus (keine 'Einkommen'-Ausgabe)", () => {
      const incomeCats: Category[] = [
        { id: 'einkommen', name: 'Einkommen', filters: [], attributes: { ausgabenklasse: 'einkommen' } },
        { id: 'gehalt', name: 'Gehalt', filters: [], parent_id: 'einkommen', attributes: { ausgabenklasse: 'einkommen' } },
        ...klassCats,
      ];
      const result = buildSpendingSunburst(
        [
          tx({ amount: -700, category_id: 'miete' }),
          tx({ amount: -50, category_id: 'gehalt' }), // Gehalts-Rückbuchung
        ],
        incomeCats
      );
      // Nur die Miete zählt als Ausgabe; die Einkommens-Rückbuchung ist ausgenommen.
      expect(result.total).toBe(700);
      expect(result.inner.map((i) => i.id)).toEqual(['essenziell']);
      expect(result.outer.some((o) => o.name === 'Einkommen')).toBe(false);
    });

    it('resolveAusgabenklasse erbt die Klasse vom Parent, wenn die Unterkategorie keine hat', () => {
      const cats: Category[] = [
        { id: 'p', name: 'P', filters: [], attributes: { ausgabenklasse: 'sparen' } },
        { id: 'c', name: 'C', filters: [], parent_id: 'p' },
      ];
      const byId = new Map(cats.map((c) => [c.id, c]));
      expect(resolveAusgabenklasse(byId, 'c')).toBe('sparen');
      expect(resolveAusgabenklasse(byId, null)).toBeNull();
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
