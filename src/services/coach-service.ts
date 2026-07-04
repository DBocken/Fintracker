import type { CoachOverview, CoachRecommendation, BehaviorInsight, CategoryGuidance, RoadmapStage, RoadmapStageKey } from "../types";
import { getTransactions, getCategories } from "./transaction-service";
import { getDebts, getTotalDebt, getTotalMinPayment, calculatePayoffPlan } from "./debt-service";
import { getFinancialHealth, monthlyAverages } from "./financial-health-service";
import { t } from "../i18n/serviceT";

function currentStageKey(totalDebt: number, emergencyBufferMonths: number): RoadmapStageKey {
  if (emergencyBufferMonths < 1) return "starter_emergency_fund";
  if (totalDebt > 0) return "consumer_debt_elimination";
  if (emergencyBufferMonths < 3) return "full_emergency_fund";
  return "personal_goals";
}

function buildStage(key: RoadmapStageKey, totalDebt: number, emergencyBufferMonths: number): RoadmapStage {
  const config: Record<RoadmapStageKey, Omit<RoadmapStage, "progress" | "status">> = {
    starter_emergency_fund: {
      key,
      title: t("coachService.stages.starterEmergencyFund.title"),
      order: 1,
      description: t("coachService.stages.starterEmergencyFund.description"),
      whyItMatters: t("coachService.stages.starterEmergencyFund.whyItMatters"),
    },
    consumer_debt_elimination: {
      key,
      title: t("coachService.stages.consumerDebtElimination.title"),
      order: 2,
      description: t("coachService.stages.consumerDebtElimination.description"),
      whyItMatters: t("coachService.stages.consumerDebtElimination.whyItMatters"),
    },
    full_emergency_fund: {
      key,
      title: t("coachService.stages.fullEmergencyFund.title"),
      order: 3,
      description: t("coachService.stages.fullEmergencyFund.description"),
      whyItMatters: t("coachService.stages.fullEmergencyFund.whyItMatters"),
    },
    personal_goals: {
      key,
      title: t("coachService.stages.personalGoals.title"),
      order: 4,
      description: t("coachService.stages.personalGoals.description"),
      whyItMatters: t("coachService.stages.personalGoals.whyItMatters"),
    },
  };
  const progress = key === "starter_emergency_fund" ? Math.min(1, emergencyBufferMonths / 1) : key === "consumer_debt_elimination" ? Math.min(1, totalDebt > 0 ? 0.5 : 1) : key === "full_emergency_fund" ? Math.min(1, emergencyBufferMonths / 3) : 0.4;
  return { ...config[key], progress, status: progress >= 1 ? "completed" : key === currentStageKey(totalDebt, emergencyBufferMonths) ? "active" : "locked" };
}

export async function getCoachOverview(): Promise<CoachOverview> {
  const [transactions, debts, health, categories] = await Promise.all([
    getTransactions(10000),
    getDebts(),
    getFinancialHealth(),
    getCategories(),
  ]);

  const totalDebt = getTotalDebt(debts);
  const minimumMonthlyBurden = getTotalMinPayment(debts);
  // Monatswerte als Durchschnitt der letzten 3 Monate (nicht die All-time-Summe
  // als „Monat" missdeuten) — dieselbe Quelle wie der Health-Score (F-UX-3).
  const { income: monthlyIncome, expenses: monthlyExpenses } = monthlyAverages(transactions, 3);
  const disposable = Math.max(0, monthlyIncome - monthlyExpenses - minimumMonthlyBurden);
  // Der Notgroschen misst die tatsächliche Liquiditätsreserve (Cash), nicht den
  // monatlichen Cashflow — konsistent mit financial-health-service.
  const cashReserve = health.netWorth.cash;
  const emergencyBufferMonths = monthlyExpenses > 0 ? cashReserve / monthlyExpenses : cashReserve > 0 ? 6 : 0;

  const stageKey = currentStageKey(totalDebt, emergencyBufferMonths);
  const stage = buildStage(stageKey, totalDebt, emergencyBufferMonths);

  const snowball = calculatePayoffPlan(debts, Math.max(minimumMonthlyBurden, minimumMonthlyBurden + disposable), "snowball");
  const avalanche = calculatePayoffPlan(debts, Math.max(minimumMonthlyBurden, minimumMonthlyBurden + disposable), "avalanche");

  const recommendations: CoachRecommendation[] = [];
  if (stageKey === "starter_emergency_fund") {
    recommendations.push({
      id: "build-starter-fund",
      title: t("coachService.recommendations.buildStarterFundTitle"),
      message: t("coachService.recommendations.buildStarterFundMessage"),
      reason: t("coachService.recommendations.buildStarterFundReason"),
      severity: "warning",
      ctaLabel: t("coachService.recommendations.ctaDashboard"),
      ctaTo: "/dashboard",
    });
  } else if (stageKey === "consumer_debt_elimination") {
    // Existenzsichernde Rückstände gehen jeder Strategie-Empfehlung vor (#51).
    const existential = debts.find(
      (d) => !d.is_paid_off && d.balance > 0 && d.priority === "existenzsichernd",
    );
    if (existential) {
      recommendations.push({
        id: "secure-essentials-first",
        title: t("coachService.recommendations.secureEssentialsTitle"),
        message: t("coachService.recommendations.secureEssentialsMessage").replace("{name}", existential.name),
        reason: t("coachService.recommendations.secureEssentialsReason"),
        severity: "warning",
        ctaLabel: t("coachService.recommendations.ctaDebts"),
        ctaTo: "/debts",
      });
    }
    recommendations.push({
      id: "pay-down-debt",
      title: t("coachService.recommendations.payDownDebtTitle"),
      message: snowball.insufficientBudget
        ? t("coachService.recommendations.payDownDebtInsufficientBudget")
        : t("coachService.recommendations.payDownDebtMessage").replace("{strategy}", avalanche.totalMonths <= snowball.totalMonths ? "Avalanche" : "Snowball"),
      reason: t("coachService.recommendations.payDownDebtReason"),
      severity: "warning",
      ctaLabel: t("coachService.recommendations.ctaDebts"),
      ctaTo: "/debts",
    });
  } else if (stageKey === "full_emergency_fund") {
    recommendations.push({
      id: "grow-buffer",
      title: t("coachService.recommendations.growBufferTitle"),
      message: t("coachService.recommendations.growBufferMessage"),
      reason: t("coachService.recommendations.growBufferReason"),
      severity: "info",
      ctaLabel: t("coachService.recommendations.ctaSimulation"),
      ctaTo: "/simulation",
    });
  } else {
    recommendations.push({
      id: "fund-goals",
      title: t("coachService.recommendations.fundGoalsTitle"),
      message: t("coachService.recommendations.fundGoalsMessage"),
      reason: t("coachService.recommendations.fundGoalsReason"),
      severity: "success",
      ctaLabel: t("coachService.recommendations.ctaGoals"),
      ctaTo: "/net-worth",
    });
  }

  const protectedNames = ["groceries", "housing", "insurance", "transport"];
  // Verträge sind preisgebunden und nicht frei kürzbar (Audit P2-UX U5) – sie
  // werden als geschützt behandelt mit einem Hinweis auf Kündigung/Wechsel,
  // statt eine prozentuale Reduktion vorzuschlagen.
  const isContractCategory = (category: (typeof categories)[number]) =>
    category.attributes?.ist_vertrag === true;
  const categoryGuidance: CategoryGuidance[] = categories.slice(0, 5).map((category, index) => {
    const spend = transactions.filter((t) => (t.category_id || t.subcategory_id) === category.id && t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const contract = isContractCategory(category);
    const status = contract ? "protected" : index < 2 ? "protected" : index < 4 ? "reduce" : "cut";
    const recommendedMax = status === "protected" ? spend * 1.05 : status === "reduce" ? spend * 0.85 : spend * 0.7;
    return {
      categoryId: category.id,
      categoryName: category.name,
      status,
      recommendedMax,
      currentSpend: spend,
      savingsOpportunity: Math.max(0, spend - recommendedMax),
      reason: contract
        ? t("coachService.categoryGuidance.contractReason")
        : protectedNames.some((name) => category.name.toLowerCase().includes(name)) ? t("coachService.categoryGuidance.importantReason") : status === "cut" ? t("coachService.categoryGuidance.lowPriorityReason") : t("coachService.categoryGuidance.reducibleReason"),
    };
  });

  const insights: BehaviorInsight[] = [
    {
      id: "spending-pattern",
      title: t("coachService.insights.spendingPatternTitle"),
      message: health.savingsRate < 0.1 ? t("coachService.insights.spendingPatternLow") : t("coachService.insights.spendingPatternGood"),
      severity: health.savingsRate < 0.1 ? "warning" : "success",
    },
    {
      id: "debt-burden",
      title: t("coachService.insights.debtBurdenTitle"),
      message: totalDebt > 0 ? t("coachService.insights.debtBurdenActive").replace("{amount}", minimumMonthlyBurden.toFixed(0)) : t("coachService.insights.debtBurdenNone"),
      severity: totalDebt > 0 ? "warning" : "success",
    },
  ];

  return {
    stage,
    recommendations,
    goals: [],
    categoryGuidance,
    debtSummary: {
      totalDebt,
      minimumMonthlyBurden,
      snowballMonths: snowball.totalMonths,
      avalancheMonths: avalanche.totalMonths,
      preferredStrategy: avalanche.totalMonths <= snowball.totalMonths ? "avalanche" : "snowball",
    },
    insights,
  };
}