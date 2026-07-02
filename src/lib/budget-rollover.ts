import type {
  Budget,
  BudgetHealth,
  BudgetPeriodLedger,
  BudgetRollover,
  BudgetStatus,
  Category,
  RolloverMode,
  Transaction,
  TransactionAllocation,
} from "@/types";
import { computeBudgetSpent, DEFAULT_WARN_THRESHOLD } from "@/lib/budget-logic";

/**
 * Ermittelt die effektive Rollover-Konfiguration eines Budgets und migriert dabei
 * das alte boolean-Feld `rollover`. Reihenfolge: explizite `rolloverConfig` →
 * `rollover:true` (= `accumulate`) → sonst `off`.
 */
export function resolveRolloverConfig(budget: Budget): BudgetRollover {
  if (budget.rolloverConfig) return budget.rolloverConfig;
  if (budget.rollover) return { mode: "accumulate" };
  return { mode: "off" };
}

/**
 * Berechnet den (rohen) Übertrag einer Periode aus dem verbleibenden Budget.
 * `cap` deckelt ausschließlich den positiven Übertrag (0/undefined = unbegrenzt);
 * ein negativer Übertrag (Überzug) bleibt vom Cap unberührt.
 */
export function computeCarryOut(mode: RolloverMode, remaining: number, cap?: number): number {
  let carry: number;
  switch (mode) {
    case "accumulate":
      carry = Math.max(0, remaining);
      break;
    case "overspend":
      carry = Math.min(0, remaining);
      break;
    case "both":
      carry = remaining;
      break;
    case "off":
    default:
      return 0;
  }
  if (cap != null && cap > 0 && carry > cap) carry = cap;
  return carry;
}

function healthFor(spent: number, limit: number, warnThreshold: number): BudgetHealth {
  if (limit <= 0) return spent > 0 ? "over" : "ok";
  if (spent > limit) return "over";
  if ((spent / limit) * 100 >= warnThreshold) return "warn";
  return "ok";
}

interface LedgerOptions {
  /** Übertrag, mit dem der erste Monat startet (Default 0). */
  initialCarryIn?: number;
  /** Liefert das Basislimit je Monat (z. B. datengetrieben). Default: `budget.limit`. */
  baseLimitFor?: (period: string) => number;
}

/**
 * Baut den Übertrags-Verlauf eines Budgets über mehrere Monate auf. `months` muss
 * chronologisch (ältester zuerst) übergeben werden; jeder Monat erbt den
 * `carryOut` des Vormonats als `carryIn`. Positiver Überschuss kann via
 * `surplusAction = 'sweep_*'` abgeführt werden, statt sich zu kumulieren.
 */
export function computeRolloverLedger(
  budget: Budget,
  transactions: Transaction[],
  categories: Category[],
  months: string[],
  allocationsByTx?: Map<string, TransactionAllocation[]>,
  options?: LedgerOptions,
): BudgetPeriodLedger[] {
  const config = resolveRolloverConfig(budget);
  const sweeps = config.surplusAction === "sweep_savings" || config.surplusAction === "sweep_invest";

  const ledger: BudgetPeriodLedger[] = [];
  let carryIn = options?.initialCarryIn ?? 0;

  for (const period of months) {
    const baseLimit = options?.baseLimitFor?.(period) ?? budget.limit;
    const spent = computeBudgetSpent(budget, transactions, categories, period, allocationsByTx);
    const effectiveLimit = baseLimit + carryIn;
    const remaining = effectiveLimit - spent;

    const grossCarry = computeCarryOut(config.mode, remaining, config.cap);
    // Sweep betrifft nur positiven Überschuss; ein Überzug (negativ) wird stets weitergereicht.
    const swept = sweeps && grossCarry > 0 ? grossCarry : 0;
    const carryOut = grossCarry - swept;

    ledger.push({ budgetId: budget.id, period, baseLimit, carryIn, effectiveLimit, spent, remaining, swept, carryOut });
    carryIn = carryOut;
  }

  return ledger;
}

/**
 * Live-Status eines Budgets für den letzten Monat in `months`, unter
 * Berücksichtigung des Übertrags. Ampel/Füllstand beziehen sich auf das
 * effektive (nicht das Basis-)Limit.
 */
export function computeBudgetStatusWithRollover(
  budget: Budget,
  transactions: Transaction[],
  categories: Category[],
  months: string[],
  allocationsByTx?: Map<string, TransactionAllocation[]>,
  options?: LedgerOptions,
): BudgetStatus {
  const ledger = computeRolloverLedger(budget, transactions, categories, months, allocationsByTx, options);
  const warnThreshold = budget.warn_threshold ?? DEFAULT_WARN_THRESHOLD;

  // Ohne Perioden (leeres `months`) gibt es keinen letzten Ledger-Eintrag —
  // vorher warf der Zugriff auf `last.effectiveLimit` einen TypeError.
  const last = ledger[ledger.length - 1];
  if (!last) {
    return {
      budget,
      spent: 0,
      remaining: budget.limit,
      ratio: 0,
      fillPercent: 0,
      health: healthFor(0, budget.limit, warnThreshold),
      carryIn: 0,
      effectiveLimit: budget.limit,
      carryOut: 0,
      swept: 0,
    };
  }

  const ratio = last.effectiveLimit > 0 ? last.spent / last.effectiveLimit : 0;

  return {
    budget,
    spent: last.spent,
    remaining: last.remaining,
    ratio,
    fillPercent: Math.max(0, Math.min(100, ratio * 100)),
    health: healthFor(last.spent, last.effectiveLimit, warnThreshold),
    carryIn: last.carryIn,
    effectiveLimit: last.effectiveLimit,
    carryOut: last.carryOut,
    swept: last.swept,
  };
}
