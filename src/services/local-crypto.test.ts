import { describe, it, expect, beforeEach } from "vitest";
import { localEncryption, estimatePasswordStrength } from "./local-crypto";

describe("estimatePasswordStrength", () => {
  it("bewertet leere und kurze Passwörter als schwach", () => {
    expect(estimatePasswordStrength("").label).toBe("schwach");
    expect(estimatePasswordStrength("abc").label).toBe("schwach");
  });

  it("bewertet ein langes, gemischtes Passwort als stark", () => {
    const res = estimatePasswordStrength("Korrekt-Pferd-7-Batterie!");
    expect(res.label).toBe("stark");
    expect(res.score).toBeGreaterThanOrEqual(70);
  });

  it("erkennt reine Wiederholung trotz Länge als schwach (Entropie statt Länge)", () => {
    expect(estimatePasswordStrength("aaaaaaaaaaaa").label).toBe("schwach");
  });

  it("wertet einfache Sequenzen ab", () => {
    expect(estimatePasswordStrength("abcdefghijkl").label).toBe("schwach");
  });

  it("wertet gängige Passwörter hart ab", () => {
    const res = estimatePasswordStrength("Passwort123!");
    expect(res.label).toBe("schwach");
    expect(res.score).toBeLessThanOrEqual(25);
  });

  it("bewertet ein mittellanges gemischtes Passwort als mittel", () => {
    expect(estimatePasswordStrength("Abcr8xKq").label).toBe("mittel");
  });
});

describe("localEncryption Roundtrip", () => {
  beforeEach(() => {
    localStorage.clear();
    localEncryption.lock();
  });

  it("verschlüsselt und entschlüsselt JSON verlustfrei", async () => {
    await localEncryption.enable("super-geheim-123");
    expect(localEncryption.isUnlocked()).toBe(true);

    const payload = { betrag: 1234.56, text: "Bäckerei Müller", liste: [1, 2, 3] };
    const envelope = await localEncryption.encryptJson(payload);
    const back = await localEncryption.decryptJson<typeof payload>(envelope);
    expect(back).toEqual(payload);
  });

  it("[REGRESSION] Roundtrip über die 8-KB-Base64-Blockgrenze (F-PERF-1)", async () => {
    await localEncryption.enable("super-geheim-123");
    // Payload deutlich größer als die 8-KB-Chunkgröße des blockweisen b64encode,
    // inkl. Nicht-ASCII, um korrektes Kodieren über Blockgrenzen zu prüfen.
    const large = {
      items: Array.from({ length: 5000 }, (_, i) => ({
        id: i,
        payee: `Händler Ä${i} — Straße`,
        amount: -i - 0.99,
      })),
    };
    const envelope = await localEncryption.encryptJson(large);
    const back = await localEncryption.decryptJson<typeof large>(envelope);
    expect(back).toEqual(large);
  });

  it("lehnt das Entsperren mit falschem Passwort ab", async () => {
    await localEncryption.enable("richtiges-passwort");
    localEncryption.lock();
    await expect(localEncryption.unlock("falsches-passwort")).rejects.toThrow("Falsches Passwort");
    expect(localEncryption.isUnlocked()).toBe(false);
  });

  it("entsperrt mit korrektem Passwort wieder", async () => {
    await localEncryption.enable("mein-passwort-xy");
    localEncryption.lock();
    expect(localEncryption.isUnlocked()).toBe(false);
    await localEncryption.unlock("mein-passwort-xy");
    expect(localEncryption.isUnlocked()).toBe(true);
  });
});
