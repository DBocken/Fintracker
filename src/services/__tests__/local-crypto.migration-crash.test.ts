import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

/**
 * [REGRESSION] Audit `docs/qualitaet-2026-08/audit.md` RES-3, „Solide"-Absatz:
 * Die Umschlüsselungs-Migration (`localEncryption.migrateFinanceKeys`) galt
 * bislang nur code-analytisch als selbstheilend bei einem Abbruch mitten im
 * Lauf — ohne Test. Dieser File holt das nach: ein Schreibfehler (simuliert
 * einen vollen Speicher) mitten in der Schlüsselschleife darf keinen Key
 * unlesbar zurücklassen — weder halb verschlüsselt noch verloren.
 */

vi.mock('../idb-kv', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../idb-kv')>();
  return { ...actual, idbSet: vi.fn(actual.idbSet) };
});

import { idbSet, idbGet, clearLocalKvStore } from '../idb-kv';
import { localEncryption } from '../local-crypto';
import { LOCAL_FINANCE_KEYS } from '../local-storage-keys';

const idbSetMock = idbSet as unknown as Mock;

describe('localEncryption.migrateFinanceKeys: Abbruch mitten in der Umschlüsselung', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('ausgabentracker_locale_v1', 'de');
    localEncryption.lock();
    idbSetMock.mockClear();
  });

  afterEach(async () => {
    idbSetMock.mockReset();
    await clearLocalKvStore();
    localStorage.clear();
    localEncryption.lock();
  });

  it('[REGRESSION] encrypt(): ein Schreibfehler am ersten Key darf keinen Key unlesbar zurücklassen und ein Retry muss beide fertig verschlüsseln', async () => {
    await localEncryption.enable('correct horse battery staple');
    idbSetMock.mockClear();

    const keyA = LOCAL_FINANCE_KEYS.transactions;
    const keyB = LOCAL_FINANCE_KEYS.accounts;
    const payloadA = [{ id: 'a1', amount: -12 }];
    const payloadB = [{ id: 'b1', name: 'Girokonto' }];

    // Klartext simulieren, als wäre die Verschlüsselung erst NACH dem Anlegen
    // dieser beiden Collections aktiviert worden (idbSetMock hier bewusst
    // noch nicht scharf geschaltet — das ist Testaufbau, kein Migrationsschritt).
    await idbSet(keyA, JSON.stringify(payloadA));
    await idbSet(keyB, JSON.stringify(payloadB));

    idbSetMock.mockImplementationOnce(async () => {
      throw new Error('Speicher voll (simuliert)');
    });

    await expect(localEncryption.migrateFinanceKeys('encrypt')).rejects.toThrow(
      'Speicher voll (simuliert)',
    );

    // Kein Key darf jetzt unlesbar sein: jeder Rohwert ist entweder noch das
    // unveränderte Original ODER bereits ein gültiger, entschlüsselbarer
    // Envelope — nie etwas dazwischen.
    for (const [key, original] of [
      [keyA, payloadA],
      [keyB, payloadB],
    ] as const) {
      const raw = await idbGet(key);
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!);
      if (parsed?.type === 'ausgabentracker.enc') {
        const decrypted = await localEncryption.decryptJson(parsed);
        expect(decrypted).toEqual(original);
      } else {
        expect(parsed).toEqual(original);
      }
    }

    // Retry ohne Fehler: beide Keys müssen jetzt vollständig verschlüsselt sein.
    await localEncryption.migrateFinanceKeys('encrypt');

    for (const [key, original] of [
      [keyA, payloadA],
      [keyB, payloadB],
    ] as const) {
      const raw = await idbGet(key);
      const parsed = JSON.parse(raw!);
      expect(parsed.type).toBe('ausgabentracker.enc');
      const decrypted = await localEncryption.decryptJson(parsed);
      expect(decrypted).toEqual(original);
    }
  });

  it('[REGRESSION] decrypt(): ein Schreibfehler am ersten Key darf keinen Key unlesbar zurücklassen und ein Retry muss beide fertig entschlüsseln', async () => {
    await localEncryption.enable('correct horse battery staple');

    const keyA = LOCAL_FINANCE_KEYS.transactions;
    const keyB = LOCAL_FINANCE_KEYS.accounts;
    const payloadA = [{ id: 'a1', amount: -12 }];
    const payloadB = [{ id: 'b1', name: 'Girokonto' }];

    // Beide Keys bereits verschlüsselt, wie es vor disable() der Fall wäre.
    await localEncryption.encryptAndStore(keyA, payloadA);
    await localEncryption.encryptAndStore(keyB, payloadB);
    idbSetMock.mockClear();

    idbSetMock.mockImplementationOnce(async () => {
      throw new Error('Speicher voll (simuliert)');
    });

    await expect(localEncryption.migrateFinanceKeys('decrypt')).rejects.toThrow(
      'Speicher voll (simuliert)',
    );

    for (const [key, original] of [
      [keyA, payloadA],
      [keyB, payloadB],
    ] as const) {
      const raw = await idbGet(key);
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!);
      if (parsed?.type === 'ausgabentracker.enc') {
        const decrypted = await localEncryption.decryptJson(parsed);
        expect(decrypted).toEqual(original);
      } else {
        expect(parsed).toEqual(original);
      }
    }

    await localEncryption.migrateFinanceKeys('decrypt');

    for (const [key, original] of [
      [keyA, payloadA],
      [keyB, payloadB],
    ] as const) {
      const raw = await idbGet(key);
      expect(JSON.parse(raw!)).toEqual(original);
    }
  });
});

describe('[REGRESSION] Lazy-Migration löscht den Altbestand erst nach Bestätigung (Audit 2026-09, WP7)', () => {
  it('[REGRESSION] sollte den localStorage-Altbestand erst löschen, wenn IndexedDB ihn nachweislich hält', async () => {
    // Bis hierher war der localStorage-Eintrag die EINZIGE Kopie. Schlug das
    // Schreiben nach IndexedDB fehl, löschte die nächste Zeile sie trotzdem —
    // Daten weg, ohne Fehlermeldung, ohne Lücke, nach der jemand sucht.
    const schluessel = LOCAL_FINANCE_KEYS.transactions;
    localStorage.setItem(schluessel, '[{"id":"nur-hier"}]');
    await clearLocalKvStore();

    const idbModul = await import('../idb-kv');
    const spy = vi
      .spyOn(idbModul, 'idbSet')
      .mockRejectedValueOnce(new Error('IndexedDB nicht schreibbar'));

    await localEncryption.loadAndMaybeDecrypt(schluessel).catch(() => null);
    // Ohne diese Zusicherung wäre der Test wertlos: Greift der Spy nicht,
    // schreibt der echte idbSet erfolgreich, die Bestätigung stimmt, und der
    // Altbestand wird korrekt gelöscht — grün, ohne den Fall je zu erreichen.
    expect(spy).toHaveBeenCalledWith(schluessel, '[{"id":"nur-hier"}]');
    spy.mockRestore();

    // Der Altbestand muss noch da sein — er war die einzige Kopie.
    expect(localStorage.getItem(schluessel)).toBe('[{"id":"nur-hier"}]');
  });
});
