import { describe, it, expect } from "vitest";
import { asAccountId, asTransactionId, type AccountId, type TransactionId } from "../ids";

/**
 * Demonstrations-Testdatei für WP 5.2 (DOM-3, docs/qualitaet-2026-08/plan.md).
 *
 * Ziel: eine Fremdschlüssel-Verwechslung zwischen zwei ID-Domänen soll ein
 * Compile-Fehler sein, nicht nur ein Laufzeit-Bug. `TransactionId` und
 * `AccountId` sind für den Compiler seit dem Brand NICHT mehr austauschbar,
 * obwohl beide zur Laufzeit ein ganz normaler `string` sind.
 *
 * Diese Datei ist selbsttragend: Ein `@ts-expect-error`, das nicht greift,
 * macht `tsc --noEmit` rot ("Unused '@ts-expect-error' directive"). Ohne
 * Brand (beide Typen wären nacktes `string`) greift die Zeile NICHT, weil
 * `accountId` klaglos durchginge — das ist der dokumentierte rote
 * Ausgangszustand (siehe Bericht zu WP 5.2).
 */
function needsTransactionId(id: TransactionId): TransactionId {
  return id;
}

describe("ID-Brands (WP 5.2, DOM-3)", () => {
  it("sollte eine AccountId NICHT als TransactionId durchlassen (Compile-Zeit)", () => {
    const accountId: AccountId = asAccountId("acc-1");
    // @ts-expect-error — accountId ist eine AccountId, keine TransactionId.
    // Ohne Brand kompiliert dieser Aufruf klaglos und die Fremdschlüssel-
    // Verwechslung bliebe bis zur Laufzeit unsichtbar (genau der DOM-3-Befund).
    needsTransactionId(accountId);
    expect(true).toBe(true);
  });

  it("sollte eine echte TransactionId (aus asTransactionId) anstandslos annehmen", () => {
    expect(needsTransactionId(asTransactionId("txn-1"))).toBe("txn-1");
  });
});
