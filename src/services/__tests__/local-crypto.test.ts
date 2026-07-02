import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  estimatePasswordStrength,
  localEncryption,
  LocalEncryptionLockedError,
} from "../local-crypto";
import { idbGet, idbSet } from "../idb-kv";
import {
  LOCAL_FINANCE_KEYS,
  LOCAL_CATEGORIES_KEY,
  LOCAL_SETTINGS_KEY,
} from "../local-storage-keys";

describe("localEncryption", () => {
  beforeEach(() => {
    localStorage.clear();
    localEncryption.lock();
  });

  afterEach(() => {
    localStorage.clear();
    localEncryption.lock();
  });

  it("is disabled until enable() is called", () => {
    expect(localEncryption.isEnabled()).toBe(false);
    expect(localEncryption.isUnlocked()).toBe(false);
  });

  it("encrypts and decrypts JSON values round-trip after enable()", async () => {
    await localEncryption.enable("correct horse battery staple");
    expect(localEncryption.isEnabled()).toBe(true);
    expect(localEncryption.isUnlocked()).toBe(true);

    const payload = { transactions: [{ id: "t1", amount: -12.34 }] };
    const envelope = await localEncryption.encryptJson(payload);
    expect(envelope.type).toBe("ausgabentracker.enc");

    const decrypted = await localEncryption.decryptJson<typeof payload>(envelope);
    expect(decrypted).toEqual(payload);
  });

  it("unlocks with the correct password after a lock", async () => {
    await localEncryption.enable("correct horse battery staple");
    localEncryption.lock();
    expect(localEncryption.isUnlocked()).toBe(false);

    await localEncryption.unlock("correct horse battery staple");
    expect(localEncryption.isUnlocked()).toBe(true);
  });

  it("rejects an incorrect password with 'Falsches Passwort'", async () => {
    await localEncryption.enable("correct horse battery staple");
    localEncryption.lock();

    await expect(localEncryption.unlock("wrong password")).rejects.toThrow(
      "Falsches Passwort"
    );
    expect(localEncryption.isUnlocked()).toBe(false);
  });

  it("throws LocalEncryptionLockedError when locked but enabled", async () => {
    await localEncryption.enable("correct horse battery staple");
    localEncryption.lock();

    expect(() => localEncryption.requireUnlocked()).toThrow(LocalEncryptionLockedError);
    await expect(localEncryption.encryptJson({ a: 1 })).rejects.toThrow(
      LocalEncryptionLockedError
    );
  });

  it("encryptAndStore writes plaintext to IndexedDB when encryption is disabled", async () => {
    await localEncryption.encryptAndStore("test_key", { foo: "bar" });
    const raw = await idbGet("test_key");
    expect(raw).toBe(JSON.stringify({ foo: "bar" }));
  });

  it("encryptAndStore writes an encrypted envelope to IndexedDB when enabled and unlocked", async () => {
    await localEncryption.enable("correct horse battery staple");
    await localEncryption.encryptAndStore("test_key", { foo: "bar" });

    const raw = await idbGet("test_key");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.type).toBe("ausgabentracker.enc");

    const loaded = await localEncryption.loadAndMaybeDecrypt<{ foo: string }>("test_key");
    expect(loaded).toEqual({ foo: "bar" });
  });
});

describe("localEncryption enable/disable Migration (F-CRYPTO-1)", () => {
  const PW = "correct horse battery staple";

  beforeEach(async () => {
    localStorage.clear();
    localEncryption.lock();
  });
  afterEach(() => {
    localStorage.clear();
    localEncryption.lock();
  });

  // Repräsentative Auswahl inkl. Keys, die die alte 7er-Handliste NICHT kannte
  // (budgets, transactionAllocations, receivables, claims, merchantRules,
  // households, Kategorien, Settings) — genau diese gingen bei disable() verloren.
  const samples: Record<string, unknown> = {
    [LOCAL_FINANCE_KEYS.transactions]: [{ id: "t1", amount: -12.34 }],
    [LOCAL_FINANCE_KEYS.budgets]: [{ id: "b1", limit: 100 }],
    [LOCAL_FINANCE_KEYS.transactionAllocations]: [{ id: "a1", amount_minor: 50 }],
    [LOCAL_FINANCE_KEYS.receivables]: [{ id: "r1" }],
    [LOCAL_FINANCE_KEYS.claims]: [{ id: "c1" }],
    [LOCAL_FINANCE_KEYS.merchantRules]: [{ id: "m1" }],
    [LOCAL_FINANCE_KEYS.households]: [{ id: "h1" }],
    [LOCAL_CATEGORIES_KEY]: [{ id: "cat1", name: "Wohnen" }],
    [LOCAL_SETTINGS_KEY]: { locale: "de" },
  };

  it("[REGRESSION] disable() entschlüsselt ALLE registrierten Keys zurück (kein Datenverlust)", async () => {
    await localEncryption.enable(PW);

    for (const [key, value] of Object.entries(samples)) {
      await localEncryption.encryptAndStore(key, value);
      const raw = await idbGet(key);
      expect(JSON.parse(raw!).type).toBe("ausgabentracker.enc"); // liegt als Envelope
    }

    await localEncryption.disable(PW);
    expect(localEncryption.isEnabled()).toBe(false);

    for (const [key, value] of Object.entries(samples)) {
      const raw = await idbGet(key);
      const parsed = JSON.parse(raw!);
      expect(parsed.type).not.toBe("ausgabentracker.enc"); // kein Envelope-Rest
      expect(parsed).toEqual(value); // exakt der Ausgangswert
    }
  });

  it("[REGRESSION] wirft beim Lesen, wenn bei deaktivierter Verschlüsselung ein Envelope zurückbleibt", async () => {
    await localEncryption.enable(PW);
    const key = LOCAL_FINANCE_KEYS.budgets;
    await localEncryption.encryptAndStore(key, [{ id: "b1" }]);
    const envelopeRaw = await idbGet(key);

    // Verschlüsselung ohne Migration deaktivieren (simuliert inkonsistenten Rest).
    localEncryption.lock();
    localStorage.clear(); // entfernt Config -> gilt als deaktiviert
    await idbSet(key, envelopeRaw!); // Envelope bleibt in IDB

    await expect(localEncryption.loadAndMaybeDecrypt(key)).rejects.toThrow(/Migration unvollständig/);
  });
});

describe("estimatePasswordStrength", () => {
  it("classifies short, simple passwords as weak", () => {
    expect(estimatePasswordStrength("abc").label).toBe("schwach");
    expect(estimatePasswordStrength("").label).toBe("schwach");
  });

  it("classifies medium-length mixed passwords as mittel", () => {
    const result = estimatePasswordStrength("Abcdefgh1");
    expect(result.label).toBe("mittel");
  });

  it("classifies long passwords with mixed character classes as stark", () => {
    const result = estimatePasswordStrength("Correct-Horse-Battery-9");
    expect(result.label).toBe("stark");
  });
});
