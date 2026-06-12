import { describe, it, expect, beforeEach } from "vitest";
import { isForeignBackup, type BackupData, type EncryptedBackupFileV1 } from "./backup-service";
import { localEncryption } from "./local-crypto";

function sampleBackup(userId = "user-1"): BackupData {
  return {
    version: "1.0.0",
    timestamp: "2026-06-12T10:00:00.000Z",
    userId,
    data: {
      transactions: [{ id: "t1", amount: -12.34, payee: "REWE" }],
      categories: [],
      accounts: [{ id: "a1", name: "Giro" } as never],
      settings: { retention_months: 36 } as never,
    },
  };
}

describe("isForeignBackup", () => {
  it("erkennt fremde Backups", () => {
    expect(isForeignBackup(sampleBackup("other"), "me")).toBe(true);
  });

  it("akzeptiert eigene Backups", () => {
    expect(isForeignBackup(sampleBackup("me"), "me")).toBe(false);
  });
});

describe("verschlüsseltes Backup Roundtrip (Issue #30)", () => {
  beforeEach(() => {
    localStorage.clear();
    localEncryption.lock();
  });

  it("Backup → verschlüsseln → entschlüsseln liefert identische Daten", async () => {
    const backup = sampleBackup();

    // So verschlüsselt der BackupService die Datei (AES-GCM-Envelope).
    await localEncryption.enable("umzugs-passwort-2026");
    const payload = await localEncryption.encryptJson(backup);

    const file: EncryptedBackupFileV1 = {
      type: "ausgabentracker.backup.enc",
      v: 1,
      timestamp: backup.timestamp,
      payload,
    };

    // Container ist verschlüsselt – kein Klartext der Beträge enthalten.
    expect(JSON.stringify(file)).not.toContain("REWE");

    const restored = await localEncryption.decryptJson<BackupData>(file.payload);
    expect(restored).toEqual(backup);
  });

  it("Standalone-Roundtrip (Issue #36): verschlüsselt ohne lokale Konfiguration anzufassen", async () => {
    const { encryptJsonWithPassword, decryptJsonWithPassword } = await import("./local-crypto");
    const backup = sampleBackup();

    const payload = await encryptJsonWithPassword(backup, "umzugs-passwort-2026");

    // Lokale At-Rest-Verschlüsselung bleibt unberührt
    expect(localEncryption.isEnabled()).toBe(false);
    expect(JSON.stringify(payload)).not.toContain("REWE");

    const restored = await decryptJsonWithPassword<BackupData>(payload, "umzugs-passwort-2026");
    expect(restored).toEqual(backup);

    await expect(decryptJsonWithPassword(payload, "falsch")).rejects.toThrow("Falsches Passwort");
  });
});
