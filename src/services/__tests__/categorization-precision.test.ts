import { describe, it, expect, beforeEach } from 'vitest';
import { applyAutoCategorization, recategorizeTransactions, saveTransactions, getTransactions } from '../transaction-service';
import { explainCategorization, MIN_SILENT_ASSIGN_CONFIDENCE } from '@/lib/categorization';
import { transactionStorage } from '../transaction-storage-service';
import { DEFAULT_LOCAL_CATEGORIES } from '../default-categories';
import type { Transaction } from '../../types';
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
    id: asTransactionId(overrides.id || `tx-${seq}`),
  };
}


describe('Kategorisierungs-Präzision (Wortgrenzen)', () => {
  describe('Regression Protection', () => {
    it('[REGRESSION] sollte "Bausparverein" NICHT als Vereine kategorisieren', () => {
      const result = explainCategorization(
        tx({ payee: 'Bausparverein Schwäbisch Hall' }),
        DEFAULT_LOCAL_CATEGORIES,
      );
      expect(result.categoryId).not.toBe('local-cat-vereine');
    });

    it('[REGRESSION] sollte die Deko-Kette "DEPOT" NICHT als Wertpapiere kategorisieren', () => {
      const result = explainCategorization(
        tx({ payee: 'DEPOT Deko GmbH Filiale 12' }),
        DEFAULT_LOCAL_CATEGORIES,
      );
      expect(result.categoryId).not.toBe('local-cat-wertpapiere');
    });

    it('[REGRESSION] sollte "GetFit GmbH" NICHT als Wertpapiere (etf) kategorisieren', () => {
      const result = explainCategorization(tx({ payee: 'GetFit GmbH' }), DEFAULT_LOCAL_CATEGORIES);
      expect(result.categoryId).not.toBe('local-cat-wertpapiere');
    });

    it('sollte "Depotgebühr" weiterhin als Wertpapiere erkennen', () => {
      const result = explainCategorization(
        tx({ payee: 'Consorsbank', description: 'Depotgebühr Q1' }),
        DEFAULT_LOCAL_CATEGORIES,
      );
      expect(result.categoryId).toBe('local-cat-wertpapiere');
    });

    it('sollte "Möbelhaus" weiterhin als Haushaltswaren erkennen (Kompensations-Keyword)', () => {
      const result = explainCategorization(tx({ payee: 'Möbelhaus XXL Lutz' }), DEFAULT_LOCAL_CATEGORIES);
      expect(result.categoryId).toBe('local-cat-haushaltswaren');
    });

    it('sollte etablierte Treffer nicht verlieren (rewe, aldi, verein standalone)', () => {
      expect(explainCategorization(tx({ payee: 'REWE SAGT DANKE 3847' }), DEFAULT_LOCAL_CATEGORIES).categoryId).toBe('local-cat-supermarkt');
      expect(explainCategorization(tx({ payee: 'Verein für Jugendhilfe' }), DEFAULT_LOCAL_CATEGORIES).categoryId).toBe('local-cat-vereine');
    });
  });
});

describe('Konfidenz-Floor für stille Zuweisung', () => {
  it('sollte die Konstante auf 0,7 setzen (mittlere Sicherheit)', () => {
    expect(MIN_SILENT_ASSIGN_CONFIDENCE).toBe(0.7);
  });

  describe('applyAutoCategorization', () => {
    it('sollte einen 0,55-Regex-Fallback-Treffer NICHT still zuweisen', async () => {
      // "Wohnung" trifft nur die Regex-Fallback-Regel \b(wohnung)\b (kein Keyword).
      const noiseTx = tx({ payee: 'Kaution Wohnung Meier' });
      expect(explainCategorization(noiseTx, DEFAULT_LOCAL_CATEGORIES).confidence).toBe(0.55);

      const [result] = await applyAutoCategorization([noiseTx]);
      expect(result.category_id).toBeNull();
      expect(result.auto_mapped).toBe(false);
    });

    it('sollte einen Keyword-Treffer (≥0,7) weiterhin still zuweisen', async () => {
      const [result] = await applyAutoCategorization([tx({ payee: 'REWE Markt' })]);
      expect(result.category_id).toBe('local-cat-supermarkt');
      expect(result.auto_mapped).toBe(true);
    });
  });

  describe('recategorizeTransactions', () => {
    it('[REGRESSION] sollte vom Nutzer bestätigte Kategorien NIE überschreiben', async () => {
      // Nutzer hat REWE bewusst als "Essen & Trinken" statt Supermarkt bestätigt.
      const seeded = tx({
        payee: 'REWE Markt',
        category_id: 'local-cat-restaurant',
        confirmed: true,
        auto_mapped: false,
      });
      await saveTransactions([seeded]);

      const summary = await recategorizeTransactions();

      const all = await getTransactions(100);
      const after = all.find((x) => x.id === seeded.id);
      expect(after?.category_id).toBe('local-cat-restaurant');
      // Bestätigte Buchungen tauchen auch nicht im Undo-Snapshot auf.
      expect(summary.undo.some((u) => u.id === seeded.id)).toBe(false);
    });

    it('sollte unbestätigte Buchungen weiterhin umkategorisieren', async () => {
      const seeded = tx({
        payee: 'REWE Markt',
        category_id: 'local-cat-restaurant',
        confirmed: false,
        auto_mapped: true,
      });
      await saveTransactions([seeded]);

      await recategorizeTransactions();

      const all = await getTransactions(100);
      const after = all.find((x) => x.id === seeded.id);
      expect(after?.category_id).toBe('local-cat-supermarkt');
    });

    it('sollte unbestätigte Buchungen nicht auf 0,55-Raten umkategorisieren', async () => {
      const seeded = tx({ payee: 'Kaution Wohnung Meier', category_id: null, confirmed: false });
      await saveTransactions([seeded]);

      await recategorizeTransactions();

      const all = await getTransactions(100);
      const after = all.find((x) => x.id === seeded.id);
      // Regex-Fallback (0,55) liegt unter dem Floor → bleibt unkategorisiert
      // (erscheint stattdessen als Vorschlag in der Coach-Inbox).
      expect(after?.category_id ?? null).toBeNull();
    });
  });
});
