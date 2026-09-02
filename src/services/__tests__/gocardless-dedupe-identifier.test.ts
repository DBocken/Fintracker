import { describe, it, expect } from "vitest";
import { buildTxIdentifier } from "../gocardless-sync-service";

/**
 * F-ARCH-2 / T1.6: Der Dedupe-Schlüssel muss identisch sein, egal ob er aus der
 * rohen API-Description (die der Sync kürzt) oder aus dem gespeicherten, bereits
 * gekürzten original_text gebaut wird. Sonst würden Buchungen mit langem
 * Verwendungszweck (> 200 Zeichen) bei jedem Sync erneut angelegt.
 */
describe("[REGRESSION] buildTxIdentifier ist slice-stabil (F-ARCH-2)", () => {
  it("liefert denselben Schlüssel für rohe und bereits gekürzte Description", () => {
    const longDescription = "SEPA-Sammler ".repeat(30); // > 200 Zeichen
    expect(longDescription.length).toBeGreaterThan(200);

    const stored = longDescription.slice(0, 200); // so wird original_text gespeichert
    const fromRaw = buildTxIdentifier("acc-1", "2026-01-15", -49.99, longDescription);
    const fromStored = buildTxIdentifier("acc-1", "2026-01-15", -49.99, stored);

    expect(fromRaw).toBe(fromStored);
  });

  it("unterscheidet verschiedene Buchungen anhand Konto, Datum, Betrag und Zweck", () => {
    const base = buildTxIdentifier("acc-1", "2026-01-15", -10, "Miete");
    expect(buildTxIdentifier("acc-2", "2026-01-15", -10, "Miete")).not.toBe(base);
    expect(buildTxIdentifier("acc-1", "2026-01-16", -10, "Miete")).not.toBe(base);
    expect(buildTxIdentifier("acc-1", "2026-01-15", -11, "Miete")).not.toBe(base);
    expect(buildTxIdentifier("acc-1", "2026-01-15", -10, "Strom")).not.toBe(base);
  });
});

describe("[REGRESSION] Dedup-Fenster deckt den ganzen Bestand (Audit 2026-09, F3b)", () => {
  /**
   * Das Fenster war `getTransactions(5000)` — die 5.000 jüngsten Buchungen —,
   * während die Edge Function 730 Tage zurückholt. Wer mehr als 5.000
   * Buchungen hat, bekam bei JEDEM Sync die älteren Bankzeilen neu angelegt:
   * dieselbe Buchung, immer wieder, und jede Summe stieg mit.
   *
   * Geprüft wird die Eigenschaft, die das verhindert — der Bezeichner einer
   * alten Buchung ist derselbe wie beim ersten Import, also erkennt ihn ein
   * Dedup-Set, das den ganzen Bestand kennt. Der Aufrufpfad selbst
   * (`getAllTransactions()` statt eines Limits) wird zusätzlich von
   * `pnpm check:transaction-limits` festgehalten.
   */
  it("[REGRESSION] sollte eine Buchung erkennen, die älter ist als die 5000 jüngsten", () => {
    const alteBankzeile = {
      accountId: "acc-1",
      date: "2024-09-02",
      amount: -49.99,
      text: "NETFLIX MONATSBEITRAG",
    };

    const beimErstenImport = buildTxIdentifier(
      alteBankzeile.accountId,
      alteBankzeile.date,
      alteBankzeile.amount,
      alteBankzeile.text,
    );

    // Bestand mit 5.001 Buchungen: die alte Zeile liegt hinter dem alten Fenster.
    const bestand = new Set<string>();
    for (let i = 0; i < 5000; i += 1) {
      bestand.add(buildTxIdentifier("acc-1", "2026-01-15", -1 - i / 100, `NEUER UMSATZ ${i}`));
    }
    bestand.add(beimErstenImport);

    const beimZweitenSync = buildTxIdentifier(
      alteBankzeile.accountId,
      alteBankzeile.date,
      alteBankzeile.amount,
      alteBankzeile.text,
    );

    expect(bestand.has(beimZweitenSync)).toBe(true);
  });
});
