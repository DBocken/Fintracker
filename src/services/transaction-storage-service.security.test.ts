import { beforeEach, describe, expect, it } from 'vitest';
import type { Transaction } from '@/types';
import { idbRemove } from './idb-kv';
import { localEncryption } from './local-crypto';
import { transactionStorage } from './transaction-storage-service';

const STORAGE_KEY = 'ausgabentracker_transactions_v3';

function transaction(id: string, categoryId: string | null = null): Transaction {
  return {
    id,
    date: '2026-06-21',
    amount: -12.34,
    payee: 'REWE',
    description: 'Einkauf',
    original_text: 'REWE Einkauf',
    category_id: categoryId,
    auto_mapped: false,
    confirmed: true,
  };
}

function transactionOn(id: string, date: string): Transaction {
  return { ...transaction(id), date };
}

beforeEach(async () => {
  localEncryption.lock();
  localStorage.clear();
  await idbRemove(STORAGE_KEY);
});

describe('[INTEGRITY] transaction storage idempotency', () => {
  it('speichert dieselbe Import-ID nur einmal', async () => {
    await transactionStorage.saveTransactions([transaction('csv-stable')]);
    await transactionStorage.saveTransactions([transaction('csv-stable')]);

    const stored = await transactionStorage.getTransactions(100, 0);
    expect(stored.success).toBe(true);
    expect(stored.data).toHaveLength(1);
  });

  it('überschreibt eine manuelle Kategorie nicht durch identischen Reimport', async () => {
    await transactionStorage.saveTransactions([transaction('csv-stable', 'lebensmittel')]);
    await transactionStorage.saveTransactions([transaction('csv-stable', null)]);

    const stored = await transactionStorage.getTransactions(100, 0);
    expect(stored.data?.[0].category_id).toBe('lebensmittel');
  });

  it('behält unterschiedliche Buchungen trotz gleichen Inhalts, wenn ihre IDs verschieden sind', async () => {
    await transactionStorage.saveTransactions([transaction('row-1'), transaction('row-2')]);
    const stored = await transactionStorage.getTransactions(100, 0);
    expect(stored.data?.map((item) => item.id)).toEqual(['row-1', 'row-2']);
  });
});

describe('Transaction window (limit) ordering', () => {
  it('[REGRESSION] behält bei einem Limit die JÜNGSTEN Buchungen, nicht die Import-Reihenfolge', async () => {
    // In Speicher-/Importreihenfolge zuerst alte, dann neue Buchungen ablegen.
    // Ein Limit darf nicht die ersten N in Import-Reihenfolge nehmen (sonst gehen
    // die jüngsten verloren und laufende Verträge wirken beendet).
    await transactionStorage.saveTransactions([
      transactionOn('alt-1', '2024-01-15'),
      transactionOn('alt-2', '2024-02-15'),
      transactionOn('neu-1', '2026-05-15'),
      transactionOn('neu-2', '2026-06-15'),
    ]);

    const limited = await transactionStorage.getTransactions(2, 0);
    expect(limited.data?.map((t) => t.id)).toEqual(['neu-2', 'neu-1']);
  });

  it('liefert alle Buchungen nach Datum absteigend sortiert', async () => {
    await transactionStorage.saveTransactions([
      transactionOn('b', '2026-03-01'),
      transactionOn('a', '2026-06-01'),
      transactionOn('c', '2026-01-01'),
    ]);

    const all = await transactionStorage.getTransactions(100, 0);
    expect(all.data?.map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('[SECURITY] CSV export', () => {
  it('neutralisiert Tabellenformeln in nutzerkontrollierten Textfeldern', async () => {
    const malicious = transaction('formula');
    malicious.payee = '=HYPERLINK("https://example.invalid","click")';
    malicious.description = '@SUM(1+1)';

    const exported = await transactionStorage.exportToCSV([malicious]);
    expect(exported.success).toBe(true);
    expect(exported.data).toContain("'=HYPERLINK");
    expect(exported.data).toContain("'@SUM");
  });

  it('[REGRESSION] exportiert negative Beträge als Zahl, nicht als Text-Formel', async () => {
    const tx = transaction('neg');
    tx.amount = -12.34;
    const exported = await transactionStorage.exportToCSV([tx]);
    expect(exported.success).toBe(true);
    // Betrag bleibt "-12,34" ohne führendes Apostroph → Excel rechnet damit.
    expect(exported.data).toContain(';-12,34;');
    expect(exported.data).not.toContain("'-12,34");
  });

  it('[SECURITY] neutralisiert Formel-Injection hinter eingebettetem Trennzeichen', async () => {
    const tx = transaction('embedded');
    // Ohne RFC-4180-Quoting würde ';' eine zweite, mit '=' beginnende Zelle
    // erzeugen, die Excel ausführt.
    tx.payee = 'Shop;=HYPERLINK("http://evil","x")';
    const exported = await transactionStorage.exportToCSV([tx]);
    expect(exported.success).toBe(true);
    // Die gesamte Zelle ist RFC-4180-gequotet (ein Feld); das eingebettete ';'
    // ist damit kein Trennzeichen und das '=' nicht der Anfang einer neuen Zelle.
    expect(exported.data).toContain('"Shop;=HYPERLINK(');
    // Innere Quotes verdoppelt = Beleg für korrektes Quoting des ganzen Feldes.
    expect(exported.data).toContain('""http://evil""');
  });

  it('[SECURITY] neutralisiert Tab-präfigierte Formeln', async () => {
    const tx = transaction('tab');
    tx.payee = '\t=1+1';
    const exported = await transactionStorage.exportToCSV([tx]);
    expect(exported.success).toBe(true);
    expect(exported.data).toContain("'\t=1+1");
  });
});
