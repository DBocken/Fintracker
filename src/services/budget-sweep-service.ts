// Sweep-Service: bereitet das Anlegen eines Budget-Überschusses vor (Tagesgeld
// via GiroCode oder ETF-Vorschlag). Bewusst KEINE Zahlungsauslösung – nur ein
// scanbarer EPC-QR-Code und ein Prognose-Gate, das den Sicherheitspuffer schützt.

import type { BudgetStatus } from "@/types";
import { buildForecastInput } from "@/lib/forecast-data";
import { calculateDeterministicForecast } from "@/lib/forecast";
import { resolveRolloverConfig } from "@/lib/budget-rollover";
import { evaluateSweepGate, minBalanceWithinHorizon, type SweepGateResult } from "@/lib/budget-sweep";
import { getAccounts } from "./account-service";
import { buildEpcPayload } from "./girocode-service";

/** Horizont, über den der Liquiditätspuffer beim Sweep geschützt wird. */
const SWEEP_HORIZON_DAYS = 60;

export interface BudgetSweepPlan {
  action: "sweep_savings" | "sweep_invest";
  /** Angesparter, grundsätzlich abführbarer Überschuss. */
  desiredAmount: number;
  /** Prognose-Gate: wie viel davon sicher ist. */
  gate: SweepGateResult;
  /** EPC-QR-Payload für die Tagesgeld-Überweisung (nur Sparen + gültige Ziel-IBAN). */
  giroPayload?: string;
  giroDisplay?: { name: string; iban: string; amount: number };
}

/**
 * Ermittelt den Sweep-Plan eines Budgets. `null`, wenn das Budget keinen Sweep
 * konfiguriert hat oder nichts angespart wurde. Fällt der Forecast aus, bleibt
 * das Gate offen (kein fälschliches Blockieren).
 */
export async function getBudgetSweepPlan(status: BudgetStatus): Promise<BudgetSweepPlan | null> {
  const config = resolveRolloverConfig(status.budget);
  const action = config.surplusAction;
  if (action !== "sweep_savings" && action !== "sweep_invest") return null;

  const desired = status.swept ?? 0;
  if (desired < 1) return null;

  let projectedMin = Number.POSITIVE_INFINITY;
  let safetyBuffer = 0;
  try {
    const fc = calculateDeterministicForecast(await buildForecastInput());
    projectedMin = minBalanceWithinHorizon(
      fc.daily.map((p) => ({ date: p.date, balance: p.availableCash })),
      fc.config.startDate,
      SWEEP_HORIZON_DAYS,
    );
    safetyBuffer = fc.config.safetyBuffer;
  } catch {
    // Prognose nicht verfügbar – Gate bleibt offen (projectedMin = Infinity).
  }

  const gate = evaluateSweepGate({ desiredAmount: desired, projectedMinBalance: projectedMin, safetyBuffer });
  const plan: BudgetSweepPlan = { action, desiredAmount: desired, gate };

  if (action === "sweep_savings" && config.sweepTargetAccountId && gate.safeAmount >= 1) {
    const accounts = await getAccounts();
    const target = accounts.find((a) => a.id === config.sweepTargetAccountId);
    if (target?.iban) {
      try {
        plan.giroPayload = buildEpcPayload({
          name: target.name,
          iban: target.iban,
          amount: gate.safeAmount,
          remittance: `Sparen ${status.budget.name}`.slice(0, 140),
        });
        plan.giroDisplay = { name: target.name, iban: target.iban, amount: gate.safeAmount };
      } catch {
        // Ungültige IBAN o. Ä. – Plan bleibt gültig, nur ohne QR.
      }
    }
  }

  return plan;
}
