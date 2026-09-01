import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Transaction } from '@/types';
import { asTransactionId } from '@/lib/ids';
import { idbGet, idbKeys, idbSet, clearLocalKvStore } from '../idb-kv';
import { localEncryption } from '../local-crypto';
import { transactionStorage } from '../transaction-storage-service';
import { getAllTransactions, saveTransactions, updateTransaction, deleteTransaction } from '../transaction-service';

/**
 * WP 4.1c (PERF-1): `transactionStorage` schaltet auf die Chunk-Ablage um,
 * sobald der v3-Blob fehlt (Migration gelaufen bzw. Neuinstallation ohne
 * v3-Altbestand). Diese Tests decken genau diesen — bislang ungetesteten —
 * Zweig ab; die bestehenden v3-Tests (`transaction-storage-service.*.test.ts`)
 * bleiben unverändert grün, weil sie den v3-Blob selbst anlegen und damit im
 * Legacy-Zweig bleiben (`hasLegacyV3Blob`).
 */

function tx(id: string, date: string, overrides: Omit<Partial<Transaction>, 'id'> = {}): Transaction {
  return {
    id: asTransactionId(id),
    date,
    amount: -12.34,
    payee: 'REWE',
    description: 'Einkauf',
    original_text: 'REWE Einkauf',
    category_id: null,
    auto_mapped: false,
    confirmed: true,
    ...overrides,
  };
}

beforeEach(async () => {
  // Voller Reset (nicht nur setItem): mehrere Tests in dieser Datei
  // aktivieren die Verschlüsselung (`localEncryption.enable`), deren Config
  // in localStorage lebt (nicht in IndexedDB) — ohne `localStorage.clear()`
  // bliebe sie über Tests hinweg "aktiv, aber gesperrt" stehen und ließe
  // spätere, unverschlüsselte Tests fälschlich mit LocalEncryptionLockedError
  // scheitern.
  localStorage.clear();
  localStorage.setItem('ausgabentracker_locale_v1', 'de');
  localEncryption.lock();
  await clearLocalKvStore();
  await transactionStorage.clearLocalCache();
});

describe('transactionStorage im Chunk-Modus (kein v3-Blob vorhanden)', () => {
  it('sollte eine neue Buchung in einem v4-Chunk ablegen, NICHT im v3-Schlüssel', async () => {
    await saveTransactions([tx('t1', '2026-05-10')]);

    expect(await idbGet('ausgabentracker_transactions_v3')).toBeNull();
    const v4Keys = (await idbKeys()).filter((k) => k.startsWith('ausgabentracker_transactions_v4_'));
    expect(v4Keys.length).toBeGreaterThan(0);

    const all = await getAllTransactions();
    expect(all.map((t) => t.id)).toEqual(['t1']);
  });

  it('sollte Buchungen über mehrere Quartale korrekt speichern und wieder lesen', async () => {
    await saveTransactions([
      tx('q1', '2026-01-10'),
      tx('q2', '2026-04-10'),
      tx('q3', '2026-08-10'),
    ]);

    const all = await getAllTransactions();
    expect(all.map((t) => t.id).sort()).toEqual(['q1', 'q2', 'q3']);
  });

  it('[REGRESSION] ein Vollesen nach einer Einzeländerung liefert den geänderten Stand (kein veralteter Cache)', async () => {
    await saveTransactions([tx('t1', '2026-05-10')]);
    await getAllTransactions(); // Cache wärmen

    await updateTransaction([{ id: 't1', category_id: 'local-cat-lebensmittel' }]);

    const after = await getAllTransactions();
    expect(after.find((t) => t.id === 't1')?.category_id).toBe('local-cat-lebensmittel');
  });

  it('updateTransaction mit geändertem Datum lässt die Buchung ins neue Quartal wandern', async () => {
    await saveTransactions([tx('t1', '2026-01-10')]);

    await transactionStorage.updateTransaction('t1', { date: '2026-08-01' });

    const all = await getAllTransactions();
    expect(all).toHaveLength(1);
    expect(all[0].date).toBe('2026-08-01');

    // Physisch im neuen Quartal, nicht mehr im alten.
    const q1Raw = await idbGet('ausgabentracker_transactions_v4_2026-Q1');
    const q3Raw = await idbGet('ausgabentracker_transactions_v4_2026-Q3');
    expect(q1Raw ? JSON.parse(q1Raw) : []).toEqual([]);
    expect(JSON.parse(q3Raw!).map((t: Transaction) => t.id)).toEqual(['t1']);
  });

  it('deleteTransaction entfernt die Buchung aus ihrem Quartal', async () => {
    await saveTransactions([tx('t1', '2026-05-10'), tx('t2', '2026-05-11')]);
    await deleteTransaction('t1');

    const all = await getAllTransactions();
    expect(all.map((t) => t.id)).toEqual(['t2']);
  });

  it('ein identischer Reimport (gleiche ID) erzeugt keine Dopplung, auch im Chunk-Modus', async () => {
    await saveTransactions([tx('csv-stable', '2026-05-10', { category_id: 'lebensmittel' })]);
    await saveTransactions([tx('csv-stable', '2026-05-10', { category_id: null })]);

    const all = await getAllTransactions();
    expect(all).toHaveLength(1);
    expect(all[0].category_id).toBe('lebensmittel');
  });

  describe('[REGRESSION] getTransactions() meldet einen Fehlschlag als Fehlschlag statt als leere Liste', () => {
    it('gesperrter Tresor: transactionStorage.getTransactions() liefert success:false (nicht success:true/data:[])', async () => {
      await localEncryption.enable('correct horse battery staple');
      await saveTransactions([tx('t1', '2026-05-10')]);
      localEncryption.lock();

      const result = await transactionStorage.getTransactions(100, 0);

      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
    });

    it('gesperrter Tresor: die Fassade (transaction-service.getAllTransactions) wirft statt eine leere Liste vorzutäuschen', async () => {
      await localEncryption.enable('correct horse battery staple');
      await saveTransactions([tx('t1', '2026-05-10')]);
      localEncryption.lock();

      await expect(getAllTransactions()).rejects.toThrow();
    });

    it('kaputter Chunk: getTransactions() liefert success:false statt den korrupten Chunk stillschweigend zu unterschlagen', async () => {
      await saveTransactions([tx('t1', '2026-05-10')]);
      const key = 'ausgabentracker_transactions_v4_2026-Q2';
      await idbSet(key, '{not valid json');

      const result = await transactionStorage.getTransactions(100, 0);
      expect(result.success).toBe(false);
    });
  });
});

describe('transactionStorage.clearLocalCache() räumt auch die Chunk-Ablage auf (WP 4.1c)', () => {
  it('sollte v4-Chunks + Index entfernen, nicht nur den v3-Schlüssel', async () => {
    await saveTransactions([tx('t1', '2026-05-10')]);
    expect((await idbKeys()).some((k) => k.startsWith('ausgabentracker_transactions_v4_'))).toBe(true);

    await transactionStorage.clearLocalCache();

    expect((await idbKeys()).some((k) => k.startsWith('ausgabentracker_transactions_v4_'))).toBe(false);
    expect(await getAllTransactions()).toEqual([]);
  });
});

describe('[REGRESSION] Serialisierung der Chunk-Schreibpfade', () => {
  /**
   * Audit 2026-09, F1: Lesen → `await` → Schreiben lief ohne Lock; nur der
   * Index war gesperrt. Zwei gleichzeitige Aufrufe lasen denselben Stand, und
   * der zweite schrieb eine Fassung ohne die Buchung des ersten — lautlos.
   *
   * Der Deadlock-Test steht bewusst zuerst: Legt man den Lock auf BEIDE Ebenen
   * (Legacy-Methode und ihre Chunk-Schwester, an die sie delegiert), wartet die
   * äußere auf sich selbst — `withKeyLock` ist nicht reentrant. Die drei
   * Lost-Update-Tests darunter wären dann nicht rot, sie würden HÄNGEN; ein
   * Test mit Zeitschranke ist der einzige, der das benennt.
   */
  it('[REGRESSION] sollte bei zwei gleichzeitigen Speichervorgängen nicht verklemmen', async () => {
    const beide = Promise.all([
      saveTransactions([tx('deadlock-a', '2026-05-10')]),
      saveTransactions([tx('deadlock-b', '2026-05-11')]),
    ]);
    const zeitschranke = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Schreibpfad verklemmt: der Lock schachtelt in sich selbst')), 5000),
    );

    await expect(Promise.race([beide, zeitschranke])).resolves.toBeDefined();
  });

  it('[REGRESSION] sollte bei zwei gleichzeitigen saveTransactions im selben Quartal beide Buchungen behalten', async () => {
    await Promise.all([
      saveTransactions([tx('a', '2026-05-10')]),
      saveTransactions([tx('b', '2026-05-11')]),
    ]);

    const alle = await getAllTransactions();
    expect(alle.map((t) => t.id).sort()).toEqual(['a', 'b']);
  });

  it('[REGRESSION] sollte gleichzeitiges update und delete verschiedener Buchungen desselben Quartals nicht gegenseitig überschreiben', async () => {
    await saveTransactions([tx('bleibt', '2026-05-10'), tx('geht', '2026-05-11')]);

    // Direkt über die Storage-API: `transaction-service.updateTransaction`
    // patcht nur Kategorie-, Vertrags- und Steuerfelder — `payee` gehört nicht
    // dazu, und geprüft wird hier ohnehin der Schreibpfad des Storage.
    await Promise.all([
      transactionStorage.updateTransaction('bleibt', { payee: 'ALDI' }),
      deleteTransaction(asTransactionId('geht')),
    ]);

    const alle = await getAllTransactions();
    expect(alle.map((t) => t.id)).toEqual(['bleibt']);
    expect(alle[0].payee).toBe('ALDI');
  });

  it('[REGRESSION] sollte einen Quartalswechsel per update nicht mit einem gleichzeitigen save kollidieren lassen', async () => {
    await saveTransactions([tx('wandert', '2026-05-10')]);

    await Promise.all([
      transactionStorage.updateTransaction('wandert', { date: '2026-08-15' }),
      saveTransactions([tx('neu', '2026-08-20')]),
    ]);

    const alle = await getAllTransactions();
    expect(alle.map((t) => t.id).sort()).toEqual(['neu', 'wandert']);
    expect(alle.find((t) => t.id === 'wandert')!.date).toBe('2026-08-15');
  });
});

describe('[INTEGRITY] Inhaltliche Zweit-Dedup beim Speichern (Audit 2026-09, F3a)', () => {
  /**
   * Der Vorkommenszähler aus WP6 löst den Regelfall, aber zwei Fälle kann er
   * nicht lösen: eine Bestands-Buchung, die noch die ALTE ID-Form aus dem
   * Zeilenindex trägt, und einen zweiten Export, der mitten in eine Reihe
   * identischer Zeilen schneidet. Beide fängt erst die inhaltliche Prüfung im
   * Speicherpfad — sie ist deshalb kein Sonderweg für Bestandsnutzer, sondern
   * der eigentliche Wächter der Idempotenz.
   */
  const inhalt = {
    date: '2026-02-15',
    amount: -49.99,
    payee: 'NETFLIX',
    description: 'Abo',
    original_text: 'Abo',
    currency: 'EUR',
  };

  it('[REGRESSION] sollte einen Reimport mit neuer ID-Form nicht neben eine Alt-ID-Buchung gleichen Inhalts legen', async () => {
    await saveTransactions([{ ...tx('csv-alteform', inhalt.date), ...inhalt, id: asTransactionId('csv-alteform') }]);

    const ergebnis = await transactionStorage.saveTransactions([
      { ...tx('csv-neueform', inhalt.date), ...inhalt, id: asTransactionId('csv-neueform') },
    ]);

    const alle = await getAllTransactions();
    expect(alle.map((t) => t.id)).toEqual(['csv-alteform']);
    // Gezählt, nicht still verschluckt.
    expect(ergebnis.skippedAsDuplicate).toBe(1);
  });

  it('[INTEGRITY] sollte eine wiederholte identische Zeile nicht duplizieren, wenn der zweite Export mitten in der Wiederholungsreihe beginnt', async () => {
    // Bestand: zweimal derselbe Inhalt, korrekt als zwei Buchungen (Vorkommen
    // 0 und 1). Der zweite Export enthält nur noch die zweite — dort ist sie
    // Vorkommen 0 und bekommt deshalb die ID der ERSTEN.
    await saveTransactions([
      { ...tx('csv-vorkommen-0', inhalt.date), ...inhalt, id: asTransactionId('csv-vorkommen-0') },
      { ...tx('csv-vorkommen-1', inhalt.date), ...inhalt, id: asTransactionId('csv-vorkommen-1') },
    ]);

    await transactionStorage.saveTransactions([
      { ...tx('csv-vorkommen-0', inhalt.date), ...inhalt, id: asTransactionId('csv-vorkommen-0') },
    ]);

    const alle = await getAllTransactions();
    expect(alle).toHaveLength(2);
  });

  it('sollte eine manuell angelegte Buchung gleichen Inhalts NICHT als Dublette verwerfen', async () => {
    // Zweimal derselbe Bäcker am selben Tag ist keine Dublette, sondern zwei
    // Brötchen. Die inhaltliche Prüfung gilt nur für csv-IDs.
    await saveTransactions([{ ...tx('manuell-1', inhalt.date), ...inhalt, id: asTransactionId('manuell-1') }]);
    await saveTransactions([{ ...tx('manuell-2', inhalt.date), ...inhalt, id: asTransactionId('manuell-2') }]);

    expect(await getAllTransactions()).toHaveLength(2);
  });
});

describe('Import-Laufzeit: die Dedup-Menge entsteht einmal, nicht je Zeile', () => {
  /**
   * WP1 + WP4 + WP6 multiplizieren sich, wenn man sie einzeln richtig baut:
   * Der Lock legt den ganzen Rumpf still, die 10.000er-Kappung ist weg, und
   * die inhaltliche Dedup läuft über den Bestand — INNERHALB des Locks. Wird
   * die Vergleichsmenge je Zeile aufgebaut statt einmal davor, kostet ein
   * Import von n Zeilen über einem Bestand von m Buchungen n × m statt n + m
   * (AGENTS.md §3, „Was vor der Schleife indiziert wird").
   *
   * Gemessen werden ZUGRIFFE, nicht die Uhr — eine Zeitmessung in CI ist eine
   * Wette auf die Auslastung des Runners (Vorbild: categorizer.test.ts).
   */
  it('sollte den Bestand beim Speichern genau einmal lesen, unabhängig von der Stapelgröße', async () => {
    await saveTransactions(
      Array.from({ length: 200 }, (_, i) => tx(`bestand-${i}`, '2026-01-15')),
    );

    const leseZugriffe = vi.spyOn(localEncryption, 'loadAndMaybeDecrypt');

    const stapel = Array.from({ length: 300 }, (_, i) =>
      tx(`neu-${i}`, '2026-01-16', { payee: `HAENDLER ${i}` }),
    );
    await transactionStorage.saveTransactions(stapel);

    // Ein Chunk (2026-Q1) plus der Index — der Aufwand hängt an der Zahl der
    // QUARTALE, nicht an der Zahl der eingehenden Zeilen.
    expect(leseZugriffe.mock.calls.length).toBeLessThanOrEqual(4);
    leseZugriffe.mockRestore();
  });
});
