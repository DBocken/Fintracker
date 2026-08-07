import { describe, expect, it } from "vitest";
import { normalizeMerchantName } from "../merchant-normalization";

describe("normalizeMerchantName", () => {
  it("returns empty string for null/undefined/empty input", () => {
    expect(normalizeMerchantName(null)).toBe("");
    expect(normalizeMerchantName(undefined)).toBe("");
    expect(normalizeMerchantName("")).toBe("");
  });

  it("lowercases the input", () => {
    expect(normalizeMerchantName("REWE")).toBe("rewe");
  });

  it("strips legal suffixes", () => {
    expect(normalizeMerchantName("REWE Markt GmbH")).toBe("rewe markt");
    expect(normalizeMerchantName("Beispiel AG")).toBe("beispiel");
    expect(normalizeMerchantName("Muster GmbH & Co. KG")).toBe("muster");
  });

  it("strips payment processor / reference noise", () => {
    expect(normalizeMerchantName("Kartenzahlung REWE SAGT DANKE")).toBe("rewe sagt danke");
    expect(normalizeMerchantName("SEPA Lastschrift Netflix")).toBe("netflix");
  });

  it("strips reference numbers, store numbers and dates", () => {
    expect(normalizeMerchantName("PAYMENT 847261 REWE SAGT DANKE 3847 DE//MUENCHEN/2024-01-05")).toBe(
      "rewe sagt danke de muenchen"
    );
  });

  it("collapses whitespace", () => {
    expect(normalizeMerchantName("  Aldi   Sued  ")).toBe("aldi sued");
  });
});
