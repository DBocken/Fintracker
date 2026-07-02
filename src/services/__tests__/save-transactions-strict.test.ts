import { describe, it, expect, beforeEach } from "vitest";
import type { Transaction } from "../../types";
import { localEncryption } from "../local-crypto";
import { saveTransactions, getTransactions } from "../transaction-service";

/**
 * F-MONEY-4 / T1.3 (VE-3): saveTransactions ist die fachliche Grenze — ungültige
 * Beträge/Daten werden abgelehnt statt still als 0 € bzw. „heute" gespeichert
 * (Invariante 18). Die strikte Prüfung galt zuvor nur im CSV-Pfad; Bank-,
 * Restore- und programmatische Pfade konnten stille Nullwerte erzeugen.
 */
describe("[INTEGRITY] saveTransactions strikte Validierung (F-MONEY-4)", () => {
  beforeEach(() => {
    localStorage.clear();
    localEncryption.lock();
  });

  const base = {
    account_id: "a1",
    payee: "REWE",
    description: "",
    original_text: "",
    auto_mapped: false,
    confirmed: false,
  };

  it("[REGRESSION] wirft bei unparsebarem Datum statt still 'heute' einzusetzen", async () => {
    const tx = { ...base, id: "tx-bad-date", date: "kein-datum", amount: -10 } as Transaction;
    await expect(saveTransactions([tx])).rejects.toThrow(/Ungültiges Buchungsdatum/);
    // Nichts wurde persistiert.
    expect(await getTransactions(10)).toHaveLength(0);
  });

  it("[REGRESSION] wirft bei leerem Datum", async () => {
    const tx = { ...base, id: "tx-no-date", date: "", amount: -10 } as Transaction;
    await expect(saveTransactions([tx])).rejects.toThrow(/Ungültiges Buchungsdatum/);
  });

  it("[REGRESSION] wirft bei unparsebarem Betrag statt still 0 zu speichern", async () => {
    const tx = { ...base, id: "tx-bad-amount", date: "2026-01-15", amount: "abc" as unknown as number } as Transaction;
    await expect(saveTransactions([tx])).rejects.toThrow(/Ungültiger Betrag/);
    expect(await getTransactions(10)).toHaveLength(0);
  });

  it("akzeptiert gültige Buchungen unverändert (inkl. deutscher Formate)", async () => {
    const txs = [
      { ...base, id: "tx-ok-1", date: "15.01.2026", amount: "1.234,56" as unknown as number },
      { ...base, id: "tx-ok-2", date: "2026-02-01", amount: -12.5 },
    ] as Transaction[];
    const saved = await saveTransactions(txs);
    expect(saved).toHaveLength(2);
    expect(saved[0].date).toBe("2026-01-15");
    expect(saved[0].amount).toBe(1234.56);
    expect(saved[1].amount).toBe(-12.5);
  });

  it("Betrag 0 bleibt zulässig, wenn er EXPLIZIT angegeben ist", async () => {
    // 0 ist ein gültiger Wert (z. B. Storno) — nur unparsebare Eingaben werfen.
    const tx = { ...base, id: "tx-zero", date: "2026-01-15", amount: 0 } as Transaction;
    const saved = await saveTransactions([tx]);
    expect(saved[0].amount).toBe(0);
  });
});
