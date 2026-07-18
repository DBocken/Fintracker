import { describe, expect, it, vi } from "vitest";
import { isSafeBankCallbackAuthLink } from "../BankCallbackPage";

vi.mock("@/services/gocardless-service", () => ({
  gocardlessService: {},
}));

vi.mock("@/services/bank-connection-service", () => ({
  bankConnectionService: {},
}));

vi.mock("@/services/account-service", () => ({
  getAccounts: vi.fn(),
  updateAccount: vi.fn(),
  createAccount: vi.fn(),
}));

vi.mock("@/services/gocardless-sync-service", () => ({
  syncAccountTransactions: vi.fn(),
}));

describe("BankCallbackPage Auth-Link-Härtung", () => {
  it("[SECURITY] sollte nur sichere GoCardless- oder App-Auth-Links erlauben", () => {
    expect(isSafeBankCallbackAuthLink("https://ob.gocardless.com/psd2/start/abc", "https://app.example")).toBe(true);
    expect(isSafeBankCallbackAuthLink("https://app.example/accounts", "https://app.example")).toBe(true);
  });

  it("[SECURITY] sollte unsichere Auth-Links blockieren", () => {
    expect(isSafeBankCallbackAuthLink("https://evil.example/psd2/start/abc", "https://app.example")).toBe(false);
    expect(isSafeBankCallbackAuthLink("javascript:alert(1)", "https://app.example")).toBe(false);
    expect(isSafeBankCallbackAuthLink("https://user:pass@ob.gocardless.com/start", "https://app.example")).toBe(false);
  });
});


describe("BankCallbackPage Log-Härtung", () => {
  it("[PRIVACY] sollte im BankCallback keine rohen Sync-Fehlerobjekte in console.warn/error loggen", async () => {
    const source = await import("node:fs/promises").then((fs) => fs.readFile(`${process.cwd()}/src/pages/BankCallbackPage.tsx`, "utf8"));

    expect(source).not.toContain("console.warn('[bank-callback] Sync mit Fehlern:', result.errors)");
    expect(source).not.toContain("console.error('Error importing transactions:', err)");
    expect(source).toContain("INITIAL_SYNC_PARTIAL_ERRORS");
    expect(source).toContain("INITIAL_SYNC_FAILED");
  });
});
