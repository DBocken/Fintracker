import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Account, Budget, BudgetRollover, BudgetStatus } from "../../types";
import { calculateDeterministicForecast } from "@/lib/forecast";

vi.mock("@/lib/forecast-data", () => ({
  buildForecastInput: vi.fn(),
}));

vi.mock("@/lib/forecast", () => ({
  calculateDeterministicForecast: vi.fn(),
}));

vi.mock("../account-service", () => ({
  getAccounts: vi.fn(),
}));

import { getBudgetSweepPlan } from "../budget-sweep-service";
import { buildForecastInput } from "@/lib/forecast-data";
import { getAccounts } from "../account-service";

// Gültige Beispiel-IBAN (Mod-97-korrekt) für den GiroCode-Pfad.
const VALID_IBAN = "DE89370400440532013000";

function makeBudget(rolloverConfig?: BudgetRollover): Budget {
  return {
    id: "b1",
    name: "Lebensmittel",
    category_id: "cat-food",
    limit: 400,
    rolloverConfig,
  };
}

function makeStatus(overrides: {
  swept?: number;
  rolloverConfig?: BudgetRollover;
}): BudgetStatus {
  return {
    budget: makeBudget(overrides.rolloverConfig),
    spent: 100,
    remaining: 300,
    ratio: 0.25,
    fillPercent: 25,
    health: "ok",
    swept: overrides.swept,
  };
}

function makeAccount(overrides: Partial<Account>): Account {
  return {
    id: "acc-tagesgeld",
    user_id: "local",
    name: "Tagesgeld",
    type: "savings",
    currency: "EUR",
    iban: VALID_IBAN,
    color: "#00aa00",
    icon: "piggy-bank",
    is_budget_pool_member: false,
    order_index: 0,
    ...overrides,
  };
}

/** Stellt den gemockten Forecast so, dass der Tiefststand `minCash` beträgt. */
function mockForecast(minCash: number, safetyBuffer: number) {
  const fake = {
    daily: [
      { date: "2026-07-05", availableCash: minCash + 500 },
      { date: "2026-07-20", availableCash: minCash },
    ],
    config: { startDate: "2026-07-01", safetyBuffer },
  };
  vi.mocked(calculateDeterministicForecast).mockReturnValue(
    fake as unknown as ReturnType<typeof calculateDeterministicForecast>,
  );
}

const SWEEP_SAVINGS: BudgetRollover = {
  mode: "accumulate",
  surplusAction: "sweep_savings",
  sweepTargetAccountId: "acc-tagesgeld",
};

describe("getBudgetSweepPlan (Überschuss anlegen mit Prognose-Gate)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(buildForecastInput).mockResolvedValue(
      {} as Awaited<ReturnType<typeof buildForecastInput>>,
    );
    vi.mocked(getAccounts).mockResolvedValue([makeAccount({})]);
  });

  describe("Normal Behavior", () => {
    it("sollte den vollen Überschuss freigeben, wenn der Prognose-Tiefststand genug Headroom lässt", async () => {
      mockForecast(1000, 500); // Headroom 500 ≥ gewünschte 200.
      const plan = await getBudgetSweepPlan(makeStatus({ swept: 200, rolloverConfig: SWEEP_SAVINGS }));

      expect(plan).not.toBeNull();
      expect(plan!.action).toBe("sweep_savings");
      expect(plan!.desiredAmount).toBe(200);
      expect(plan!.gate.safe).toBe(true);
      expect(plan!.gate.safeAmount).toBe(200);
    });

    it("sollte bei knappem Headroom nur den sicheren Teilbetrag freigeben", async () => {
      mockForecast(1000, 500); // Headroom 500 < gewünschte 800.
      const plan = await getBudgetSweepPlan(makeStatus({ swept: 800, rolloverConfig: SWEEP_SAVINGS }));

      expect(plan!.gate.safe).toBe(true);
      expect(plan!.gate.safeAmount).toBe(500);
      expect(plan!.desiredAmount).toBe(800);
      // Der GiroCode überweist nur den sicheren Teilbetrag, nie den Wunschbetrag.
      expect(plan!.giroDisplay?.amount).toBe(500);
    });

    it("sollte bei Sparen + gültiger Ziel-IBAN einen EPC-QR-Payload erzeugen", async () => {
      mockForecast(1000, 500);
      const plan = await getBudgetSweepPlan(makeStatus({ swept: 200, rolloverConfig: SWEEP_SAVINGS }));

      expect(plan!.giroPayload).toBeDefined();
      expect(plan!.giroPayload).toContain("BCD");
      expect(plan!.giroPayload).toContain(VALID_IBAN);
      expect(plan!.giroPayload).toContain("EUR200.00");
      expect(plan!.giroPayload).toContain("Sparen Lebensmittel");
      expect(plan!.giroDisplay).toEqual({ name: "Tagesgeld", iban: VALID_IBAN, amount: 200 });
    });

    it("sollte bei sweep_invest keinen GiroCode erzeugen (nur ETF-Vorschlag)", async () => {
      mockForecast(1000, 500);
      const plan = await getBudgetSweepPlan(
        makeStatus({
          swept: 200,
          rolloverConfig: { ...SWEEP_SAVINGS, surplusAction: "sweep_invest" },
        }),
      );

      expect(plan!.action).toBe("sweep_invest");
      expect(plan!.gate.safeAmount).toBe(200);
      expect(plan!.giroPayload).toBeUndefined();
      expect(getAccounts).not.toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("sollte null liefern, wenn kein Sweep konfiguriert ist", async () => {
      expect(await getBudgetSweepPlan(makeStatus({ swept: 200 }))).toBeNull();
      expect(
        await getBudgetSweepPlan(
          makeStatus({ swept: 200, rolloverConfig: { mode: "accumulate", surplusAction: "carry" } }),
        ),
      ).toBeNull();
    });

    it("sollte null liefern, wenn kein nennenswerter Überschuss angespart wurde", async () => {
      expect(await getBudgetSweepPlan(makeStatus({ swept: 0, rolloverConfig: SWEEP_SAVINGS }))).toBeNull();
      expect(
        await getBudgetSweepPlan(makeStatus({ swept: undefined, rolloverConfig: SWEEP_SAVINGS })),
      ).toBeNull();
    });

    it("sollte das Gate schließen und keinen GiroCode bauen, wenn der Puffer den Headroom aufzehrt", async () => {
      mockForecast(500, 500); // Headroom 0 → nichts sicher abführbar.
      const plan = await getBudgetSweepPlan(makeStatus({ swept: 200, rolloverConfig: SWEEP_SAVINGS }));

      expect(plan!.gate.safe).toBe(false);
      expect(plan!.gate.safeAmount).toBe(0);
      expect(plan!.giroPayload).toBeUndefined();
      expect(getAccounts).not.toHaveBeenCalled();
    });

    it("sollte ohne IBAN am Zielkonto den Plan ohne GiroCode liefern", async () => {
      mockForecast(1000, 500);
      vi.mocked(getAccounts).mockResolvedValue([makeAccount({ iban: null })]);
      const plan = await getBudgetSweepPlan(makeStatus({ swept: 200, rolloverConfig: SWEEP_SAVINGS }));

      expect(plan).not.toBeNull();
      expect(plan!.gate.safeAmount).toBe(200);
      expect(plan!.giroPayload).toBeUndefined();
      expect(plan!.giroDisplay).toBeUndefined();
    });

    it("sollte bei ungültiger Ziel-IBAN den Plan behalten, aber keinen GiroCode erzeugen", async () => {
      mockForecast(1000, 500);
      vi.mocked(getAccounts).mockResolvedValue([makeAccount({ iban: "DE00UNGUELTIG" })]);
      const plan = await getBudgetSweepPlan(makeStatus({ swept: 200, rolloverConfig: SWEEP_SAVINGS }));

      expect(plan).not.toBeNull();
      expect(plan!.gate.safe).toBe(true);
      expect(plan!.giroPayload).toBeUndefined();
      expect(plan!.giroDisplay).toBeUndefined();
    });
  });

  describe("Error Cases – Forecast-Ausfall", () => {
    it("sollte bei werfendem Forecast das Gate offen lassen (kein fälschliches Blockieren)", async () => {
      vi.mocked(calculateDeterministicForecast).mockImplementation(() => {
        throw new Error("Forecast kaputt");
      });
      const plan = await getBudgetSweepPlan(makeStatus({ swept: 200, rolloverConfig: SWEEP_SAVINGS }));

      expect(plan!.gate.safe).toBe(true);
      expect(plan!.gate.safeAmount).toBe(200);
      expect(plan!.giroPayload).toBeDefined();
    });

    it("sollte auch bei fehlschlagender Forecast-Datenbeschaffung den vollen Betrag freigeben", async () => {
      vi.mocked(buildForecastInput).mockRejectedValue(new Error("Keine Daten"));
      const plan = await getBudgetSweepPlan(makeStatus({ swept: 350, rolloverConfig: SWEEP_SAVINGS }));

      expect(plan!.gate.safe).toBe(true);
      expect(plan!.gate.safeAmount).toBe(350);
    });
  });
});
