import { describe, expect, it } from "vitest";
import { calculatePayoffPlan, suggestDebtPriority } from "../debt-service";
import type { Debt } from "../../types";

describe("suggestDebtPriority", () => {
  it("erkennt Vermieter als existenzsichernd", () => {
    expect(suggestDebtPriority("Mustervermieter GmbH")).toBe("existenzsichernd");
    expect(suggestDebtPriority("Hausverwaltung Schmidt")).toBe("existenzsichernd");
    expect(suggestDebtPriority("Wohnungsbau e.V.")).toBe("existenzsichernd");
  });

  it("erkennt Energieversorger als existenzsichernd", () => {
    expect(suggestDebtPriority("Stadtwerke Karlsruhe")).toBe("existenzsichernd");
    expect(suggestDebtPriority("Vattenfall Europe")).toBe("existenzsichernd");
    expect(suggestDebtPriority("E.ON AG")).toBe("existenzsichernd");
    expect(suggestDebtPriority("Fernwärmeversorgung")).toBe("existenzsichernd");
  });

  it("erkennt Unterhaltskasse als existenzsichernd", () => {
    expect(suggestDebtPriority("Unterhaltsvorschussamt")).toBe("existenzsichernd");
    expect(suggestDebtPriority("Jugendamt")).toBe("existenzsichernd");
  });

  it("klassifiziert andere Schulden als normal", () => {
    expect(suggestDebtPriority("Visa Kreditkarte")).toBe("normal");
    expect(suggestDebtPriority("Klarna")).toBe("normal");
    expect(suggestDebtPriority("Online-Shop GmbH")).toBe("normal");
  });

  it("ist case-insensitive", () => {
    expect(suggestDebtPriority("MIETE")).toBe("existenzsichernd");
    expect(suggestDebtPriority("MiEtE")).toBe("existenzsichernd");
  });
});

describe("calculatePayoffPlan mit Prioritäten", () => {
  const existential: Debt = {
    id: "miete",
    user_id: "test",
    name: "Mietrückstand",
    type: "other",
    balance: 1200,
    interest_rate: 0, // Miete hat keine Zinsen
    min_payment: 200,
    is_bnpl: false,
    is_paid_off: false,
    priority: "existenzsichernd",
  };

  const consumer: Debt = {
    id: "visa",
    user_id: "test",
    name: "Visa Kreditkarte",
    type: "credit_card",
    balance: 3000,
    interest_rate: 19.5, // Hohe Zinsen
    min_payment: 100,
    is_bnpl: false,
    is_paid_off: false,
    priority: "normal",
  };

  it("stellt existenzsichernde Schulden IMMER vor Konsumschulden — unabhängig vom Zins", () => {
    const plan = calculatePayoffPlan([consumer, existential], 400, "avalanche");
    const order = plan.steps.map((s) => s.debtId);

    // Obwohl Visa 19,5% Zinsen hat (Lawine-Strategie würde es vorziehen),
    // steht Miete wegen Priorität zuerst.
    expect(order[0]).toBe("miete");
    expect(order[1]).toBe("visa");
  });

  it("respektiert Avalanche/Snowball NUR innerhalb der Prioritätsstufe", () => {
    const visa2: Debt = {
      ...consumer,
      id: "amex",
      name: "American Express",
      balance: 2000,
      interest_rate: 21, // Noch höher als Visa
    };

    const plan = calculatePayoffPlan([consumer, visa2, existential], 400, "avalanche");
    const order = plan.steps.map((s) => s.debtId);

    // Miete kommt immer zuerst
    expect(order[0]).toBe("miete");
    // Innerhalb Konsumschulden: AmEx (21%) vor Visa (19,5%) — Lawine
    expect(order[1]).toBe("amex");
    expect(order[2]).toBe("visa");
  });

  it("snowball ordnet Konsumschulden nach Größe, hält aber Existenzsichernde oben", () => {
    const smallDebt: Debt = {
      ...consumer,
      id: "small",
      name: "Kleine Schuld",
      balance: 500,
    };

    const plan = calculatePayoffPlan([consumer, smallDebt, existential], 400, "snowball");
    const order = plan.steps.map((s) => s.debtId);

    // Miete zuerst
    expect(order[0]).toBe("miete");
    // Dann kleine Schuld (Snowball: kleinste zuerst)
    expect(order[1]).toBe("small");
    expect(order[2]).toBe("visa");
  });

  it("berechnet Plandauer korrekt mit gemischten Prioritäten", () => {
    // Miete 1200 € (0% Zinsen), Visa 3000 € (19,5% Zinsen), Budget 400 €/Monat
    const plan = calculatePayoffPlan([existential, consumer], 400, "avalanche");

    // Mit Budget 400€/Monat und Mindestraten 200+100=300€:
    // - Miete zahlbar (200€ Minimum), kriegt extra Budget
    // - Plandauer hängt von Schuldenabbau ab
    const mieteStep = plan.steps.find((s) => s.debtId === "miete");
    expect(mieteStep?.monthsToPayoff).toBeGreaterThan(0);
    expect(mieteStep?.monthsToPayoff).toBeLessThanOrEqual(10);

    // Visa braucht deutlich länger wegen Zinsen
    const visaStep = plan.steps.find((s) => s.debtId === "visa");
    expect(visaStep!.monthsToPayoff).toBeGreaterThan(mieteStep!.monthsToPayoff);

    // Gesamtplan sollte schuldenfrei sein
    expect(plan.insufficientBudget).toBe(false);
  });
});
