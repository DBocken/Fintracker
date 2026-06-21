import { describe, it, expect, beforeEach } from "vitest";
import {
  validateAllocations,
  setAllocations,
  clearAllocations,
  getAllocationsForTransaction,
  getAllocationMap,
  deleteAllocationsForTransactions,
  hasManualAllocations,
  AllocationInvariantError,
  type AllocationInput,
} from "../transaction-allocation-service";
import { writeLocalFinanceList } from "../local-finance-store";
import type { Transaction, TransactionAllocation } from "@/types";

const tx = (amount: number, id = "tx-1"): Pick<Transaction, "id" | "amount"> => ({ id, amount });

const alloc = (amount_minor: number, category_id: string | null, source: AllocationInput["source"] = "manual"): AllocationInput => ({
  amount_minor,
  category_id,
  source,
});

beforeEach(async () => {
  await writeLocalFinanceList("transactionAllocations", []);
});

describe("[INTEGRITY] validateAllocations", () => {
  it("akzeptiert ein leeres Array als gültig (unsplit)", () => {
    const r = validateAllocations(tx(-12.5), []);
    expect(r.valid).toBe(true);
    expect(r.deltaMinor).toBe(0);
  });

  it("akzeptiert eine exakt passende Summe", () => {
    const allocs: TransactionAllocation[] = [
      { id: "a", transaction_id: "tx-1", amount_minor: -1000, category_id: "c1", source: "manual" },
      { id: "b", transaction_id: "tx-1", amount_minor: -250, category_id: "c2", source: "manual" },
    ];
    const r = validateAllocations(tx(-12.5), allocs);
    expect(r.valid).toBe(true);
  });

  it("akzeptiert exakte Cent-Aufteilung 3.33 + 3.33 + 3.34 = 10.00", () => {
    const allocs: TransactionAllocation[] = [
      { id: "a", transaction_id: "tx-1", amount_minor: -333, category_id: "c1", source: "manual" },
      { id: "b", transaction_id: "tx-1", amount_minor: -333, category_id: "c2", source: "manual" },
      { id: "c", transaction_id: "tx-1", amount_minor: -334, category_id: "c3", source: "manual" },
    ];
    expect(validateAllocations(tx(-10), allocs).valid).toBe(true);
  });

  it("lehnt eine Summenabweichung ab", () => {
    const allocs: TransactionAllocation[] = [
      { id: "a", transaction_id: "tx-1", amount_minor: -333, category_id: "c1", source: "manual" },
      { id: "b", transaction_id: "tx-1", amount_minor: -333, category_id: "c2", source: "manual" },
      { id: "c", transaction_id: "tx-1", amount_minor: -333, category_id: "c3", source: "manual" },
    ];
    const r = validateAllocations(tx(-10), allocs);
    expect(r.valid).toBe(false);
    expect(r.error).toBe("sum_mismatch");
  });

  it("lehnt fremde transaction_id ab", () => {
    const allocs: TransactionAllocation[] = [
      { id: "a", transaction_id: "tx-OTHER", amount_minor: -1250, category_id: "c1", source: "manual" },
    ];
    expect(validateAllocations(tx(-12.5), allocs).error).toBe("orphan_transaction");
  });

  it("lehnt doppelte IDs ab", () => {
    const allocs: TransactionAllocation[] = [
      { id: "dup", transaction_id: "tx-1", amount_minor: -625, category_id: "c1", source: "manual" },
      { id: "dup", transaction_id: "tx-1", amount_minor: -625, category_id: "c2", source: "manual" },
    ];
    expect(validateAllocations(tx(-12.5), allocs).error).toBe("duplicate_id");
  });
});

describe("transaction-allocation-service (local)", () => {
  it("speichert einen gültigen Aufteilungssatz", async () => {
    await setAllocations(tx(-12.5), [alloc(-1000, "c1"), alloc(-250, "c2")]);
    const stored = await getAllocationsForTransaction("tx-1");
    expect(stored).toHaveLength(2);
    expect(stored.reduce((s, a) => s + a.amount_minor, 0)).toBe(-1250);
  });

  it("persistiert nichts, wenn die Summe nicht stimmt", async () => {
    await expect(setAllocations(tx(-12.5), [alloc(-1000, "c1"), alloc(-300, "c2")])).rejects.toBeInstanceOf(
      AllocationInvariantError,
    );
    expect(await getAllocationsForTransaction("tx-1")).toHaveLength(0);
  });

  it("ersetzt bestehende Aufteilungen (replace-all)", async () => {
    await setAllocations(tx(-12.5), [alloc(-1250, "c1")]);
    await setAllocations(tx(-12.5), [alloc(-1000, "c2"), alloc(-250, "c3")]);
    const stored = await getAllocationsForTransaction("tx-1");
    expect(stored).toHaveLength(2);
    expect(stored.map((a) => a.category_id).sort()).toEqual(["c2", "c3"]);
  });

  it("clearAllocations entfernt die Aufteilung", async () => {
    await setAllocations(tx(-12.5), [alloc(-1250, "c1")]);
    await clearAllocations("tx-1");
    expect(await getAllocationsForTransaction("tx-1")).toHaveLength(0);
  });

  it("teilt negative Beträge korrekt auf", async () => {
    await setAllocations(tx(-40), [alloc(-2000, "c1"), alloc(-2000, "c2")]);
    expect((await getAllocationsForTransaction("tx-1")).reduce((s, a) => s + a.amount_minor, 0)).toBe(-4000);
  });

  it("löscht Aufteilungen nur für die angegebene Transaktion (Cascade)", async () => {
    await setAllocations(tx(-12.5, "tx-1"), [alloc(-1250, "c1")]);
    await setAllocations(tx(-8, "tx-2"), [alloc(-800, "c2")]);
    await deleteAllocationsForTransactions(["tx-1"]);
    expect(await getAllocationsForTransaction("tx-1")).toHaveLength(0);
    expect(await getAllocationsForTransaction("tx-2")).toHaveLength(1);
  });

  it("hasManualAllocations erkennt manuelle Einträge", async () => {
    await setAllocations(tx(-12.5), [alloc(-1250, "c1", "receipt")]);
    const map1 = await getAllocationMap();
    expect(hasManualAllocations("tx-1", map1)).toBe(false);

    await setAllocations(tx(-12.5), [alloc(-1250, "c1", "manual")]);
    const map2 = await getAllocationMap();
    expect(hasManualAllocations("tx-1", map2)).toBe(true);
  });
});
