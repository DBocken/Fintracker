import { describe, it, expect, beforeEach } from "vitest";
import {
  validateAllocations,
  setAllocations,
  clearAllocations,
  getAllocations,
  getAllocationsForTransaction,
  getAllocationMap,
  deleteAllocationsForTransactions,
  hasManualAllocations,
  AllocationInvariantError,
  type AllocationInput,
} from "../transaction-allocation-service";
import { writeLocalFinanceList } from "../local-finance-store";
import type { Transaction, TransactionAllocation } from "@/types";
import { asTransactionId } from "@/lib/ids";

const tx = (amount: number, id = "tx-1"): Pick<Transaction, "id" | "amount"> => ({ id: asTransactionId(id), amount });

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

  it("[REGRESSION] lehnt gemischt-signierte Aufteilungen ab (F-MONEY-5)", () => {
    // Ausgabe -10 €: 6 € (positiv) + -16 € summieren zwar auf -10, führen in den
    // Analysen (Math.abs) aber zu 6 + 16 = 22 € Kategorieausgaben.
    const allocs: TransactionAllocation[] = [
      { id: "a1", transaction_id: "tx-1", amount_minor: 600, category_id: "c1", source: "manual" },
      { id: "a2", transaction_id: "tx-1", amount_minor: -1600, category_id: "c2", source: "manual" },
    ];
    expect(validateAllocations(tx(-10), allocs).error).toBe("sign_mismatch");
  });

  it("erlaubt gleichsignierte Aufteilungen inkl. Null-Anteil", () => {
    const allocs: TransactionAllocation[] = [
      { id: "a1", transaction_id: "tx-1", amount_minor: -600, category_id: "c1", source: "manual" },
      { id: "a2", transaction_id: "tx-1", amount_minor: -400, category_id: "c2", source: "manual" },
      { id: "a3", transaction_id: "tx-1", amount_minor: 0, category_id: "c3", source: "manual" },
    ];
    expect(validateAllocations(tx(-10), allocs).valid).toBe(true);
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

describe("[INTEGRITY] Aufteilungs-Persistenz — Grenzfälle", () => {
  it("verweigert das Aufteilen einer Buchung ohne ID, statt einen verwaisten Satz zu schreiben", async () => {
    // Ohne Transaktions-ID trüge jede Aufteilung `transaction_id: undefined`:
    // Der Betrag hinge an keiner Buchung und wäre weder auffindbar noch
    // löschbar, würde in der Kategorie-Auswertung aber mitzählen.
    await expect(
      setAllocations({ id: undefined, amount: -12.5 } as Pick<Transaction, "id" | "amount">, [alloc(-1250, "c1")]),
    ).rejects.toThrow();
    expect(await getAllocations()).toHaveLength(0);
  });

  it("legt eine Aufteilung ohne angegebene Herkunft als manuell an", async () => {
    // Die Herkunft entscheidet, ob die automatische Recategorisierung den Satz
    // überschreiben darf. Ein fehlendes Feld muss deshalb auf die schützende
    // Seite fallen (`manual`), nicht auf die überschreibbare.
    await setAllocations(tx(-12.5), [{ amount_minor: -1250, category_id: "c1" }]);
    const stored = await getAllocationsForTransaction("tx-1");
    expect(stored[0].source).toBe("manual");
    expect(hasManualAllocations("tx-1", await getAllocationMap())).toBe(true);
  });

  it("lässt eine leere Löschliste den Bestand unberührt", async () => {
    await setAllocations(tx(-12.5), [alloc(-1250, "c1")]);
    await deleteAllocationsForTransactions([]);
    expect(await getAllocationsForTransaction("tx-1")).toHaveLength(1);
  });

  it("meldet für eine Transaktion ohne Aufteilungen keine manuelle Aufteilung", () => {
    expect(hasManualAllocations("gibtsnicht", new Map())).toBe(false);
  });

  it("prüft bei einer Nullbuchung nur die Summe — ein Vorzeichen gibt es dort nicht", () => {
    // Die Vorzeichen-Invariante (F-MONEY-5) braucht ein Vorzeichen der
    // Originalbuchung. Bei 0,00 € (Storno, Nullzeile aus dem Import) hat sie
    // keines; dann entscheidet allein die Summe. Eine Aufteilung 5 € / -5 €
    // ist dort zulässig, eine Summe ≠ 0 nicht.
    const nullbuchung = { id: asTransactionId("tx-null"), amount: 0 };
    const gegenlaeufig: TransactionAllocation[] = [
      { id: "a", transaction_id: "tx-null", amount_minor: 500, category_id: "c1", source: "manual" },
      { id: "b", transaction_id: "tx-null", amount_minor: -500, category_id: "c2", source: "manual" },
    ];
    expect(validateAllocations(nullbuchung, gegenlaeufig).valid).toBe(true);

    const schief: TransactionAllocation[] = [
      { id: "a", transaction_id: "tx-null", amount_minor: 500, category_id: "c1", source: "manual" },
    ];
    expect(validateAllocations(nullbuchung, schief).error).toBe("sum_mismatch");
  });
});
