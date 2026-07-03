import { describe, it, expect } from "vitest";
import { queryKeys, matchesKeyPrefix } from "@/lib/query-keys";

/**
 * Die Factory ersetzt handgeschriebene queryKey-Literale schrittweise. Sie MUSS
 * strukturell identisch zu den bestehenden Literalen bleiben, sonst brechen
 * Cache-Treffer und (schlimmer) Invalidierungen über Präfixe. Diese Tests
 * frieren die Äquivalenz ein.
 */
describe("queryKeys Factory", () => {
  describe("Deep-Equality zu den Alt-Literalen", () => {
    it("sollte transactions-Keys 1:1 abbilden", () => {
      expect(queryKeys.transactions.all).toEqual(["transactions"]);
      // Limit im Key (F-PERF-3): 5000er- und 1000er-Load dürfen nicht kollidieren.
      expect(queryKeys.transactions.list(5000)).toEqual(["transactions", 5000]);
      expect(queryKeys.transactions.list(1000)).toEqual(["transactions", 1000]);
      expect(queryKeys.transactions.contracts()).toEqual(["transactions", "contracts"]);
      expect(queryKeys.transactions.export()).toEqual(["transactions", "export"]);
      expect(queryKeys.transactions.lumpyRisk()).toEqual(["transactions", "lumpy-risk"]);
    });

    it("sollte die übrigen geteilten Keys 1:1 abbilden", () => {
      expect(queryKeys.accounts.all).toEqual(["accounts"]);
      expect(queryKeys.categories.all).toEqual(["categories"]);
      expect(queryKeys.coach.overview).toEqual(["coach-overview"]);
      expect(queryKeys.coach.hasData).toEqual(["has-finance-data"]);
      expect(queryKeys.financialHealth).toEqual(["financial-health"]);
      expect(queryKeys.milestones).toEqual(["milestones"]);
      expect(queryKeys.netWorth).toEqual(["net-worth"]);
      expect(queryKeys.contractDecisions).toEqual(["contract-decisions"]);
      expect(queryKeys.liveBalances).toEqual(["live-balances"]);
    });
  });

  describe("Präfix-Invalidierung bleibt äquivalent", () => {
    it("[REGRESSION] transactions.all matcht jede transactions.list(n)", () => {
      // react-query invalidiert per Präfix: ['transactions'] trifft ['transactions', 5000].
      expect(matchesKeyPrefix(queryKeys.transactions.all, queryKeys.transactions.list(5000))).toBe(true);
      expect(matchesKeyPrefix(queryKeys.transactions.all, queryKeys.transactions.list(1000))).toBe(true);
      expect(matchesKeyPrefix(queryKeys.transactions.all, queryKeys.transactions.contracts())).toBe(true);
    });
  });

  describe("Regression Protection", () => {
    it("[REGRESSION] transactions-chart ist ein EIGENER Top-Level-Key, nicht unter transactions", () => {
      // Falle: ['transactions-chart'] ist KEINE Untermenge von ['transactions'].
      // Die Präfix-Invalidierung von transactions erreicht ihn NICHT — deshalb
      // invalidieren gocardless-sync/useTransactionDetailEditing ihn separat.
      expect(queryKeys.transactionsChart).toEqual(["transactions-chart"]);
      expect(matchesKeyPrefix(queryKeys.transactions.all, queryKeys.transactionsChart)).toBe(false);
    });
  });
});
