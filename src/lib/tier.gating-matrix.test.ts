import { describe, it, expect } from "vitest";
import { NAV_GROUPS, ROUTE_GUARDS } from "@/components/layout/nav-config";
import { FEATURES, hasFeatureAccess, type FeatureKey, type Tier } from "./tier";

/**
 * Gating-Matrix (#53). Diese Datei bildet die Feature×Tier-Matrix explizit als
 * Test ab (Akzeptanzkriterium „Gating-Matrix als Test") und schützt die
 * Anti-Klarna-Linie aus Epic #24/#25: das komplette Schulden-Modul, CSV,
 * Basis-Dashboard, Export und Coach bleiben dauerhaft frei.
 */

// Erwartete Zugriffsmatrix je Feature. Bewusst redundant zur FEATURES-Map
// gehalten: eine zweite, unabhängige Quelle, sodass eine versehentliche
// Tier-Änderung hier sofort auffällt (Regression-Schutz).
const EXPECTED: Record<FeatureKey, Record<Tier, boolean>> = {
  bankSync: { anonymous: false, free: true, premium: true },
  basicContracts: { anonymous: false, free: true, premium: true },
  basicForecast: { anonymous: false, free: true, premium: true },
  advancedContracts: { anonymous: false, free: false, premium: true },
  advancedForecast: { anonymous: false, free: false, premium: true },
  premiumAnalytics: { anonymous: false, free: false, premium: true },
  simulation: { anonymous: false, free: false, premium: true },
  trading: { anonymous: false, free: false, premium: true },
  splitTransactions: { anonymous: false, free: false, premium: true },
  familyMode: { anonymous: false, free: false, premium: true },
  receiptLineItems: { anonymous: false, free: false, premium: true },
  budgetPremium: { anonymous: false, free: false, premium: true },
};

const TIERS: Tier[] = ["anonymous", "free", "premium"];

/**
 * Kern-Features, die laut Produkt-Beschluss NIEMALS hinter der Paywall stehen
 * dürfen: komplettes Schulden-Modul (Coach/Schulden/Nettovermögen/Liquidität/
 * Budgets/Meilensteine), Basis-Dashboard, Buchungen sowie Datenportabilität
 * (CSV-Import, Export – DSGVO).
 */
const NEVER_GATED_PATHS = [
  "/coach",
  "/debts",
  "/net-worth",
  "/liquidity",
  "/budgets",
  "/milestones",
  "/dashboard",
  "/transactions",
  "/accounts",
  "/csv",
  "/export",
];

describe("Gating-Matrix (#53)", () => {
  describe("Feature × Tier", () => {
    it("sollte für jedes Feature den erwarteten Zugriff je Tier liefern", () => {
      for (const feature of Object.keys(EXPECTED) as FeatureKey[]) {
        for (const tier of TIERS) {
          expect(
            hasFeatureAccess(tier, feature),
            `${tier} → ${feature} sollte ${EXPECTED[feature][tier]} sein`,
          ).toBe(EXPECTED[feature][tier]);
        }
      }
    });

    it("[REGRESSION] sollte jedes FEATURES-Feature in der Matrix abbilden (Exhaustivität)", () => {
      // Neues gegatetes Feature ohne Matrix-Eintrag = bewusste Entscheidung erzwingen.
      expect(Object.keys(EXPECTED).sort()).toEqual(Object.keys(FEATURES).sort());
    });
  });

  describe("Kein Kern-/Schulden-Feature hinter der Paywall", () => {
    it("sollte keinen Kern-Pfad in der Navigation als Premium markieren", () => {
      const gatedPaths = NAV_GROUPS.flatMap((g) => g.items)
        .filter((item) => item.requiredTier === "premium")
        .map((item) => item.path);
      for (const path of NEVER_GATED_PATHS) {
        expect(gatedPaths, `${path} darf nicht premium-gegatet sein`).not.toContain(path);
      }
    });

    it("sollte keinen Kern-Pfad über einen Premium-Route-Guard sperren", () => {
      for (const path of NEVER_GATED_PATHS) {
        const feature = ROUTE_GUARDS[path];
        if (feature) {
          expect(FEATURES[feature], `${path} → ${feature} darf nicht premium sein`).not.toBe("premium");
        }
      }
    });

    it("sollte Export & CSV frei halten (Datenportabilität, DSGVO)", () => {
      // Free-Nutzer verliert beim Premium-Ende keine Daten, nur Ansichten:
      // Datenwege (Export/CSV) sind an keinen Premium-Guard gebunden.
      for (const path of ["/export", "/csv"]) {
        expect(ROUTE_GUARDS[path]).toBeUndefined();
      }
    });
  });
});
