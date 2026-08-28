import { describe, it, expect } from "vitest";
import {
  computeContracts,
  computeIncomeContracts,
  buildSalaryContractRows,
  isActiveForTotals,
  monthlyEquivalent,
  yearlyEquivalent,
  getCycleFromDays,
} from "@/lib/contract-derivation";
import type { Transaction, Category } from "@/types";
import type { ContractDecision } from "@/lib/contract-types";
import { merchantFingerprint } from "@/lib/merchant-fingerprint";
import { asTransactionId } from '@/lib/ids';

const NOW = new Date("2024-06-01");

function tx(partial: Omit<Partial<Transaction>, 'id'> & { id?: string }): Transaction {
  return {
    date: "2024-01-01",
    amount: -10,
    payee: "Test",
    description: "",
    original_text: "",
    auto_mapped: false,
    confirmed: false,
    ...partial,
    id: partial.id !== undefined ? asTransactionId(partial.id) : undefined,
  };
}

/** A monthly Netflix-like series ending shortly before NOW. */
function monthlySeries(payee: string, amount: number, months: number, lastMonth = 5): Transaction[] {
  const out: Transaction[] = [];
  for (let i = 0; i < months; i++) {
    const m = lastMonth - (months - 1 - i);
    const mm = String(m + 1).padStart(2, "0");
    out.push(tx({ id: `${payee}-${i}`, payee, amount, date: `2024-${mm}-15` }));
  }
  return out;
}

describe("cycle + equivalents", () => {
  it("maps day gaps to cycles", () => {
    expect(getCycleFromDays(30)).toBe("Monatlich");
    expect(getCycleFromDays(7)).toBe("Wöchentlich");
    expect(getCycleFromDays(250)).toBe("Unbekannt"); // gap between half-year and yearly windows
  });

  it("does not guess for unknown cycles", () => {
    expect(monthlyEquivalent(10, "Unbekannt")).toBe(0);
    expect(yearlyEquivalent(10, "Unbekannt")).toBe(0);
    expect(yearlyEquivalent(10, "Monatlich")).toBe(120);
  });
});

describe("computeContracts status awareness", () => {
  const cats = new Map<string, Category>();

  it("derives a candidate from a stable monthly series", () => {
    const rows = computeContracts(monthlySeries("Netflix", -12, 4), cats, "Ausgabe", { now: NOW });
    expect(rows).toHaveLength(1);
    expect(rows[0].cycle).toBe("Monatlich");
    expect(rows[0].status).toBe("candidate");
    expect(rows[0].cycleKnown).toBe(true);
  });

  it("[REGRESSION] abgelehnter Vertrag reaktiviert sich nicht bei zweiter IBAN (F-CONTRACT-1)", () => {
    // Derselbe Händler, zwei verschiedene Gegen-IBANs (z. B. Anbieterwechsel).
    const ibanA = "DE11 0000 0000 0000 0000 01";
    const ibanB = "DE22 0000 0000 0000 0000 02";
    const seriesA = monthlySeries("Netflix", -9.99, 3, 3).map((t, i) => ({
      ...t, id: asTransactionId(`a-${i}`), counterparty_iban: ibanA,
    }));
    const seriesB = monthlySeries("Netflix", -9.99, 3, 5).map((t, i) => ({
      ...t, id: asTransactionId(`b-${i}`), counterparty_iban: ibanB,
    }));

    // Nutzer hat die Familie unter der ERSTEN IBAN als „Kein Vertrag" markiert.
    const fpA = merchantFingerprint(seriesA[0]);
    const decisions = new Map<string, ContractDecision>([
      [fpA, { id: "d1", user_id: "u", fingerprint: fpA, status: "rejected" }],
    ]);

    const rows = computeContracts([...seriesA, ...seriesB], cats, "Ausgabe", { now: NOW, decisions });
    const merged = rows.find((r) => r.key.startsWith("merchant:"));
    expect(merged).toBeDefined();
    expect(merged!.status).toBe("rejected");
    expect(isActiveForTotals(merged!)).toBe(false);
  });

  it("erkennt eine aktuelle Gehaltsserie und gewichtet den jüngsten Betrag", () => {
    const dates = [
      "2023-07-31", "2023-08-28", "2023-09-29", "2023-10-29", "2023-11-27", "2023-12-29",
      "2024-01-28", "2024-02-27", "2024-03-30", "2024-04-29", "2024-05-28",
    ];
    const salary = dates.map((date, index) => tx({
      id: `salary-${index}`,
      payee: "BREDEX",
      amount: index < 6 ? 4044.26 : 4028.48,
      date,
      description: `Lohn - Gehalt Abrechnung ${index + 1}`,
    }));

    const rows = computeContracts(salary, cats, "Einnahme", { now: NOW });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "Einnahme",
      cycle: "Monatlich",
      status: "candidate",
      amountRecentTypical: 4028.48,
      stale: false,
    });
  });

  it("marks confirmed transactions as active", () => {
    const series = monthlySeries("Spotify", -10, 4).map((t) => ({ ...t, is_contract: true }));
    const rows = computeContracts(series, cats, "Ausgabe", { now: NOW });
    expect(rows[0].status).toBe("active");
    expect(isActiveForTotals(rows[0])).toBe(true);
  });

  it("a rejected decision keeps the row out of totals", () => {
    const series = monthlySeries("Gym", -30, 4).map((t) => ({ ...t, is_contract: true }));
    const fp = merchantFingerprint(series[0]);
    const decisions = new Map<string, ContractDecision>([
      [fp, { id: "1", user_id: "local", fingerprint: fp, status: "rejected" }],
    ]);
    const rows = computeContracts(series, cats, "Ausgabe", { now: NOW, decisions });
    expect(rows[0].status).toBe("rejected");
    expect(isActiveForTotals(rows[0])).toBe(false);
  });

  it("an ended contract is excluded from totals", () => {
    const series = monthlySeries("OldMag", -8, 4).map((t) => ({ ...t, is_contract: true }));
    const fp = merchantFingerprint(series[0]);
    const decisions = new Map<string, ContractDecision>([
      [fp, { id: "2", user_id: "local", fingerprint: fp, status: "ended", ended_at: "2024-03-01" }],
    ]);
    const rows = computeContracts(series, cats, "Ausgabe", { now: NOW, decisions });
    expect(isActiveForTotals(rows[0])).toBe(false);
  });

  it("[INTEGRITY] a rejected decision survives a historical reimport with additional matching rows", () => {
    const original = monthlySeries("Former Provider", -19.99, 4, 3).map((t) => ({ ...t, is_contract: true }));
    const fingerprint = merchantFingerprint(original[0]);
    const decisions = new Map<string, ContractDecision>([[
      fingerprint,
      { id: "rejected-forever", user_id: "local", fingerprint, status: "rejected" },
    ]]);
    const reimported = [
      ...original,
      tx({ id: "historic-extra", payee: "Former Provider", amount: -19.99, date: "2023-12-15", is_contract: true }),
    ];

    const rows = computeContracts(reimported, cats, "Ausgabe", { now: NOW, decisions });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("rejected");
    expect(isActiveForTotals(rows[0])).toBe(false);
  });

  it("stale active contracts (last booking > 2 cycles ago) are excluded from totals", () => {
    // monthly series whose last booking is 2023, far before NOW (2024-06)
    const series = [
      tx({ id: "a", payee: "DeadSub", amount: -9, date: "2023-01-15", is_contract: true }),
      tx({ id: "b", payee: "DeadSub", amount: -9, date: "2023-02-15", is_contract: true }),
      tx({ id: "c", payee: "DeadSub", amount: -9, date: "2023-03-15", is_contract: true }),
    ];
    const rows = computeContracts(series, cats, "Ausgabe", { now: NOW });
    expect(rows[0].status).toBe("active");
    expect(rows[0].stale).toBe(true);
    expect(isActiveForTotals(rows[0])).toBe(false);
  });

  it("[REGRESSION] erkennt Energieversorger mit Abschlagserhöhung als Kandidat", () => {
    // Typisches Stadtwerke-Modell: monatlicher Abschlag, Erhöhung nach 3 Monaten (~15 % Anstieg)
    const series = [
      tx({ id: "e1", payee: "Stadtwerke", amount: -150, date: "2024-01-15" }),
      tx({ id: "e2", payee: "Stadtwerke", amount: -150, date: "2024-02-15" }),
      tx({ id: "e3", payee: "Stadtwerke", amount: -150, date: "2024-03-15" }),
      tx({ id: "e4", payee: "Stadtwerke", amount: -175, date: "2024-04-15" }),
      tx({ id: "e5", payee: "Stadtwerke", amount: -175, date: "2024-05-15" }),
    ];
    // median = 150, stddev ≈ 12 (8 % von median) → sollte mit 20 %-Schwelle erkannt werden
    const rows = computeContracts(series, cats, "Ausgabe", { now: NOW });
    expect(rows).toHaveLength(1);
    expect(rows[0].cycle).toBe("Monatlich");
    expect(rows[0].status).toBe("candidate");
  });

  it("[REGRESSION] Gehaltsbuchung mit Betragswechsel wird weiterhin erkannt", () => {
    // Gehalt: 6 Monate 4044€, dann 5 Monate 4028€ → stddev ≈ 8€ << 20% × 4035€
    const dates = [
      "2023-08-28", "2023-09-29", "2023-10-29", "2023-11-27", "2023-12-29",
      "2024-01-28", "2024-02-27", "2024-03-30", "2024-04-29", "2024-05-28",
    ];
    const salary = dates.map((date, i) =>
      tx({ id: `s-${i}`, payee: "Arbeitgeber AG", amount: i < 5 ? 4044.26 : 4028.48, date })
    );
    const rows = computeContracts(salary, cats, "Einnahme", { now: NOW });
    expect(rows).toHaveLength(1);
    expect(rows[0].cycle).toBe("Monatlich");
  });

  it("[REGRESSION] erkennt Gehalt als Vertrag, das die generische IBAN-Ableitung verwirft", () => {
    // Gehalt mit Bonusmonat (5000 statt 3000) → stddev > 20 % → generische
    // Einnahmen-Ableitung lehnt ab. Die Gehaltsdomäne (Median, Keyword) erkennt es.
    const salary = [
      tx({ id: "g1", payee: "Arbeitgeber AG", amount: 3000, date: "2024-01-31", description: "Gehalt Januar" }),
      tx({ id: "g2", payee: "Arbeitgeber AG", amount: 3000, date: "2024-02-28", description: "Gehalt Februar" }),
      tx({ id: "g3", payee: "Arbeitgeber AG", amount: 5000, date: "2024-03-29", description: "Gehalt + Bonus" }),
      tx({ id: "g4", payee: "Arbeitgeber AG", amount: 3000, date: "2024-04-30", description: "Gehalt April" }),
      tx({ id: "g5", payee: "Arbeitgeber AG", amount: 3000, date: "2024-05-30", description: "Gehalt Mai" }),
    ];

    // Generisch: nichts (zu starke Streuung).
    expect(computeContracts(salary, cats, "Einnahme", { now: NOW })).toHaveLength(0);

    // Gehaltsdomäne: ein Einnahmen-Vertrag, monatlich.
    const salaryRows = buildSalaryContractRows(salary, cats, { now: NOW });
    expect(salaryRows).toHaveLength(1);
    expect(salaryRows[0]).toMatchObject({ type: "Einnahme", cycle: "Monatlich", amountTypical: 3000 });

    // Vereint: erscheint genau einmal.
    const income = computeIncomeContracts(salary, cats, { now: NOW });
    expect(income.filter((r) => r.payee === "Arbeitgeber AG")).toHaveLength(1);
  });

  it("[REGRESSION] dedupliziert: Gehalt nicht doppelt (Domäne + generisch)", () => {
    // Stabiles Gehalt: würde BEIDE Detektoren auslösen → darf nur einmal erscheinen.
    const dates = ["2024-01-30", "2024-02-28", "2024-03-29", "2024-04-30", "2024-05-30"];
    const salary = dates.map((date, i) =>
      tx({ id: `s-${i}`, payee: "Stabiler Arbeitgeber", amount: 3500, date, description: "Lohn/Gehalt", counterparty_iban: "DE89370400440532013000" })
    );
    const income = computeIncomeContracts(salary, cats, { now: NOW });
    expect(income.filter((r) => r.payee === "Stabiler Arbeitgeber")).toHaveLength(1);
  });

  it("[REGRESSION] erkennt Gehalt von zwei verschiedenen IBANs als eine Serie", () => {
    // Gehalt: alte Bank (IBAN1) 2 Mal, neue Bank (IBAN2) 2 Mal → sollte ein Vertrag sein
    const series = [
      tx({ id: "g1", payee: "Arbeitgeber AG", amount: 3000, date: "2024-03-28", counterparty_iban: "DE89370400440532013000" }),
      tx({ id: "g2", payee: "Arbeitgeber AG", amount: 3000, date: "2024-04-29", counterparty_iban: "DE89370400440532013000" }),
      tx({ id: "g3", payee: "Arbeitgeber AG", amount: 3000, date: "2024-05-28", counterparty_iban: "DE89999999999999999999" }), // neue Bank
      tx({ id: "g4", payee: "Arbeitgeber AG", amount: 3000, date: "2024-06-28", counterparty_iban: "DE89999999999999999999" }),
    ];
    // Merchant-Fallback sollte die zwei IBAN-Gruppen mergen
    const rows = computeContracts(series, cats, "Einnahme", { now: NOW });
    expect(rows).toHaveLength(1);
    expect(rows[0].cycle).toBe("Monatlich");
    expect(rows[0].status).toBe("candidate");
  });

  it("[REGRESSION] erkennt Energieversorger-Wechsel (IBAN-Wechsel) als eine Serie", () => {
    // Energieversorger: zwei verschiedene IBANs (Dienstleister-Wechsel) → sollte gemergelt werden
    const series = [
      tx({ id: "e1", payee: "Stadtwerke", amount: -200, date: "2024-03-15", counterparty_iban: "DE11111111111111111111" }),
      tx({ id: "e2", payee: "Stadtwerke", amount: -200, date: "2024-04-15", counterparty_iban: "DE22222222222222222222" }), // neuer Dienstleister
      tx({ id: "e3", payee: "Stadtwerke", amount: -260, date: "2024-05-15", counterparty_iban: "DE22222222222222222222" }),
      tx({ id: "e4", payee: "Stadtwerke", amount: -260, date: "2024-06-15", counterparty_iban: "DE22222222222222222222" }),
    ];
    // Merchant-Fallback-Merging + 20% Streuungstoleranz sollte alles erkennen
    const rows = computeContracts(series, cats, "Ausgabe", { now: NOW });
    expect(rows).toHaveLength(1);
    expect(rows[0].cycle).toBe("Monatlich");
  });
});

/**
 * Gruppierung nach Händlerfamilie statt nach rohem Zahlungsempfänger.
 *
 * Diese Tests sichern das Verhalten ab, das `detectRecurringTransactions`
 * (bis WP-A, `contract-detection-service.ts`) FALSCH machte: Jene zweite,
 * nie produktiv gerufene Vertragsableitung gruppierte nach `t.payee` und
 * zerlegte damit dieselbe Zahlung in so viele Familien, wie die Bank
 * Schreibweisen liefert. Sie ist entfallen; `computeContracts` ist seither
 * die einzige Ableitung — und das hier ist ihr Netz.
 */
describe("computeContracts gruppiert nach Händlerfamilie", () => {
  const cats = new Map<string, Category>();

  it("sollte Filialnummern-Varianten desselben Händlers als EINEN Vertrag erkennen", () => {
    // Die Bank hängt je Buchung eine andere Filial-/Referenznummer an. Nach
    // `normalizeMerchantName` (Ziffernfolgen ab drei Stellen fallen weg) ist
    // das dieselbe Familie; nach rohem `payee` wären es vier.
    const series = [
      tx({ id: "f1", payee: "LIDL SAGT DANKE 1234", amount: -42, date: "2024-02-15" }),
      tx({ id: "f2", payee: "LIDL SAGT DANKE 5678", amount: -42, date: "2024-03-15" }),
      tx({ id: "f3", payee: "LIDL SAGT DANKE 9012", amount: -42, date: "2024-04-15" }),
      tx({ id: "f4", payee: "LIDL SAGT DANKE 3456", amount: -42, date: "2024-05-15" }),
    ];

    const rows = computeContracts(series, cats, "Ausgabe", { now: NOW });

    expect(rows).toHaveLength(1);
    expect(rows[0].cycle).toBe("Monatlich");
    expect(rows[0].transactionIds).toHaveLength(4);
  });

  it("sollte über die Gegen-IBAN gruppieren, wenn der Verwendungszweck variiert", () => {
    // Die IBAN ist das stärkere Signal (merchant-fingerprint.ts): Der
    // Empfängername trägt hier den Abrechnungsmonat und ist deshalb bei jeder
    // Buchung ein anderer String.
    const iban = "DE11 0000 0000 0000 0000 01";
    const series = [
      tx({ id: "s1", payee: "Stadtwerke Abschlag 02/24", amount: -95, date: "2024-02-15", counterparty_iban: iban }),
      tx({ id: "s2", payee: "Stadtwerke Abschlag 03/24", amount: -95, date: "2024-03-15", counterparty_iban: iban }),
      tx({ id: "s3", payee: "Stadtwerke Abschlag 04/24", amount: -95, date: "2024-04-15", counterparty_iban: iban }),
      tx({ id: "s4", payee: "Stadtwerke Abschlag 05/24", amount: -95, date: "2024-05-15", counterparty_iban: iban }),
    ];

    const rows = computeContracts(series, cats, "Ausgabe", { now: NOW });

    expect(rows).toHaveLength(1);
    expect(rows[0].transactionIds).toHaveLength(4);
  });

  it("sollte Einnahme und Ausgabe desselben Händlers getrennt halten", () => {
    // Die Richtung ist Teil des Fingerprints. Eine Erstattung darf nicht in
    // derselben Vertragsfamilie landen wie die Abbuchung.
    const abbuchungen = monthlySeries("Versandhaus", -30, 4);
    const erstattungen = monthlySeries("Versandhaus", 30, 4).map((t, i) => ({
      ...t,
      id: asTransactionId(`erstattung-${i}`),
    }));
    const alle = [...abbuchungen, ...erstattungen];

    const ausgaben = computeContracts(alle, cats, "Ausgabe", { now: NOW });

    expect(ausgaben).toHaveLength(1);
    expect(ausgaben[0].transactionIds).toEqual(
      expect.arrayContaining(abbuchungen.map((t) => t.id)),
    );
    expect(ausgaben[0].transactionIds).not.toEqual(
      expect.arrayContaining(erstattungen.map((t) => t.id)),
    );
  });
});
