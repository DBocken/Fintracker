import type { Transaction, Debt } from "../types";
import { getAllTransactions } from "./transaction-service";
import { getDebts } from "./debt-service";
import { totalMinimumPayment } from "@/lib/debt-totals";
import { getNetWorthBreakdown, type NetWorthBreakdown } from "./net-worth-service";
import { t } from "../i18n/serviceT";

export interface SubScore {
  key: string;
  label: string;
  /** 0-100 */
  score: number;
  /** Short human-readable explanation */
  explanation: string;
}

export interface FinancialHealth {
  /** Overall weighted score 0-100 */
  score: number;
  subScores: SubScore[];
  netWorth: NetWorthBreakdown;
  monthlyIncome: number;
  monthlyExpenses: number;
  savingsRate: number;
}

/** Average monthly income/expenses over the last `months` months of transactions. */
/**
 * Durchschnittliche monatliche Einnahmen/Ausgaben über die letzten `months`
 * Monate (transferbereinigt). Eine Quelle der Wahrheit für Health-Score UND
 * Coach, damit beide dieselben Monatswerte nutzen (F-UX-3).
 */
export function monthlyAverages(transactions: Transaction[], months = 3) {
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());

  let income = 0;
  let expenses = 0;
  for (const t of transactions) {
    if (t.is_transfer) continue;
    const d = new Date(t.date);
    if (d < cutoff) continue;
    if (t.amount > 0) income += t.amount;
    else expenses += Math.abs(t.amount);
  }

  return {
    income: income / months,
    expenses: expenses / months,
  };
}

function clamp(v: number) {
  return Math.max(0, Math.min(100, Math.round(v)));
}

const WEIGHTS: Record<string, number> = {
  emergency_fund: 0.25,
  debt: 0.25,
  savings_rate: 0.2,
  liquidity: 0.15,
  contracts: 0.15,
};

export async function getFinancialHealth(): Promise<FinancialHealth> {
  const [transactions, debts, netWorth] = await Promise.all([
    getAllTransactions(),
    getDebts(),
    getNetWorthBreakdown(),
  ]);

  return computeFinancialHealth(transactions, debts, netWorth);
}

/**
 * Pure scoring logic, separated from data loading so it can be unit-tested
 * without mocking storage/Supabase.
 */
export function computeFinancialHealth(
  transactions: Transaction[],
  debts: Debt[],
  netWorth: NetWorthBreakdown,
): FinancialHealth {
  const { income, expenses } = monthlyAverages(transactions, 3);
  const savingsRate = income > 0 ? (income - expenses) / income : 0;

  const subScores: SubScore[] = [];

  // 1. Emergency fund: months of expenses covered by cash
  const monthsCovered = expenses > 0 ? netWorth.cash / expenses : netWorth.cash > 0 ? 6 : 0;
  const emergencyScore = clamp((monthsCovered / 6) * 100);
  subScores.push({
    key: "emergency_fund",
    label: t("financialHealthService.emergencyFundLabel"),
    score: emergencyScore,
    explanation:
      expenses > 0
        ? t("financialHealthService.emergencyFundExplanationCovered").replace("{months}", monthsCovered.toFixed(1))
        : t("financialHealthService.notEnoughData"),
  });

  // 2. Debt: ratio of debt to annual income (lower is better)
  const annualIncome = income * 12;
  const debtRatio = annualIncome > 0 ? netWorth.debts / annualIncome : netWorth.debts > 0 ? 1 : 0;
  const debtScore = netWorth.debts <= 0 ? 100 : clamp(100 - debtRatio * 100);
  subScores.push({
    key: "debt",
    label: t("financialHealthService.debtLabel"),
    score: debtScore,
    explanation:
      netWorth.debts <= 0
        ? t("financialHealthService.debtFree")
        : t("financialHealthService.debtRatio").replace("{percent}", (debtRatio * 100).toFixed(0)),
  });

  // 3. Savings rate
  const savingsScore = clamp((savingsRate / 0.2) * 100);
  subScores.push({
    key: "savings_rate",
    label: t("financialHealthService.savingsRateLabel"),
    score: savingsScore,
    explanation: t("financialHealthService.savingsRateExplanation").replace("{percent}", (savingsRate * 100).toFixed(0)),
  });

  // 4. Liquidity: can income cover expenses + min debt payments?
  const minPayments = totalMinimumPayment(debts);
  const obligations = expenses + minPayments;
  const liquidityRatio = obligations > 0 ? income / obligations : income > 0 ? 2 : 0;
  const liquidityScore = clamp(((liquidityRatio - 1) / 0.5) * 100 + (liquidityRatio >= 1 ? 50 : 0));
  subScores.push({
    key: "liquidity",
    label: t("financialHealthService.liquidityLabel"),
    score: liquidityScore,
    explanation:
      obligations > 0
        ? t("financialHealthService.liquidityExplanation").replace("{percent}", (liquidityRatio * 100).toFixed(0))
        : t("financialHealthService.notEnoughData"),
  });

  // 5. Contracts / fixed costs share (lower share is healthier)
  // Heuristic: BNPL + min payments as a proxy for recurring obligation pressure.
  const fixedPressure = income > 0 ? minPayments / income : minPayments > 0 ? 1 : 0;
  const contractsScore = clamp(100 - fixedPressure * 200);
  subScores.push({
    key: "contracts",
    label: t("financialHealthService.contractsLabel"),
    score: contractsScore,
    explanation:
      minPayments > 0
        ? t("financialHealthService.contractsExplanation").replace("{percent}", (fixedPressure * 100).toFixed(0))
        : t("financialHealthService.noFixedDebtRates"),
  });

  const overall = clamp(
    subScores.reduce((sum, s) => sum + s.score * (WEIGHTS[s.key] || 0), 0)
  );

  return {
    score: overall,
    subScores,
    netWorth,
    monthlyIncome: income,
    monthlyExpenses: expenses,
    savingsRate,
  };
}

export function getHealthLabel(score: number): { label: string; tone: "good" | "ok" | "warn" | "bad" } {
  if (score >= 80) return { label: t("financialHealthService.healthVeryGood"), tone: "good" };
  if (score >= 60) return { label: t("financialHealthService.healthGood"), tone: "ok" };
  if (score >= 40) return { label: t("financialHealthService.healthMindful"), tone: "warn" };
  return { label: t("financialHealthService.healthActionNeeded"), tone: "bad" };
}

export type { Debt };
