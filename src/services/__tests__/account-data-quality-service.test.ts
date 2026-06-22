import { describe, it, expect } from "vitest";
import {
  deriveAccountDataQuality,
} from "../account-data-quality-service";
import type { Account } from "@/types";

const NOW = new Date("2026-06-22T12:00:00.000Z");

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "acc-1",
    user_id: "user-1",
    name: "Testkonto",
    type: "checking",
    currency: "EUR",
    color: "#000000",
    icon: "🏦",
    is_budget_pool_member: false,
    order_index: 0,
    ...overrides,
  };
}

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe("deriveAccountDataQuality", () => {
  it("treats a manual account (no GoCardless connection) as manual", () => {
    const account = makeAccount({ gocardless_account_id: null, opening_balance: 1000 });
    const result = deriveAccountDataQuality(account, NOW);

    expect(result.status).toBe("manual");
    expect(result.score).toBe(65);
    expect(result.issues.some((i) => i.code === "manual_account")).toBe(true);
    // Freundlicher, nicht negativer Text
    expect(result.issues[0].message).toContain("Manuell gepflegt");
  });

  it("flags a manual account without opening balance as info-level issue", () => {
    const account = makeAccount({ gocardless_account_id: null, opening_balance: null });
    const result = deriveAccountDataQuality(account, NOW);

    expect(result.status).toBe("manual");
    expect(result.issues.some((i) => i.code === "missing_opening_balance")).toBe(true);
  });

  it("rates a freshly synced live account as good", () => {
    const account = makeAccount({
      gocardless_account_id: "gc-1",
      sync_enabled: true,
      last_sync_at: daysAgo(1),
    });
    const result = deriveAccountDataQuality(account, NOW);

    expect(result.status).toBe("good");
    expect(result.score).toBe(95);
    expect(result.issues).toHaveLength(0);
  });

  it("warns when last sync is older than 7 days", () => {
    const account = makeAccount({
      gocardless_account_id: "gc-1",
      sync_enabled: true,
      last_sync_at: daysAgo(10),
    });
    const result = deriveAccountDataQuality(account, NOW);

    expect(result.status).toBe("warning");
    expect(result.score).toBe(60);
    const issue = result.issues.find((i) => i.code === "sync_stale");
    expect(issue).toBeDefined();
    expect(issue?.message).toContain("10 Tagen");
  });

  it("marks last sync older than 30 days as critical", () => {
    const account = makeAccount({
      gocardless_account_id: "gc-1",
      sync_enabled: true,
      last_sync_at: daysAgo(45),
    });
    const result = deriveAccountDataQuality(account, NOW);

    expect(result.status).toBe("critical");
    expect(result.score).toBe(30);
    expect(result.issues.some((i) => i.code === "sync_stale")).toBe(true);
  });

  it("marks a live account that was never synced as critical", () => {
    const account = makeAccount({
      gocardless_account_id: "gc-1",
      sync_enabled: true,
      last_sync_at: null,
    });
    const result = deriveAccountDataQuality(account, NOW);

    expect(result.status).toBe("critical");
    expect(result.score).toBe(20);
    expect(result.issues.some((i) => i.code === "never_synced")).toBe(true);
  });

  it("warns when sync is disabled", () => {
    const account = makeAccount({
      gocardless_account_id: "gc-1",
      sync_enabled: false,
      last_sync_at: daysAgo(1),
    });
    const result = deriveAccountDataQuality(account, NOW);

    expect(result.status).toBe("warning");
    expect(result.score).toBe(50);
    expect(result.issues.some((i) => i.code === "sync_disabled")).toBe(true);
  });

  it("exposes lastSyncAt and a human-readable label", () => {
    const lastSync = daysAgo(2);
    const account = makeAccount({
      gocardless_account_id: "gc-1",
      sync_enabled: true,
      last_sync_at: lastSync,
    });
    const result = deriveAccountDataQuality(account, NOW);

    expect(result.lastSyncAt).toBe(lastSync);
    expect(result.label).toBe("Sehr gut");
  });
});
