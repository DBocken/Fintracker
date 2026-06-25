import { describe, it, expect } from 'vitest';
import { classifyForecastTreatment } from '@/lib/forecast-treatment';
import { merchantFingerprint } from '@/lib/merchant-fingerprint';
import type { Ausgabenklasse, Category, Transaction } from '@/types';

/**
 * Tests für die fachliche Forecast-Behandlung (Domänenregel, nicht Code-nah).
 *
 * Kernsatz: Kategoriezuordnung ist Voraussetzung, aber nicht hinreichend. Die
 * variable Baseline darf NUR `variable_consumption` enthalten. Einkommen,
 * Fixkosten/Verträge, Sparen, Transfers und Unkategorisiertes werden – jeweils
 * über das verlässlichste Signal – ausgeschlossen.
 */

function cat(id: string, klasse: Ausgabenklasse | undefined, parent_id: string | null = null): Category {
  return {
    id,
    name: id,
    filters: [],
    parent_id,
    attributes: klasse ? { ausgabenklasse: klasse } : {},
  } as Category;
}

// Kategorie-Hierarchie:
//  einkommen (Hauptkat) → gehalt (Unterkat, erbt einkommen)
//  essenziell → lebensmittel; miete (essenziell, aber per Vertrag fix)
//  diskretionaer → restaurant
//  sparen → etf
const CATS = new Map<string, Category>([
  ['einkommen', cat('einkommen', 'einkommen')],
  ['gehalt', cat('gehalt', undefined, 'einkommen')], // erbt 'einkommen' vom Parent
  ['essenziell', cat('essenziell', 'essenziell')],
  ['lebensmittel', cat('lebensmittel', 'essenziell')],
  ['miete', cat('miete', 'essenziell')],
  ['restaurant', cat('restaurant', 'diskretionaer')],
  ['sparen', cat('sparen', 'sparen')],
  ['etf', cat('etf', undefined, 'sparen')], // erbt 'sparen'
  ['custom', cat('custom', undefined, null)], // nutzererstellt, ohne Klasse/Parent
]);

function tx(p: Partial<Transaction>): Transaction {
  return {
    date: '2026-06-10',
    amount: -50,
    payee: 'Test',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: true,
    ...p,
  } as Transaction;
}

const ctx = (extra?: { excludedFingerprints?: ReadonlySet<string> }) => ({
  categoriesById: CATS,
  excludedFingerprints: extra?.excludedFingerprints,
});

describe('classifyForecastTreatment', () => {
  describe('Nicht-Konsum wird ausgeschlossen', () => {
    it('interner Transfer -> transfer', () => {
      expect(classifyForecastTreatment(tx({ is_transfer: true, category_id: 'lebensmittel' }), ctx())).toBe(
        'transfer',
      );
    });

    it('als Vertrag markierte Transaktion -> fixed_recurring (auch bei diskretionärer Kategorie, z. B. Fitnessstudio)', () => {
      expect(classifyForecastTreatment(tx({ is_contract: true, category_id: 'restaurant' }), ctx())).toBe(
        'fixed_recurring',
      );
    });

    it('Transaktion eines beendeten/pausierten Vertrags (excludedFingerprint) -> fixed_recurring', () => {
      const t = tx({ payee: 'Altvertrag GmbH', category_id: 'restaurant' });
      const excluded = new Set([merchantFingerprint(t)]);
      expect(classifyForecastTreatment(t, ctx({ excludedFingerprints: excluded }))).toBe('fixed_recurring');
    });

    it('positive Einnahme -> income', () => {
      expect(classifyForecastTreatment(tx({ amount: 2500, category_id: 'lebensmittel' }), ctx())).toBe('income');
    });

    it('[REGRESSION] NEGATIVE Buchung in Einkommens-Kategorie -> income (nicht consumption)', () => {
      // Genau der reale Bug: -4.000 € fälschlich in Kategorie „Einkommen“.
      expect(classifyForecastTreatment(tx({ amount: -4000, category_id: 'einkommen' }), ctx())).toBe('income');
    });

    it('Ausgabe in Sparen-Kategorie -> saving_investment (eigener flexibler Puffer)', () => {
      expect(classifyForecastTreatment(tx({ amount: -300, category_id: 'etf' }), ctx())).toBe('saving_investment');
    });

    it('negative Ausgabe ohne (auflösbare) Kategorie -> uncategorized', () => {
      expect(classifyForecastTreatment(tx({ amount: -20, category_id: null }), ctx())).toBe('uncategorized');
      expect(classifyForecastTreatment(tx({ amount: -20, category_id: 'gibt-es-nicht' }), ctx())).toBe(
        'uncategorized',
      );
    });
  });

  describe('Variable Konsumausgaben zählen', () => {
    it('essenziell-variabel (Lebensmittel) -> variable_consumption', () => {
      expect(classifyForecastTreatment(tx({ amount: -60, category_id: 'lebensmittel' }), ctx())).toBe(
        'variable_consumption',
      );
    });

    it('diskretionär (Restaurant) -> variable_consumption', () => {
      expect(classifyForecastTreatment(tx({ amount: -40, category_id: 'restaurant' }), ctx())).toBe(
        'variable_consumption',
      );
    });

    it('bewusst zugeordnete Kategorie ohne Ausgabenklasse (nutzererstellt) -> variable_consumption', () => {
      // Zuordnung vorhanden, nur Metadaten fehlen → echter Konsum, kein Zuordnungsproblem.
      expect(classifyForecastTreatment(tx({ amount: -25, category_id: 'custom' }), ctx())).toBe(
        'variable_consumption',
      );
    });
  });

  describe('Kategorieauflösung', () => {
    it('subcategory_id hat Vorrang vor category_id', () => {
      // category_id zeigt auf Lebensmittel (consumption), subcategory_id auf Einkommen → income gewinnt.
      const t = tx({ amount: -100, category_id: 'lebensmittel', subcategory_id: 'einkommen' });
      expect(classifyForecastTreatment(t, ctx())).toBe('income');
    });

    it('Unterkategorie ohne eigene Klasse erbt vom Parent (Einkommen)', () => {
      expect(classifyForecastTreatment(tx({ amount: -4000, category_id: 'gehalt' }), ctx())).toBe('income');
    });

    it('Unterkategorie ohne eigene Klasse erbt vom Parent (Sparen)', () => {
      expect(classifyForecastTreatment(tx({ amount: -300, category_id: 'etf' }), ctx())).toBe('saving_investment');
    });
  });

  describe('Präzedenz – verlässlichstes Signal zuerst', () => {
    it('is_contract schlägt die Kategorie: Miete (essenziell) als Vertrag -> fixed_recurring, nicht variable', () => {
      expect(classifyForecastTreatment(tx({ amount: -1200, category_id: 'miete', is_contract: true }), ctx())).toBe(
        'fixed_recurring',
      );
    });

    it('is_transfer schlägt alles, auch eine Einkommens-Kategorie', () => {
      expect(
        classifyForecastTreatment(tx({ amount: 5000, category_id: 'einkommen', is_transfer: true }), ctx()),
      ).toBe('transfer');
    });
  });
});
