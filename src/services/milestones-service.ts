import type { Milestone } from "../types";
import type {
  MilestoneContext,
  MilestoneDefinition,
  MilestoneStatus,
} from "@/lib/milestone-types";
import { getFinancialHealth } from "./financial-health-service";
import { getDebts } from "./debt-service";
import { mutateLocalFinanceList, readLocalFinanceList } from './local-finance-store';
import { t } from "@/i18n/serviceT";

/**
 * Nicht exportiert (Issue #297): Ausser `evaluateMilestones` weiter unten
 * ruft sie niemand. Ein Export ohne Aufrufer sieht wie eine oeffentliche
 * Zusage aus, die niemand eingeloest hat.
 */
function getMilestoneDefinitions(): MilestoneDefinition[] {
  return [
    {
      key: "emergency_fund_1m",
      title: t('milestones.emergencyFund1mTitle'),
      description: t('milestones.emergencyFund1mDescription'),
      icon: "🌱",
      isAchieved: (c) => c.monthlyExpenses > 0 && c.cash >= c.monthlyExpenses,
      progressOf: (c) =>
        c.monthlyExpenses > 0 ? { amount: Math.max(0, c.cash), target: c.monthlyExpenses, unit: 'euro' } : null,
    },
    {
      key: "emergency_fund_3m",
      title: t('milestones.emergencyFund3mTitle'),
      description: t('milestones.emergencyFund3mDescription'),
      icon: "🛡️",
      isAchieved: (c) => c.monthlyExpenses > 0 && c.cash >= c.monthlyExpenses * 3,
      progressOf: (c) =>
        c.monthlyExpenses > 0 ? { amount: Math.max(0, c.cash), target: c.monthlyExpenses * 3, unit: 'euro' } : null,
    },
    {
      key: "first_debt_paid",
      title: t('milestones.firstDebtPaidTitle'),
      description: t('milestones.firstDebtPaidDescription'),
      icon: "✂️",
      isAchieved: (c) => c.paidOffDebtCount >= 1,
      // Binäres Ziel: quantifizierbar nur, wenn überhaupt Schulden erfasst sind.
      progressOf: (c) =>
        c.debtCount > 0 ? { amount: Math.min(1, c.paidOffDebtCount), target: 1, unit: 'count' } : null,
    },
    {
      key: "net_worth_10k",
      title: t('milestones.netWorth10kTitle'),
      description: t('milestones.netWorth10kDescription'),
      icon: "💎",
      isAchieved: (c) => c.netWorth >= 10000,
      progressOf: (c) => ({ amount: Math.max(0, c.netWorth), target: 10000, unit: 'euro' }),
    },
    {
      key: "debt_free",
      title: t('milestones.debtFreeTitle'),
      description: t('milestones.debtFreeDescription'),
      icon: "🎉",
      isAchieved: (c) => c.debtCount > 0 && c.totalDebt <= 0,
      // Fortschritt = Anteil getilgter Schulden (Anzahl) — die Original-Summen
      // der Schulden sind nicht historisiert, Restsalden wären als "Fortschritt"
      // irreführend (neue Schulden ließen das Ziel rückwärts laufen).
      progressOf: (c) =>
        c.debtCount > 0 ? { amount: c.paidOffDebtCount, target: c.debtCount, unit: 'count' } : null,
    },
  ];
}

export async function getAchievedMilestones(): Promise<Milestone[]> {
  return readLocalFinanceList<Milestone>('milestones');
}

async function markAchieved(key: string): Promise<void> {
  // Serialisiert (Issue #311): Mehrere Meilensteine werden im selben Durchlauf
  // erreicht, und die Aufrufe überlappen sich — ohne Lock überlebte nur einer.
  await mutateLocalFinanceList<Milestone>('milestones', (milestones) => {
    if (milestones.some((item) => item.milestone_key === key)) return milestones;
    return [
      ...milestones,
      {
        id: crypto.randomUUID(),
        user_id: 'local',
        milestone_key: key,
        achieved_at: new Date().toISOString(),
      },
    ];
  });
}


/**
 * Evaluate all milestones against current financial state, persist newly
 * achieved ones, and return their status.
 */
export async function evaluateMilestones(): Promise<MilestoneStatus[]> {
  const [health, debts, achieved] = await Promise.all([
    getFinancialHealth(),
    getDebts(),
    getAchievedMilestones(),
  ]);

  const ctx: MilestoneContext = {
    netWorth: health.netWorth.netWorth,
    cash: health.netWorth.cash,
    monthlyExpenses: health.monthlyExpenses,
    totalDebt: health.netWorth.debts,
    debtCount: debts.length,
    paidOffDebtCount: debts.filter((d) => d.is_paid_off || d.balance <= 0).length,
  };

  const achievedMap = new Map(achieved.map((m) => [m.milestone_key, m]));
  const result: MilestoneStatus[] = [];

  for (const def of getMilestoneDefinitions()) {
    const previously = achievedMap.get(def.key);
    const nowAchieved = def.isAchieved(ctx);
    let justAchieved = false;

    if (nowAchieved && !previously) {
      await markAchieved(def.key);
      justAchieved = true;
    }

    result.push({
      definition: def,
      achieved: nowAchieved || !!previously,
      achievedAt: previously?.achieved_at,
      justAchieved,
      progress: def.progressOf?.(ctx) ?? null,
    });
  }

  return result;
}
