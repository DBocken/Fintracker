import { describe, it, expect, beforeEach } from 'vitest';
import {
  readLocalFinanceList,
  upsertLocalFinanceItem,
  updateLocalFinanceItem,
  deleteLocalFinanceItem,
  mutateLocalFinanceList,
} from '../local-finance-store';
import { clearLocalKvStore } from '../idb-kv';
import { localEncryption } from '../local-crypto';

/**
 * Serialisierung der Schreibpfade (Issue #311, Ursache von #293).
 *
 * Jeder Test stellt das Rennen gezielt her: die Aufrufe werden NICHT
 * nacheinander abgewartet, sondern gemeinsam über `Promise.all` gestartet.
 * Genau so tritt der Fehler im Betrieb auf — zwei Dialoge, zwei Klicks, ein
 * Importlauf neben einer Nutzeraktion.
 */
describe('local-finance-store: gleichzeitige Schreibvorgänge', () => {
  beforeEach(async () => {
    localStorage.clear();
    await clearLocalKvStore();
    localEncryption.lock();
  });

  it('[REGRESSION] sollte bei zwei gleichzeitigen upsert-Aufrufen keinen Datensatz verlieren', async () => {
    await Promise.all([
      upsertLocalFinanceItem<{ id: string; name: string }>('accounts', { id: 'a1', name: 'Giro' }),
      upsertLocalFinanceItem<{ id: string; name: string }>('accounts', { id: 'a2', name: 'Tagesgeld' }),
    ]);

    const konten = await readLocalFinanceList<{ id: string }>('accounts');
    expect(konten.map((k) => k.id).sort()).toEqual(['a1', 'a2']);
  });

  it('[REGRESSION] sollte bei vielen gleichzeitigen Anlagen alle behalten', async () => {
    // Zehn statt zwei: Ein Importlauf legt nicht zwei Buchungen an.
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        upsertLocalFinanceItem<{ id: string; name: string }>('debts', { id: `d${i}`, name: `Schuld ${i}` }),
      ),
    );

    const schulden = await readLocalFinanceList<{ id: string }>('debts');
    expect(schulden).toHaveLength(10);
  });

  it('[REGRESSION] sollte bei gleichzeitigem Ändern zweier Datensätze beide Änderungen behalten', async () => {
    await upsertLocalFinanceItem<{ id: string; name: string }>('accounts', { id: 'a1', name: 'Giro' });
    await upsertLocalFinanceItem<{ id: string; name: string }>('accounts', { id: 'a2', name: 'Tagesgeld' });

    await Promise.all([
      updateLocalFinanceItem<{ id: string; name: string }>('accounts', 'a1', { name: 'Girokonto' }),
      updateLocalFinanceItem<{ id: string; name: string }>('accounts', 'a2', { name: 'Sparkonto' }),
    ]);

    const konten = await readLocalFinanceList<{ id: string; name: string }>('accounts');
    expect(konten.find((k) => k.id === 'a1')?.name).toBe('Girokonto');
    expect(konten.find((k) => k.id === 'a2')?.name).toBe('Sparkonto');
  });

  it('[REGRESSION] sollte eine gleichzeitige Löschung nicht durch eine Anlage rückgängig machen', async () => {
    await upsertLocalFinanceItem<{ id: string; name: string }>('accounts', { id: 'a1', name: 'Giro' });

    await Promise.all([
      deleteLocalFinanceItem('accounts', 'a1'),
      upsertLocalFinanceItem<{ id: string; name: string }>('accounts', { id: 'a2', name: 'Tagesgeld' }),
    ]);

    const konten = await readLocalFinanceList<{ id: string }>('accounts');
    expect(konten.map((k) => k.id)).toEqual(['a2']);
  });

  it('sollte verschiedene Collections nicht gegeneinander blockieren', async () => {
    await Promise.all([
      upsertLocalFinanceItem('accounts', { id: 'a1' }),
      upsertLocalFinanceItem('debts', { id: 'd1' }),
    ]);

    expect(await readLocalFinanceList('accounts')).toHaveLength(1);
    expect(await readLocalFinanceList('debts')).toHaveLength(1);
  });

  it('sollte nach einem Fehler im Ändern-Schritt nichts schreiben und den Schlüssel freigeben', async () => {
    await upsertLocalFinanceItem<{ id: string; name: string }>('accounts', { id: 'a1', name: 'Giro' });

    await expect(
      mutateLocalFinanceList<{ id: string }>('accounts', () => {
        throw new Error('Änderung abgelehnt');
      }),
    ).rejects.toThrow('Änderung abgelehnt');

    // Bestand unverändert …
    expect(await readLocalFinanceList<{ id: string }>('accounts')).toEqual([
      expect.objectContaining({ id: 'a1' }),
    ]);
    // … und der nächste Schreibvorgang läuft (keine Verklemmung).
    await upsertLocalFinanceItem('accounts', { id: 'a2' });
    expect(await readLocalFinanceList('accounts')).toHaveLength(2);
  });

  it('sollte einen unbekannten Datensatz weiterhin als Fehler melden', async () => {
    await expect(
      updateLocalFinanceItem<{ id: string; name: string }>('accounts', 'gibtsnicht', { name: 'x' }),
    ).rejects.toThrow();
  });
});
