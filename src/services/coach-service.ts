"use client";

import type { CoachOverview, CoachRecommendation, BehaviorInsight, CategoryGuidance, RoadmapStage, RoadmapStageKey } from "../types";
import { getTransactions, getCategories } from "./transaction-service";
import { getDebts, getTotalDebt, getTotalMinPayment, calculatePayoffPlan } from "./debt-service";
import { getFinancialHealth } from "./financial-health-service";

function sumMonthlyExpenses(transactions: Awaited<ReturnType<typeof getTransactions>>) {
  return transactions.filter((t) => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
}

function sumMonthlyIncome(transactions: Awaited<ReturnType<typeof getTransactions>>) {
  return transactions.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
}

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
      title: "Starter Emergency Fund",
      order: 1,
      description: "Ein erstes Polster für kleine Überraschungen.",
      whyItMatters: "Damit unerwartete Ausgaben nicht sofort neue Schulden auslösen.",
    },
    consumer_debt_elimination: {
      key,
      title: "Consumer Debt Elimination",
      order: 2,
      description: "Raten, Karten und BNPL systematisch abbauen.",
      whyItMatters: "Jede getilgte Schuld schafft monatlich mehr Spielraum.",
    },
    full_emergency_fund: {
      key,
      title: "Full Emergency Fund",
      order: 3,
      description: "Ein belastbarer Notgroschen für echte Sicherheit.",
      whyItMatters: "Mehr Puffer bedeutet weniger Stress und mehr Stabilität.",
    },
    personal_goals: {
      key,
      title: "Personal Goals",
      order: 4,
      description: "Jetzt werden Lebensziele planbar finanziert.",
      whyItMatters: "Mit Sicherheit im Rücken lassen sich Ziele entspannter erreichen.",
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
  const monthlyIncome = sumMonthlyIncome(transactions);
  const monthlyExpenses = sumMonthlyExpenses(transactions);
  const disposable = Math.max(0, monthlyIncome - monthlyExpenses - minimumMonthlyBurden);
  const emergencyBufferMonths = monthlyExpenses > 0 ? disposable / monthlyExpenses : 0;

  const stageKey = currentStageKey(totalDebt, emergencyBufferMonths);
  const stage = buildStage(stageKey, totalDebt, emergencyBufferMonths);

  const snowball = calculatePayoffPlan(debts, Math.max(minimumMonthlyBurden, minimumMonthlyBurden + disposable), "snowball");
  const avalanche = calculatePayoffPlan(debts, Math.max(minimumMonthlyBurden, minimumMonthlyBurden + disposable), "avalanche");

  const recommendations: CoachRecommendation[] = [];
  if (stageKey === "starter_emergency_fund") {
    recommendations.push({
      id: "build-starter-fund",
      title: "Baue zuerst einen kleinen Notgroschen auf",
      message: "Ziel zuerst: 1 Monatsausgabe als Sicherheitsnetz.",
      reason: "Das schützt vor neuen Schulden bei kleinen Überraschungen.",
      severity: "warning",
      ctaLabel: "Zum Dashboard",
      ctaTo: "/dashboard",
    });
  } else if (stageKey === "consumer_debt_elimination") {
    recommendations.push({
      id: "pay-down-debt",
      title: "Schulden jetzt priorisieren",
      message: snowball.insufficientBudget
        ? "Aktuell reicht dein Budget nicht einmal für alle Mindestraten."
        : `Am schnellsten wirst du mit der ${avalanche.totalMonths <= snowball.totalMonths ? "Avalanche" : "Snowball"}-Strategie schuldenfrei.`,
      reason: "Schulden reduzieren sofort deine monatliche Belastung und erhöhen künftigen Spielraum.",
      severity: "warning",
      ctaLabel: "Schulden ansehen",
      ctaTo: "/debts",
    });
  } else if (stageKey === "full_emergency_fund") {
    recommendations.push({
      id: "grow-buffer",
      title: "Jetzt den vollen Notgroschen aufbauen",
      message: "Halte mehrere Monatsausgaben liquide, bevor du größere Ziele finanzierst.",
      reason: "Das senkt dein Risiko und stabilisiert deinen Cashflow.",
      severity: "info",
      ctaLabel: "Simulation öffnen",
      ctaTo: "/simulation",
    });
  } else {
    recommendations.push({
      id: "fund-goals",
      title: "Deine Ziele sind jetzt dran",
      message: "Stabile Basis vorhanden – richte freie Mittel auf persönliche Ziele aus.",
      reason: "Mit sauberer Basis werden Ziele planbar statt stressig.",
      severity: "success",
      ctaLabel: "Ziele planen",
      ctaTo: "/net-worth",
    });
  }

  const protectedNames = ["groceries", "housing", "insurance", "transport"];
  const categoryGuidance: CategoryGuidance[] = categories.slice(0, 5).map((category, index) => {
    const spend = transactions.filter((t) => (t.category_id || t.subcategory_id) === category.id && t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const status = index < 2 ? "protected" : index < 4 ? "reduce" : "cut";
    const recommendedMax = status === "protected" ? spend * 1.05 : status === "reduce" ? spend * 0.85 : spend * 0.7;
    return {
      categoryId: category.id,
      categoryName: category.name,
      status,
      recommendedMax,
      currentSpend: spend,
      savingsOpportunity: Math.max(0, spend - recommendedMax),
      reason: protectedNames.some((name) => category.name.toLowerCase().includes(name)) ? "Wichtig und geschützt" : status === "cut" ? "Niedrige Priorität im aktuellen Budget" : "Kann leicht reduziert werden",
    };
  });

  const insights: BehaviorInsight[] = [
    {
      id: "spending-pattern",
      title: "Ausgabenmuster im Blick",
      message: health.savingsRate < 0.1 ? "Deine Sparquote ist noch niedrig – kleine Kürzungen wirken hier besonders stark." : "Deine Sparquote ist solide und gibt dir Spielraum für Ziele.",
      severity: health.savingsRate < 0.1 ? "warning" : "success",
    },
    {
      id: "debt-burden",
      title: "Schulden belasten deinen Monatsplan",
      message: totalDebt > 0 ? `Mindestraten von ${minimumMonthlyBurden.toFixed(0)} € blockieren monatlich freien Cashflow.` : "Aktuell drückt keine Schuldenlast auf deinen Plan.",
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