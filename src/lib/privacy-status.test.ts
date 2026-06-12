import { describe, expect, it } from "vitest";

import { derivePrivacyStatus } from "./privacy-status";

describe("derivePrivacyStatus (Issue #41)", () => {
  it("anonymer Modus: keinerlei Server-Kontakt, nichts wird geteilt", () => {
    const status = derivePrivacyStatus("anonymous", false);
    expect(status.serverContact).toBe("none");
    expect(status.sharedWithServer).toEqual([]);
    expect(status.serverContactLabel).toContain("keiner");
  });

  it("anonymer Modus: Analytics-Opt-in ist ohne Login wirkungslos", () => {
    // analytics-consent-service setzt requireUserId voraus — ein Opt-in
    // kann anonym gar nicht existieren. Der Status darf das nie behaupten.
    const status = derivePrivacyStatus("anonymous", true);
    expect(status.serverContact).toBe("none");
    expect(status.sharedWithServer).toEqual([]);
  });

  it("eingeloggt ohne Analytics: Konto & Bank, niemals Finanzdaten", () => {
    const status = derivePrivacyStatus("free", false);
    expect(status.serverContact).toBe("account");
    expect(status.sharedWithServer.join(" ")).toContain("GoCardless");
    expect(status.sharedWithServer.join(" ")).not.toContain("Statistik");
  });

  it("eingeloggt mit Analytics-Opt-in: aggregierte Statistik wird ausgewiesen", () => {
    const status = derivePrivacyStatus("premium", true);
    expect(status.serverContact).toBe("account_and_analytics");
    expect(status.sharedWithServer.join(" ")).toContain("Aggregierte Statistik");
  });

  it("Finanzdaten verlassen das Gerät in keinem Tier", () => {
    for (const tier of ["anonymous", "free", "premium"] as const) {
      for (const optIn of [false, true]) {
        const status = derivePrivacyStatus(tier, optIn);
        expect(status.neverShared).toContain("Transaktionen");
        expect(status.neverShared).toContain("Schulden");
        expect(status.sharedWithServer.join(" ")).not.toMatch(/Transaktionen|Schulden|Briefe/);
      }
    }
  });
});
