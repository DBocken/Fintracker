import type { CoachOverview, CoachRecommendation, BehaviorInsight, CategoryGuidance, RoadmapStage, RoadmapStageKey } from "../types";
import { getAllTransactions, getCategories } from "./transaction-service";
import { getDebts, calculatePayoffPlan } from "./debt-service";
import { totalOutstandingDebt, totalMinimumPayment } from "@/lib/debt-totals";
import { getFinancialHealth, monthlyAverages } from "./financial-health-service";
import { getLocalUserSettings } from "./local-settings-service";
import { deriveIncomeStreams, type IncomeStream } from "../lib/income-streams";
import { computeTaxReserve, resolveTaxReservePercent } from "../lib/tax-reserve";
import { t } from "../i18n/serviceT";
import type { TutorialChapterId } from "../lib/tutorial-sequence";
import { buildTutorialRecommendation } from "../lib/tutorial-coach";

const formatCurrency = (v: number) =>
  v.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/**
 * Steuer-Puffer-Empfehlung für Creator-/Selbstständigen-Einnahmen. `null`, wenn
 * kein steuerrelevantes Einkommen vorliegt oder der Prozentsatz auf 0 steht.
 */
export function buildTaxReserveRecommendation(
  streams: IncomeStream[],
  percent: number,
): CoachRecommendation | null {
  const reserve = computeTaxReserve(streams, percent);
  if (!reserve) return null;
  return {
    id: "tax-reserve",
    title: t("coachService.recommendations.taxReserveTitle"),
    message: t("coachService.recommendations.taxReserveMessage")
      .replace("{amount}", formatCurrency(reserve.reserveTotal))
      .replace("{percent}", String(reserve.percent)),
    reason: t("coachService.recommendations.taxReserveReason"),
    severity: "info",
    ctaLabel: t("coachService.recommendations.taxReserveCta"),
    ctaTo: "/income",
  };
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

export async function getCoachOverview(options?: {
  includeTaxReserve?: boolean;
  /**
   * Naechstes Tutorial-Kapitel, das etwas zu zeigen hat. Kommt von der
   * Aufrufstelle (`useTutorialRun`), damit der Coach die Datenreife nicht ein
   * zweites Mal erhebt.
   */
  tutorialChapter?: TutorialChapterId | null;
}): Promise<CoachOverview> {
  const [transactions, debts, health, categories] = await Promise.all([
    getAllTransactions(),
    getDebts(),
    getFinancialHealth(),
    getCategories(),
  ]);

  const totalDebt = totalOutstandingDebt(debts);
  const minimumMonthlyBurden = totalMinimumPayment(debts);
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

  // Steuer-Puffer-Empfehlung (nur Premium/Creator-Paket): auf Basis der
  // erkannten Creator-/Selbstständigen-Einnahmen und des konfigurierten Prozents.
  if (options?.includeTaxReserve) {
    const settings = await getLocalUserSettings();
    const streams = deriveIncomeStreams(transactions, categories).streams;
    const taxRec = buildTaxReserveRecommendation(streams, resolveTaxReservePercent(settings));
    if (taxRec) recommendations.push(taxRec);
  }

  // Vertagte Tutorial-Kapitel melden sich hier, sobald ihre Voraussetzung
  // eingetreten ist (`docs/tutorial-sequence.md`, Schritt 5). Bewusst KEIN
  // eigener Posteingang fuers Tutorial: der Coach ist bereits der Ort fuer
  // „das waere jetzt dein naechster Schritt".
  //
  // Das Kapitel kommt von der Aufrufstelle, die es ueber `useTutorialRun`
  // ohnehin schon kennt — genau wie die Tarif-Berechtigung. Wuerde der Coach
  // die Datenreife selbst erheben, laese er Buchungen, Kategorien und Schulden
  // ein zweites Mal und haenge an acht weiteren Services.
  //
  // Bewusst ans ENDE der Liste: eine Fuehrung ist Hilfe, kein Finanzbefund,
  // und darf eine Liquiditaetswarnung nicht verdraengen. Hat der Coach sonst
  // nichts zu sagen — der Fall beim frischen Start —, rueckt sie von selbst
  // an die erste Stelle.
  const tutorialRec = buildTutorialRecommendation(options?.tutorialChapter ?? null);
  if (tutorialRec) recommendations.push(tutorialRec);

  // Geschuetzte Grundbedarfs-Kategorien, adressiert ueber die stabile ID.
  // Vorher stand hier eine Liste ENGLISCHER Woerter, die gegen die deutschen
  // Kategorienamen geprueft wurde — das traf nie zu und war ein stiller
  // Totalausfall dieser Einstufung.
  const protectedCategoryIds = new Set([
    "local-cat-lebensmittel",
    "local-cat-wohnen",
    "local-cat-versicherungen",
    "local-cat-mobilitaet",
  ]);
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
        : protectedCategoryIds.has(category.id) ? t("coachService.categoryGuidance.importantReason") : status === "cut" ? t("coachService.categoryGuidance.lowPriorityReason") : t("coachService.categoryGuidance.reducibleReason"),
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