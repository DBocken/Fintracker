import { describe, it, expect, beforeEach } from "vitest";
import {
  buildDemoDataset,
  loadDemoData,
  removeDemoData,
  isDemoDataActive,
  isDemoRecord,
  DEMO_ID_PREFIX,
} from "./demo-data-service";
import { readLocalFinanceList, writeLocalFinanceList } from "./local-finance-store";
import { clearLocalKvStore } from "./idb-kv";
import { localEncryption } from "./local-crypto";
import type { Account, Debt, Transaction } from "@/types";

const NOW = new Date("2026-06-12T12:00:00Z");

describe("buildDemoDataset (Issue #39)", () => {
  it("erzeugt 2 Konten, 2 Schulden und 3 Monate Transaktionen", () => {
    const ds = buildDemoDataset(NOW);
    expect(ds.accounts).toHaveLength(2);
    expect(ds.debts).toHaveLength(2);

    const months = new Set(ds.transactions.map((t) => t.date.slice(0, 7)));
    expect(months.size).toBe(3);
    expect(months).toContain("2026-06");
    expect(months).toContain("2026-04");
  });

  it("kennzeichnet ausnahmslos alle Datensätze mit dem Demo-Präfix", () => {
    const ds = buildDemoDataset(NOW);
    for (const record of [...ds.accounts, ...ds.transactions, ...ds.debts]) {
      expect(record.id!.startsWith(DEMO_ID_PREFIX)).toBe(true);
      expect(isDemoRecord(record)).toBe(true);
    }
  });

  it("erzeugt keine Buchungen in der Zukunft", () => {
    const ds = buildDemoDataset(NOW);
    for (const t of ds.transactions) {
      expect(t.date <= "2026-06-12").toBe(true);
    }
  });

  it("enthält Einnahmen und kategorisierte Ausgaben (Sankey sofort gefüllt)", () => {
    const ds = buildDemoDataset(NOW);
    expect(ds.transactions.some((t) => t.amount > 0)).toBe(true);
    expect(ds.transactions.some((t) => t.amount < 0)).toBe(true);
    expect(ds.transactions.every((t) => !!t.category_id)).toBe(true);
  });

  it("ist deterministisch (gleicher Zeitpunkt ⇒ gleicher Datensatz)", () => {
    expect(buildDemoDataset(NOW)).toEqual(buildDemoDataset(NOW));
  });

  it("echte IDs (randomUUID) können nie als Demo erkannt werden", () => {
    expect(isDemoRecord({ id: crypto.randomUUID() })).toBe(false);
  });
});

describe("loadDemoData / removeDemoData (Issue #39)", () => {
  beforeEach(async () => {
    localStorage.clear();
    await clearLocalKvStore();
    localEncryption.lock();
  });

  it("lädt Demo-Daten und meldet sie als aktiv", async () => {
    expect(isDemoDataActive()).toBe(false);
    await loadDemoData(NOW);
    expect(isDemoDataActive()).toBe(true);

    const txs = await readLocalFinanceList<Transaction>("transactions");
    const accounts = await readLocalFinanceList<Account>("accounts");
    expect(txs.length).toBeGreaterThan(30);
    expect(accounts).toHaveLength(2);
  });

  it("vermischt sich nie mit echten Daten: Entfernen lässt echte Datensätze stehen", async () => {
    const realTx: Transaction = {
      id: crypto.randomUUID(),
      date: "2026-05-01",
      amount: -19.99,
      payee: "Echter Händler",
      description: "Echte Buchung",
      original_text: "",
      auto_mapped: false,
      confirmed: true,
    };
    const realAccount = { id: crypto.randomUUID(), name: "Echtes Konto" } as Account;
    const realDebt = { id: crypto.randomUUID(), name: "Echte Schuld" } as Debt;

    await writeLocalFinanceList("transactions", [realTx]);
    await writeLocalFinanceList("accounts", [realAccount]);
    await writeLocalFinanceList("debts", [realDebt]);

    await loadDemoData(NOW);
    await removeDemoData();

    expect(await readLocalFinanceList<Transaction>("transactions")).toEqual([realTx]);
    expect(await readLocalFinanceList<Account>("accounts")).toEqual([realAccount]);
    expect(await readLocalFinanceList<Debt>("debts")).toEqual([realDebt]);
    expect(isDemoDataActive()).toBe(false);
  });

  it("ist idempotent: zweimal laden erzeugt keine Duplikate", async () => {
    await loadDemoData(NOW);
    const first = await readLocalFinanceList<Transaction>("transactions");
    await loadDemoData(NOW);
    const second = await readLocalFinanceList<Transaction>("transactions");
    expect(second).toHaveLength(first.length);
  });
});
