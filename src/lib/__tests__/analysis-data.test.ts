import { describe, it, expect } from 'vitest';
import { buildSpendingSunburst, buildSunburstBreakdown, buildSunburstTree, resolveAusgabenklasse, sumIncome, sumExpenses } from '../analysis-data';
import type { SunburstNode } from '../analysis-data';
import type { Transaction, Category } from '@/types';

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
