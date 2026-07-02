import { describe, it, expect, beforeEach } from "vitest";
import type { Transaction } from "../../types";
import { localEncryption } from "../local-crypto";
import { saveTransactions, getTransactions, restoreCategorization } from "../transaction-service";

/**
 * T1.17 / F-UX-1: Der Undo nach einer Sammel-Neukategorisierung war eine
 * Attrappe. restoreCategorization setzt die gesicherten Vorwerte exakt zurück
 * (Invariante 12).
 */
describe("[INTEGRITY] restoreCategorization (T1.17)", () => {
  beforeEach(() => {
    localStorage.clear();
    localEncryption.lock();
  });

  it("setzt category_id und auto_mapped auf die gesicherten Vorwerte zurück", async () => {
    const tx: Transaction = {
      id: "tx-undo-1", account_id: "a1", date: "2026-01-10", amount: -10,
      payee: "REWE", description: "", original_text: "",
      category_id: "cat-a", auto_mapped: true, confirmed: false,
    } as Transaction;
    await saveTransactions([tx]);

    // Sammeländerung simulieren: Buchung auf eine andere Kategorie setzen.
    await restoreCategorization([{ id: "tx-undo-1", category_id: "cat-b", auto_mapped: false }]);
    let stored = (await getTransactions(100)).find((t) => t.id === "tx-undo-1");
    expect(stored?.category_id).toBe("cat-b");
    expect(stored?.auto_mapped).toBe(false);

    // Undo: exakt die Vorwerte wiederherstellen.
    const restored = await restoreCategorization([{ id: "tx-undo-1", category_id: "cat-a", auto_mapped: true }]);
    expect(restored).toBe(1);
    stored = (await getTransactions(100)).find((t) => t.id === "tx-undo-1");
    expect(stored?.category_id).toBe("cat-a");
    expect(stored?.auto_mapped).toBe(true);
  });

  it("kann category_id auf null zurücksetzen (vorher unkategorisiert)", async () => {
    const tx: Transaction = {
      id: "tx-undo-2", account_id: "a1", date: "2026-01-10", amount: -5,
      payee: "Kiosk", description: "", original_text: "",
      category_id: "cat-x", auto_mapped: true, confirmed: false,
    } as Transaction;
    await saveTransactions([tx]);

    await restoreCategorization([{ id: "tx-undo-2", category_id: null, auto_mapped: false }]);
    const stored = (await getTransactions(100)).find((t) => t.id === "tx-undo-2");
    expect(stored?.category_id).toBeNull();
    expect(stored?.auto_mapped).toBe(false);
  });
});
