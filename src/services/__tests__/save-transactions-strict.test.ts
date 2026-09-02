import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Transaction } from "../../types";
import { localEncryption } from "../local-crypto";
import { saveTransactions, getAllTransactions } from "../transaction-service";

/**
 * F-MONEY-4 / T1.3 (VE-3): saveTransactions ist die fachliche Grenze — ungültige
 * Beträge/Daten werden abgelehnt statt still als 0 € bzw. „heute" gespeichert
 * (Invariante 18). Die strikte Prüfung galt zuvor nur im CSV-Pfad; Bank-,
 * Restore- und programmatische Pfade konnten stille Nullwerte erzeugen.
 */
describe("[INTEGRITY] saveTransactions strikte Validierung (F-MONEY-4)", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("ausgabentracker_locale_v1", "de");
    localEncryption.lock();
  });

  afterEach(() => {
    localStorage.removeItem("ausgabentracker_locale_v1");
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
    expect(await getAllTransactions()).toHaveLength(0);
  });

  it("[REGRESSION] wirft bei leerem Datum", async () => {
    const tx = { ...base, id: "tx-no-date", date: "", amount: -10 } as Transaction;
    await expect(saveTransactions([tx])).rejects.toThrow(/Ungültiges Buchungsdatum/);
  });

  it("[REGRESSION] wirft bei unparsebarem Betrag statt still 0 zu speichern", async () => {
    const tx = { ...base, id: "tx-bad-amount", date: "2026-01-15", amount: "abc" as unknown as number } as Transaction;
    await expect(saveTransactions([tx])).rejects.toThrow(/Ungültiger Betrag/);
    expect(await getAllTransactions()).toHaveLength(0);
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

  describe("Cent-genaue Validierung (Invariante 5, docs/domain-invariants.md)", () => {
    it("[REGRESSION] lehnt einen Sub-Cent-Betrag wie 0.005 ab statt ihn still zu runden", async () => {
      const tx = { ...base, id: "tx-subcent", date: "2026-01-15", amount: 0.005 } as Transaction;
      await expect(saveTransactions([tx])).rejects.toThrow(/[Cc]ent/);
      // Nichts wurde persistiert — auch kein still auf 0.00/0.01 gerundeter Wert.
      expect(await getAllTransactions()).toHaveLength(0);
    });

    it("[REGRESSION] lehnt einen negativen Sub-Cent-Betrag ab", async () => {
      const tx = { ...base, id: "tx-subcent-neg", date: "2026-01-15", amount: -0.005 } as Transaction;
      await expect(saveTransactions([tx])).rejects.toThrow(/[Cc]ent/);
    });

    it("akzeptiert gültige Beträge (2 Dezimalstellen, negativ, Null, große Werte) unverändert", async () => {
      const txs = [
        { ...base, id: "tx-p1", date: "2026-01-15", amount: 12.34 },
        { ...base, id: "tx-p2", date: "2026-01-15", amount: -45.0 },
        { ...base, id: "tx-p3", date: "2026-01-15", amount: 0 },
        { ...base, id: "tx-p4", date: "2026-01-15", amount: 1_000_000.99 },
      ] as Transaction[];
      const saved = await saveTransactions(txs);
      expect(saved.map((s) => s.amount)).toEqual([12.34, -45.0, 0, 1_000_000.99]);
    });

    it("die Fehlermeldung ist für den Nutzer verständlich (kein roher Typfehler)", async () => {
      const tx = { ...base, id: "tx-subcent-msg", date: "2026-01-15", amount: 0.005 } as Transaction;
      try {
        await saveTransactions([tx]);
        expect.unreachable("sollte werfen");
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        const message = (err as Error).message;
        expect(message).not.toMatch(/NaN|undefined|\[object/);
        expect(message).toMatch(/0\.005/);
      }
    });

    it("[REGRESSION] die Fehlermeldung folgt der eingestellten Sprache (i18n-vollständig)", async () => {
      const txDe = { ...base, id: "tx-subcent-de", date: "2026-01-15", amount: 0.005 } as Transaction;
      await expect(saveTransactions([txDe])).rejects.toThrow(/Cent genau/);

      localStorage.setItem("ausgabentracker_locale_v1", "en");
      const txEn = { ...base, id: "tx-subcent-en", date: "2026-01-15", amount: 0.005 } as Transaction;
      await expect(saveTransactions([txEn])).rejects.toThrow(/precise to the cent/);

      localStorage.setItem("ausgabentracker_locale_v1", "ru");
      const txRu = { ...base, id: "tx-subcent-ru", date: "2026-01-15", amount: 0.005 } as Transaction;
      await expect(saveTransactions([txRu])).rejects.toThrow(/точной до цента/);
    });
  });
});
