import { describe, it, expect } from 'vitest';
import { migrateCategoryPack2026 } from '../category-migrations';
import { DEFAULT_LOCAL_CATEGORIES } from '../default-categories';
import { explainCategorization } from '@/lib/categorization';
import type { Category, Transaction } from '../../types';
import { asTransactionId } from '@/lib/ids';

function tx(overrides: Omit<Partial<Transaction>, 'id'> & { id?: string }): Transaction {
  return {
    date: '2026-03-10',
    amount: -50,
    payee: '',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: false,
    ...overrides,
    // `id`: ausdrueckliches `id: undefined` MUSS undefined bleiben (WP 5.2b).
    // Vor dem Brand stand die Vorgabe VOR dem Spread, ein `undefined` aus
    // den Overrides hat sie also ueberschrieben. Nur das FEHLEN des
    // Schluessels faellt auf die Vorgabe zurueck.
    id: 'id' in overrides
      ? (overrides.id === undefined ? undefined : asTransactionId(overrides.id))
      : asTransactionId(crypto.randomUUID()),
  };
}

function cat(overrides: Partial<Category>): Category {
  return { id: overrides.id || crypto.randomUUID(), name: 'Kategorie', filters: [], ...overrides };
}

describe('Kategorien-Paket 2026 (Kinder & Familie, Bildung, Steuern & Abgaben)', () => {
  describe('Neue Defaults', () => {
    it('sollte Kinderbetreuung mit Steuer-Default (80 %/4.800 €-Regel) liefern', () => {
      const betreuung = DEFAULT_LOCAL_CATEGORIES.find((c) => c.id === 'local-cat-kinderbetreuung');
      expect(betreuung?.parent_id).toBe('local-cat-kinderfamilie');
      expect(betreuung?.attributes?.default_tax_category_id).toBe('tax-so-kinderbetreuung');
      expect(betreuung?.attributes?.ausgabenklasse).toBe('essenziell');
    });

    it('sollte Schule mit Schulgeld-Steuer-Default liefern', () => {
      const schule = DEFAULT_LOCAL_CATEGORIES.find((c) => c.id === 'local-cat-schule');
      expect(schule?.attributes?.default_tax_category_id).toBe('tax-so-schulgeld');
    });

    it('sollte Fortbildung mit Werbungskosten-Steuer-Default liefern', () => {
      const fortbildung = DEFAULT_LOCAL_CATEGORIES.find((c) => c.id === 'local-cat-fortbildung');
      expect(fortbildung?.parent_id).toBe('local-cat-bildung');
      expect(fortbildung?.attributes?.default_tax_category_id).toBe('tax-n-fortbildung');
    });

    it('sollte Steuern & Abgaben als essenzielle Hauptkategorie liefern', () => {
      const main = DEFAULT_LOCAL_CATEGORIES.find((c) => c.id === 'local-cat-steuernabgaben');
      expect(main?.parent_id).toBeNull();
      expect(main?.attributes?.ausgabenklasse).toBe('essenziell');
      expect(DEFAULT_LOCAL_CATEGORIES.some((c) => c.id === 'local-cat-grundsteuerabgabe')).toBe(true);
    });

    it('[REGRESSION] sollte "grundsteuer" NICHT mehr als Miete führen (Eigentümer-Falle)', () => {
      const miete = DEFAULT_LOCAL_CATEGORIES.find((c) => c.id === 'local-cat-miete');
      expect(miete?.filters).not.toContain('grundsteuer');
    });
  });

  describe('Engine-Erkennung', () => {
    it('sollte eine Kita-Buchung als Kinderbetreuung erkennen', () => {
      const result = explainCategorization(tx({ payee: 'KITA Sonnenschein Elternbeitrag' }), DEFAULT_LOCAL_CATEGORIES);
      expect(result.categoryId).toBe('local-cat-kinderbetreuung');
    });

    it('sollte eine Grundsteuer-Zahlung als Steuern & Abgaben erkennen', () => {
      const result = explainCategorization(
        tx({ payee: 'Stadt Köln', description: 'Grundsteuer B 2026' }),
        DEFAULT_LOCAL_CATEGORIES,
      );
      expect(result.categoryId).toBe('local-cat-grundsteuerabgabe');
    });

    it('sollte eine VHS-Kursgebühr als Fortbildung erkennen', () => {
      const result = explainCategorization(tx({ payee: 'Volkshochschule Bonn Kursgebühr' }), DEFAULT_LOCAL_CATEGORIES);
      expect(result.categoryId).toBe('local-cat-fortbildung');
    });
  });

  describe('Migration für Bestandsnutzer', () => {
    it('sollte die neuen Kategorien additiv anhängen', () => {
      const stored = [cat({ id: 'local-cat-wohnen', is_default: true, parent_id: null })];
      const { categories, changed } = migrateCategoryPack2026(stored);
      expect(changed).toBe(true);
      expect(categories.some((c) => c.id === 'local-cat-kinderfamilie')).toBe(true);
      expect(categories.some((c) => c.id === 'local-cat-kinderbetreuung')).toBe(true);
      expect(categories.some((c) => c.id === 'local-cat-bildung')).toBe(true);
      expect(categories.some((c) => c.id === 'local-cat-steuernabgaben')).toBe(true);
    });

    it('sollte "grundsteuer" aus unveränderten Miete-Defaults entfernen', () => {
      const stored = [
        cat({ id: 'local-cat-miete', is_default: true, filters: ['miete', 'grundsteuer', 'kaltmiete'] }),
      ];
      const { categories } = migrateCategoryPack2026(stored);
      const miete = categories.find((c) => c.id === 'local-cat-miete');
      expect(miete?.filters).toEqual(['miete', 'kaltmiete']);
    });

    it('[REGRESSION] sollte idempotent sein (F-CAT)', () => {
      const first = migrateCategoryPack2026([
        cat({ id: 'local-cat-miete', is_default: true, filters: ['miete', 'grundsteuer'] }),
      ]);
      const second = migrateCategoryPack2026(first.categories);
      expect(second.changed).toBe(false);
    });

    it('[REGRESSION] sollte Nutzer-Overrides der Miete-Filter nicht anfassen', () => {
      const stored = [
        cat({ id: 'local-cat-miete', is_default: false, filters: ['miete', 'grundsteuer'] }),
      ];
      const { categories } = migrateCategoryPack2026(stored);
      expect(categories.find((c) => c.id === 'local-cat-miete')?.filters).toContain('grundsteuer');
    });
  });
});
