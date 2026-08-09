import { describe, it, expect, beforeEach } from "vitest";
import {
  buildDemoDataset,
  loadDemoData,
  removeDemoData,
  isDemoDataActive,
  isDemoRecord,
  DEMO_ID_PREFIX,
} from "../demo-data-service";
import { readLocalFinanceList, writeLocalFinanceList } from "../local-finance-store";
import { getTransactions, saveTransactions } from "../transaction-service";
import { clearLocalKvStore } from "../idb-kv";
import { localEncryption } from "../local-crypto";
import { buildDefaultCategories } from "../../data/merchant-keywords";
import type { Account, Debt, Transaction } from "@/types";
import { asTransactionId } from "@/lib/ids";

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

  it("[REGRESSION] verweist ausschließlich auf existierende Kategorie-IDs der Default-Taxonomie", () => {
    // Zuvor zeigten die Streaming-/Versicherungs-Buchungen auf nicht
    // existierende IDs (`local-cat-abos`/`local-cat-versicherung`) und landeten
    // dadurch überall (Dashboard, Finanzstadt) in „Unkategorisiert" statt in
    // ihrer echten Kategorie. Jede Demo-Kategorie-ID MUSS in der Taxonomie
    // existieren, sonst ist die Buchung effektiv unkategorisiert.
    const validIds = new Set(buildDefaultCategories().map((c) => c.id));
    const ds = buildDemoDataset(NOW);
    const usedIds = new Set(ds.transactions.map((t) => t.category_id).filter((id): id is string => !!id));
    const unknown = [...usedIds].filter((id) => !validIds.has(id));
    expect(unknown).toEqual([]);
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

    // WP 4.1c (PERF-1): Buchungen laufen über dieselbe Fassade wie jeder
    // andere Aufrufer (`getTransactions`), nicht mehr über den generischen
    // `readLocalFinanceList('transactions')` — der läse nach einer Migration
    // am v3-Blob vorbei (`transaction-storage-service.ts`, `hasLegacyV3Blob`).
    const txs = await getTransactions(1000);
    const accounts = await readLocalFinanceList<Account>("accounts");
    expect(txs.length).toBeGreaterThan(30);
    expect(accounts).toHaveLength(2);
  });

  it("vermischt sich nie mit echten Daten: Entfernen lässt echte Datensätze stehen", async () => {
    const realTx: Transaction = {
      id: asTransactionId(crypto.randomUUID()),
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

    // WP 4.1c: über dieselbe Fassade wie `demo-data-service.ts` selbst jetzt
    // schreibt (`saveTransactions`) — normalisiert/defaultet Felder (Invariante
    // 5 u.a.), deshalb wird unten gegen den ZURÜCKGEGEBENEN (normalisierten)
    // Stand verglichen, nicht gegen das rohe Test-Literal.
    const [savedRealTx] = await saveTransactions([realTx]);
    await writeLocalFinanceList("accounts", [realAccount]);
    await writeLocalFinanceList("debts", [realDebt]);

    await loadDemoData(NOW);
    await removeDemoData();

    expect(await getTransactions(1000)).toEqual([savedRealTx]);
    expect(await readLocalFinanceList<Account>("accounts")).toEqual([realAccount]);
    expect(await readLocalFinanceList<Debt>("debts")).toEqual([realDebt]);
    expect(isDemoDataActive()).toBe(false);
  });

  it("ist idempotent: zweimal laden erzeugt keine Duplikate", async () => {
    await loadDemoData(NOW);
    const first = await getTransactions(1000);
    await loadDemoData(NOW);
    const second = await getTransactions(1000);
    expect(second).toHaveLength(first.length);
  });
});
