"use client";

import { supabase } from "../integrations/supabase/client";
import type { Milestone } from "../types";
import { getCurrentUserId } from "./auth-service";
import { getFinancialHealth } from "./financial-health-service";
import { getDebts } from "./debt-service";

export interface MilestoneDefinition {
  key: string;
  title: string;
  description: string;
  icon: string;
  /** Evaluate whether this milestone is currently achieved. */
  isAchieved: (ctx: MilestoneContext) => boolean;
}

interface MilestoneContext {
  netWorth: number;
  cash: number;
  monthlyExpenses: number;
  totalDebt: number;
  debtCount: number;
  paidOffDebtCount: number;
}

export const MILESTONE_DEFINITIONS: MilestoneDefinition[] = [
  {
    key: "emergency_fund_1m",
    title: "Erster Notgroschen",
    description: "Du hast Rücklagen für einen vollen Monat aufgebaut.",
    icon: "🌱",
    isAchieved: (c) => c.monthlyExpenses > 0 && c.cash >= c.monthlyExpenses,
  },
  {
    key: "emergency_fund_3m",
    title: "Notgroschen erreicht",
    description: "Drei Monatsausgaben liegen sicher als Rücklage bereit.",
    icon: "🛡️",
    isAchieved: (c) => c.monthlyExpenses > 0 && c.cash >= c.monthlyExpenses * 3,
  },
  {
    key: "first_debt_paid",
    title: "Erste Schuld abbezahlt",
    description: "Du hast eine deiner Schulden vollständig getilgt.",
    icon: "✂️",
    isAchieved: (c) => c.paidOffDebtCount >= 1,
  },
  {
    key: "net_worth_10k",
    title: "10.000 € Vermögen",
    description: "Dein Nettovermögen hat die 10.000-€-Marke geknackt.",
    icon: "💎",
    isAchieved: (c) => c.netWorth >= 10000,
  },
  {
    key: "debt_free",
    title: "Schuldenfrei!",
    description: "Du hast alle deine Schulden zurückgezahlt. Riesiger Meilenstein!",
    icon: "🎉",
    isAchieved: (c) => c.debtCount > 0 && c.totalDebt <= 0,
  },
];

export async function getAchievedMilestones(): Promise<Milestone[]> {
  const uid = await getCurrentUserId();
  if (!uid) return [];

  const { data, error } = await supabase
    .from("milestones")
    .select("*")
    .eq("user_id", uid);

  if (error) throw new Error(error.message);
  return (data || []) as Milestone[];
}

async function markAchieved(key: string): Promise<void> {
  // Anonymer Modus: kein Supabase-Persist — der Status wird bei jeder
  // Auswertung neu berechnet (lokale Persistenz kommt mit dem Vault, Epic #22).
  const uid = await getCurrentUserId();
  if (!uid) return;
  await supabase
    .from("milestones")
    .upsert({ user_id: uid, milestone_key: key }, { onConflict: "user_id,milestone_key" });
}

export interface MilestoneStatus {
  definition: MilestoneDefinition;
  achieved: boolean;
  achievedAt?: string;
  /** True if this was newly achieved during this evaluation. */
  justAchieved: boolean;
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

  for (const def of MILESTONE_DEFINITIONS) {
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
    });
  }

  return result;
}
