import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

/**
 * [SECURITY] WP 3.1 (SEC-1, docs/qualitaet-2026-08/plan.md): der PBKDF2-Rewrap
 * eines Alt-Vaults (210.000 → ≥ 600.000 Iterationen) läuft über mehrere
 * IndexedDB-Schreibvorgänge — genau die Situation, die
 * `local-crypto.migration-crash.test.ts` für `migrateFinanceKeys()` bereits
 * absichert. Dieser File holt dasselbe für den Rewrap nach: ein Schreibfehler
 * mitten im Loop darf keinen Key unlesbar zurücklassen, weder direkt nach dem
 * Abbruch noch nach einem zwischenzeitlichen lock()/unlock().
 */

vi.mock('../idb-kv', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../idb-kv')>();
  return { ...actual, idbSet: vi.fn(actual.idbSet) };
});

import { idbSet, idbGet, clearLocalKvStore } from '../idb-kv';
import { localEncryption, PBKDF2_ITERATIONS } from '../local-crypto';
import { LOCAL_FINANCE_KEYS } from '../local-storage-keys';
import { seedLegacyVault, LEGACY_ITERATIONS } from './legacy-vault-test-helpers';

const idbSetMock = idbSet as unknown as Mock;
const PASSWORD = 'korrekt-pferd-batterie-klammer-2026';
// MUSS in `ENCRYPTED_STORAGE_KEYS` registriert sein — sonst greift
// `getSensitiveStorageKeys()` gar nicht zu und der Rewrap-Loop verarbeitet
// im Test gar keine Keys (siehe legacy-vault-test-helpers.ts).
const KEY_A = LOCAL_FINANCE_KEYS.transactions;
const KEY_B = LOCAL_FINANCE_KEYS.accounts;
const PAYLOAD_A = { id: 'a1', amount: -12 };
const PAYLOAD_B = { id: 'b1', amount: -34 };

async function readEnvelope(storageKey: string) {
  const raw = await idbGet(storageKey);
  expect(raw).toBeTruthy();
  return JSON.parse(raw!);
}

describe('[SECURITY] localEncryption.rewrapIfNeeded: Abbruch mitten in der PBKDF2-Umschlüsselung (SEC-1)', () => {
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

  it('[SECURITY] [REGRESSION] ein Schreibfehler nach dem ersten umgeschlüsselten Key lässt den Vault vollständig lesbar — Retry vervollständigt den Rewrap', async () => {
    await seedLegacyVault(PASSWORD, { [KEY_A]: PAYLOAD_A, [KEY_B]: PAYLOAD_B }, idbSet);
    idbSetMock.mockClear();

    // Erster Schreibvorgang im Rewrap-Loop gelingt (ein Key ist jetzt bereits
    // auf die neuen Parameter umgeschlüsselt), der zweite schlägt fehl —
    // genau der Zustand "manche Keys alt, manche neu".
    idbSetMock.mockImplementationOnce(async (...args: Parameters<typeof idbSet>) => {
      const { idbSet: realIdbSet } = await vi.importActual<typeof import('../idb-kv')>('../idb-kv');
      return realIdbSet(...args);
    });
    idbSetMock.mockImplementationOnce(async () => {
      throw new Error('Speicher voll (simuliert)');
    });

    // unlock() löst den Rewrap intern aus, fängt einen Fehlschlag darin aber
    // ab (§ Bericht) — das korrekte Passwort darf den Zugriff nicht verwehren.
    await expect(localEncryption.unlock(PASSWORD)).resolves.toBeUndefined();
    expect(localEncryption.isUnlocked()).toBe(true);

    // Direkt nach dem Abbruch: BEIDE Keys müssen weiterhin korrekt entschlüsseln,
    // unabhängig davon, ob sie schon auf die neue Generation umgeschlüsselt
    // wurden oder noch die alte tragen.
    const envelopeA = await readEnvelope(KEY_A);
    const envelopeB = await readEnvelope(KEY_B);
    expect(await localEncryption.decryptJson(envelopeA)).toEqual(PAYLOAD_A);
    expect(await localEncryption.decryptJson(envelopeB)).toEqual(PAYLOAD_B);

    // Der Rewrap ist noch nicht vollständig: mindestens einer der beiden trägt
    // noch die alte Iterationszahl.
    const iterationsBothMigrated =
      envelopeA.kdf.iterations === PBKDF2_ITERATIONS && envelopeB.kdf.iterations === PBKDF2_ITERATIONS;
    expect(iterationsBothMigrated).toBe(false);

    // Retry über einen ganz gewöhnlichen lock()/unlock()-Zyklus (kein Crash
    // mehr) — der Rewrap muss sich vollständig abschließen lassen und dabei
    // dieselben Zielparameter (Salt) wiederverwenden wie der abgebrochene
    // Versuch, sonst wäre der bereits umgeschlüsselte Key jetzt verwaist.
    localEncryption.lock();
    await localEncryption.unlock(PASSWORD);
    expect(localEncryption.isUnlocked()).toBe(true);

    const envelopeAAfter = await readEnvelope(KEY_A);
    const envelopeBAfter = await readEnvelope(KEY_B);
    expect(envelopeAAfter.kdf.iterations).toBe(PBKDF2_ITERATIONS);
    expect(envelopeBAfter.kdf.iterations).toBe(PBKDF2_ITERATIONS);
    expect(await localEncryption.decryptJson(envelopeAAfter)).toEqual(PAYLOAD_A);
    expect(await localEncryption.decryptJson(envelopeBAfter)).toEqual(PAYLOAD_B);

    const cfgAfter = localEncryption.getConfig();
    expect(cfgAfter?.kdf.iterations).toBe(PBKDF2_ITERATIONS);
    expect(cfgAfter?.kdf.iterations).not.toBe(LEGACY_ITERATIONS);
  });
});
