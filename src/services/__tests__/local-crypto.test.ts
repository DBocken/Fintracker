import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  estimatePasswordStrength,
  localEncryption,
  LocalEncryptionLockedError,
} from "../local-crypto";

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

  it("encryptAndStore writes plaintext when encryption is disabled", async () => {
    await localEncryption.encryptAndStore("test_key", { foo: "bar" });
    const raw = localStorage.getItem("test_key");
    expect(raw).toBe(JSON.stringify({ foo: "bar" }));
  });

  it("encryptAndStore writes an encrypted envelope when enabled and unlocked", async () => {
    await localEncryption.enable("correct horse battery staple");
    await localEncryption.encryptAndStore("test_key", { foo: "bar" });

    const raw = localStorage.getItem("test_key");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.type).toBe("ausgabentracker.enc");

    const loaded = await localEncryption.loadAndMaybeDecrypt<{ foo: string }>("test_key");
    expect(loaded).toEqual({ foo: "bar" });
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
