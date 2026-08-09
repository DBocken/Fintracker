import { describe, it, expect, beforeEach } from 'vitest';
import { buildAutoCategoryPreview } from '../review-preview';
import { applyAutoCategorization } from '@/services/transaction-service';
import { transactionStorage } from '@/services/transaction-storage-service';
import { DEFAULT_LOCAL_CATEGORIES } from '@/services/default-categories';
import type { Category, Transaction } from '@/types';
import type { MerchantRule } from '@/lib/categorization';
import { asTransactionId } from '@/lib/ids';

beforeEach(async () => {
  localStorage.setItem('ausgabentracker_locale_v1', 'de');
  await transactionStorage.clearLocalCache();
});

let seq = 0;
function tx(overrides: Omit<Partial<Transaction>, 'id'> & { id?: string }): Transaction {
  seq += 1;
  return {
    date: '2026-03-10',
    amount: -50,
    payee: '',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: false,
    ...overrides,
    id: asTransactionId(overrides.id || `row-${seq}`),
  };
}

function cat(id: string, filters: string[], name = id): Category {
  return { id, name, filters };
}

describe('buildAutoCategoryPreview (CSV-Review-Spalte)', () => {
  describe('Konsistenz mit der Engine (eine Wahrheit)', () => {
    it('[REGRESSION] sollte gelernte Händler-Regeln berücksichtigen (alte Zweit-Implementierung tat das nicht)', () => {
      const categories = [cat('food', ['aldi'], 'Lebensmittel'), cat('custom', [], 'Meine Kategorie')];
      const rules: MerchantRule[] = [
        { id: 'r1', merchant_pattern: 'aldi', category_id: 'custom', created_at: '', updated_at: '' } as MerchantRule,
      ];
      const row = tx({ payee: 'ALDI Süd' });
      const preview = buildAutoCategoryPreview([row], categories, rules);
      expect(preview.get(row.id!)?.category.id).toBe('custom');
      expect(preview.get(row.id!)?.level).toBe('hoch');
    });

    it('[REGRESSION] sollte Spezifität gewinnen lassen (nicht first-match wie früher)', () => {
      const categories = [
        cat('one-hit', ['bahn'], 'Eine'),
        cat('two-hits', ['bahn', 'fernverkehr'], 'Zwei'),
      ];
      const row = tx({ payee: 'Deutsche Bahn Fernverkehr' });
      const preview = buildAutoCategoryPreview([row], categories, []);
      expect(preview.get(row.id!)?.category.id).toBe('two-hits');
    });

    it('[REGRESSION] sollte den Richtungs-Guard anwenden (Ausgabe nie in Einkommens-Kategorie)', () => {
      const row = tx({ payee: 'Gehalt Rückbuchung', amount: -500 });
      const preview = buildAutoCategoryPreview([row], DEFAULT_LOCAL_CATEGORIES, []);
      const hit = preview.get(row.id!);
      if (hit) {
        expect(hit.category.attributes?.ausgabenklasse).not.toBe('einkommen');
      }
    });

    it('[REGRESSION] sollte exakt das anzeigen, was applyAutoCategorization zuweist (inkl. Konfidenz-Floor)', async () => {
      // "Wohnung" trifft nur den Regex-Fallback (0,55) → wird weder zugewiesen noch angezeigt.
      const rows = [tx({ payee: 'Kaution Wohnung Meier' }), tx({ payee: 'REWE Markt' })];
      const preview = buildAutoCategoryPreview(rows, DEFAULT_LOCAL_CATEGORIES, []);
      const assigned = await applyAutoCategorization(rows);

      for (const row of rows) {
        const shown = preview.get(row.id!)?.category.id ?? null;
        const actual = assigned.find((a) => a.id === row.id)?.category_id ?? null;
        expect(shown, `Anzeige und Zuweisung müssen übereinstimmen für ${row.payee}`).toBe(actual);
      }
    });
  });

  describe('Konfidenz-Level', () => {
    it('sollte 1-Keyword-Treffer als "mittel" ausweisen', () => {
      const row = tx({ payee: 'REWE Markt' });
      const preview = buildAutoCategoryPreview([row], DEFAULT_LOCAL_CATEGORIES, []);
      expect(preview.get(row.id!)?.level).toBe('mittel');
    });

    it('sollte Mehrfach-Treffer als "hoch" ausweisen', () => {
      const categories = [cat('two-hits', ['bahn', 'fernverkehr'], 'Zwei')];
      const row = tx({ payee: 'Deutsche Bahn Fernverkehr' });
      const preview = buildAutoCategoryPreview([row], categories, []);
      expect(preview.get(row.id!)?.level).toBe('hoch');
    });
  });

  describe('Edge Cases', () => {
    it('sollte Zeilen ohne Treffer auslassen', () => {
      const row = tx({ payee: 'Völlig Unbekannt XYZ' });
      const preview = buildAutoCategoryPreview([row], DEFAULT_LOCAL_CATEGORIES, []);
      expect(preview.has(row.id!)).toBe(false);
    });

    it('sollte Zeilen ohne id überspringen', () => {
      const row = { ...tx({ payee: 'REWE' }), id: undefined };
      const preview = buildAutoCategoryPreview([row], DEFAULT_LOCAL_CATEGORIES, []);
      expect(preview.size).toBe(0);
    });
  });
});
