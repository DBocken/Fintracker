import { describe, it, expect, beforeEach } from "vitest";
import { localEncryption } from "../local-crypto";
import { connectEtoroAccount } from "../etoro-service";
import { redactPortfolioSecrets } from "../backup-service";
import type { BackupData } from "../backup-service";

/**
 * T1.10 / F-DEBT-1: eToro-Zugangsdaten (apiKey/userKey) sind sensibler als die
 * übrigen Finanzdaten und dürfen weder unverschlüsselt in IndexedDB liegen noch
 * in einen Klartext-Export gelangen.
 */
describe("[SECURITY] eToro-Credentials (T1.10)", () => {
  beforeEach(() => {
    localStorage.clear();
    localEncryption.lock();
  });

  it("verweigert das Verbinden, solange die lokale Verschlüsselung nicht entsperrt ist", async () => {
    expect(localEncryption.isUnlocked()).toBe(false);
    await expect(connectEtoroAccount("nutzer", "api-key", "user-key")).rejects.toThrow(
      /Verschlüsselung/i,
    );
  });

  it("redactPortfolioSecrets entfernt apiKey/userKey aus dem unverschlüsselten Export", () => {
    const data = {
      version: "1.1.0",
      timestamp: "2026-07-02T00:00:00.000Z",
      userId: "u1",
      data: { transactions: [], categories: [], accounts: [], settings: {} as never },
      collections: {
        portfolios: [
          {
            id: "p1",
            provider_config: { username: "nutzer", apiKey: "SECRET_API", userKey: "SECRET_USER", connected_at: "2026-07-01" },
          },
        ],
      },
    } as unknown as BackupData;

    const out = redactPortfolioSecrets(data);
    const cfg = (out.collections!.portfolios[0] as { provider_config: Record<string, unknown> }).provider_config;

    expect(cfg.apiKey).toBeUndefined();
    expect(cfg.userKey).toBeUndefined();
    // Nicht-geheime Felder bleiben erhalten (Portfolio bleibt sinnvoll).
    expect(cfg.username).toBe("nutzer");
    expect(cfg.connected_at).toBe("2026-07-01");
    // Kein Geheimnis mehr im serialisierten Export.
    expect(JSON.stringify(out)).not.toContain("SECRET_API");
    expect(JSON.stringify(out)).not.toContain("SECRET_USER");
  });

  it("redactPortfolioSecrets ist ein No-op ohne Portfolios", () => {
    const data = {
      version: "1.1.0",
      timestamp: "t",
      userId: "u1",
      data: { transactions: [], categories: [], accounts: [], settings: {} as never },
    } as unknown as BackupData;
    expect(redactPortfolioSecrets(data)).toBe(data);
  });
});
