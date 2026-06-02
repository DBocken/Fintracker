"use client";

import { supabase } from "../integrations/supabase/client";
import type { Debt, DebtType } from "../types";
import { getCurrentUserId, requireUserId } from "./auth-service";

export const DEBT_TYPE_LABELS: Record<DebtType, string> = {
  credit_card: "Kreditkarte",
  bnpl: "Buy Now, Pay Later",
  installment: "Ratenkauf",
  overdraft: "Dispo",
  private_loan: "Privatdarlehen",
  car_loan: "Autokredit",
  student_loan: "Studienkredit",
  mortgage: "Immobilienkredit",
  other: "Sonstige Schuld",
};

export const DEBT_TYPE_ICONS: Record<DebtType, string> = {
  credit_card: "💳",
  bnpl: "🛍️",
  installment: "📦",
  overdraft: "🏦",
  private_loan: "🤝",
  car_loan: "🚗",
  student_loan: "🎓",
  mortgage: "🏠",
  other: "💸",
};

/** Known BNPL providers used for heuristic detection. */
export const BNPL_PROVIDERS = [
  "klarna",
  "paypal",
  "ratepay",
  "afterpay",
  "amazon raten",
  "amazon monatsabrechnung",
  "billie",
  "easycredit",
];

// -----------------------------------------------------------------------------
// CRUD
// -----------------------------------------------------------------------------

export async function getDebts(): Promise<Debt[]> {
  const uid = await getCurrentUserId();
  if (!uid) return [];

  const { data, error } = await supabase
    .from("debts")
    .select("*")
    .eq("user_id", uid)
    .order("balance", { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []) as Debt[];
}

export async function createDebt(debt: Partial<Debt>): Promise<Debt> {
  const uid = await requireUserId();

  const payload = {
    user_id: uid,
    name: debt.name || "Neue Schuld",
    type: debt.type || "other",
    balance: debt.balance ?? 0,
    original_amount: debt.original_amount ?? debt.balance ?? 0,
    interest_rate: debt.interest_rate ?? 0,
    min_payment: debt.min_payment ?? 0,
    due_day: debt.due_day ?? null,
    due_date: debt.due_date ?? null,
    is_bnpl: debt.is_bnpl ?? debt.type === "bnpl",
    provider: debt.provider ?? null,
    notes: debt.notes ?? null,
    is_paid_off: debt.is_paid_off ?? false,
  };

  const { data, error } = await supabase
    .from("debts")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as Debt;
}

export async function updateDebt(debt: Partial<Debt> & { id: string }): Promise<Debt> {
  const uid = await requireUserId();

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const keys: (keyof Debt)[] = [
    "name",
    "type",
    "balance",
    "original_amount",
    "interest_rate",
    "min_payment",
    "due_day",
    "due_date",
    "is_bnpl",
    "provider",
    "notes",
    "is_paid_off",
  ];
  for (const k of keys) {
    if (debt[k] !== undefined) payload[k] = debt[k];
  }

  const { data, error } = await supabase
    .from("debts")
    .update(payload)
    .eq("id", debt.id)
    .eq("user_id", uid)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as Debt;
}

export async function deleteDebt(id: string): Promise<void> {
  const uid = await requireUserId();
  const { error } = await supabase
    .from("debts")
    .delete()
    .eq("id", id)
    .eq("user_id", uid);
  if (error) throw new Error(error.message);
}

// -----------------------------------------------------------------------------
// Aggregations
// -----------------------------------------------------------------------------

export function getTotalDebt(debts: Debt[]): number {
  return debts
    .filter((d) => !d.is_paid_off)
    .reduce((sum, d) => sum + Math.max(0, d.balance), 0);
}

export function getTotalMinPayment(debts: Debt[]): number {
  return debts
    .filter((d) => !d.is_paid_off)
    .reduce((sum, d) => sum + Math.max(0, d.min_payment), 0);
}

// -----------------------------------------------------------------------------
// Payoff strategies (Snowball / Avalanche) — pure TypeScript
// -----------------------------------------------------------------------------

export type PayoffStrategy = "snowball" | "avalanche";

export interface PayoffStep {
  debtId: string;
  name: string;
  balance: number;
  interestRate: number;
  monthsToPayoff: number;
  totalInterestPaid: number;
  priorityOrder: number;
}

export interface PayoffPlan {
  strategy: PayoffStrategy;
  steps: PayoffStep[];
  totalMonths: number;
  totalInterestPaid: number;
  /** True if the provided budget cannot even cover minimum payments. */
  insufficientBudget: boolean;
}

/**
 * Simulate paying off debts using the snowball (lowest balance first) or
 * avalanche (highest interest first) strategy.
 *
 * @param debts active debts
 * @param monthlyBudget total amount available for debt repayment per month
 */
export function calculatePayoffPlan(
  debts: Debt[],
  monthlyBudget: number,
  strategy: PayoffStrategy
): PayoffPlan {
  const active = debts
    .filter((d) => !d.is_paid_off && d.balance > 0)
    .map((d) => ({
      id: d.id,
      name: d.name,
      initialBalance: Math.max(0, d.balance),
      balance: Math.max(0, d.balance),
      annualRate: Math.max(0, d.interest_rate),
      rate: Math.max(0, d.interest_rate) / 100 / 12,
      min: Math.max(0, d.min_payment),
      monthsToPayoff: 0,
      interestPaid: 0,
    }));

  const totalMin = active.reduce((s, d) => s + d.min, 0);

  const priority = [...active].sort((a, b) => {
    if (strategy === "snowball") {
      return a.initialBalance - b.initialBalance || b.annualRate - a.annualRate;
    }
    return b.annualRate - a.annualRate || a.initialBalance - b.initialBalance;
  });

  const priorityOrder = new Map(priority.map((d, index) => [d.id, index + 1]));

  if (active.length === 0) {
    return {
      strategy,
      steps: [],
      totalMonths: 0,
      totalInterestPaid: 0,
      insufficientBudget: false,
    };
  }

  if (monthlyBudget < totalMin) {
    return {
      strategy,
      steps: priority.map((d) => ({
        debtId: d.id,
        name: d.name,
        balance: d.initialBalance,
        interestRate: d.annualRate,
        monthsToPayoff: 0,
        totalInterestPaid: 0,
        priorityOrder: priorityOrder.get(d.id) || 0,
      })),
      totalMonths: 0,
      totalInterestPaid: 0,
      insufficientBudget: true,
    };
  }

  let month = 0;
  const maxMonths = 1200; // 100 years safety cap

  while (active.some((d) => d.balance > 0.01) && month < maxMonths) {
    month += 1;

    for (const d of active) {
      if (d.balance <= 0) continue;
      const interest = d.balance * d.rate;
      d.balance += interest;
      d.interestPaid += interest;
    }

    let budget = monthlyBudget;
    for (const d of active) {
      if (d.balance <= 0) continue;
      const pay = Math.min(d.min, d.balance);
      d.balance -= pay;
      budget -= pay;
    }

    for (const focus of priority) {
      const d = active.find((x) => x.id === focus.id);
      if (!d || d.balance <= 0) continue;
      if (budget <= 0) break;
      const pay = Math.min(budget, d.balance);
      d.balance -= pay;
      budget -= pay;
    }

    for (const d of active) {
      if (d.balance <= 0.01 && d.monthsToPayoff === 0) {
        d.monthsToPayoff = month;
      }
    }
  }

  const byId = new Map(active.map((d) => [d.id, d]));
  const steps: PayoffStep[] = priority.map((p) => {
    const d = byId.get(p.id)!;
    return {
      debtId: d.id,
      name: d.name,
      balance: d.initialBalance,
      interestRate: d.annualRate,
      monthsToPayoff: d.monthsToPayoff || month,
      totalInterestPaid: Math.round(d.interestPaid * 100) / 100,
      priorityOrder: priorityOrder.get(d.id) || 0,
    };
  });

  return {
    strategy,
    steps,
    totalMonths: month,
    totalInterestPaid: Math.round(steps.reduce((s, x) => s + x.totalInterestPaid, 0) * 100) / 100,
    insufficientBudget: false,
  };
}

export interface DebtTransactionAssignment {
  id: string;
  user_id: string;
  debt_id: string;
  transaction_id: string;
  amount: number;
  created_at: string;
}

export async function getDebtTransactionAssignments(): Promise<DebtTransactionAssignment[]> {
  const uid = await getCurrentUserId();
  if (!uid) return [];

  const { data, error } = await supabase
    .from("debt_transaction_assignments")
    .select("*")
    .eq("user_id", uid)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []) as DebtTransactionAssignment[];
}

export async function assignTransactionToDebt(params: {
  debtId: string;
  transactionId: string;
}): Promise<DebtTransactionAssignment> {
  const uid = await requireUserId();

  const { data: debt, error: debtError } = await supabase
    .from("debts")
    .select("id, balance")
    .eq("id", params.debtId)
    .eq("user_id", uid)
    .single();

  if (debtError) throw new Error(debtError.message);

  const { data: transaction, error: transactionError } = await supabase
    .from("transactions")
    .select("id, amount")
    .eq("id", params.transactionId)
    .eq("user_id", uid)
    .single();

  if (transactionError) throw new Error(transactionError.message);

  const amount = Math.abs(Number(transaction.amount) || 0);
  if (amount <= 0 || Number(transaction.amount) >= 0) {
    throw new Error("Nur Abbuchungen können einer Schuld als Tilgung zugewiesen werden.");
  }

  const { data: existingAssignment, error: existingError } = await supabase
    .from("debt_transaction_assignments")
    .select("id")
    .eq("user_id", uid)
    .eq("transaction_id", params.transactionId)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (existingAssignment) {
    throw new Error("Diese Abbuchung ist bereits einer Schuld zugewiesen.");
  }

  const { data, error } = await supabase
    .from("debt_transaction_assignments")
    .insert({
      user_id: uid,
      debt_id: params.debtId,
      transaction_id: params.transactionId,
      amount,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  const newBalance = Math.max(0, Number(debt.balance) - amount);
  const { error: updateError } = await supabase
    .from("debts")
    .update({
      balance: newBalance,
      is_paid_off: newBalance <= 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.debtId)
    .eq("user_id", uid);

  if (updateError) throw new Error(updateError.message);

  return data as DebtTransactionAssignment;
}

export async function unassignDebtTransaction(assignmentId: string): Promise<void> {
  const uid = await requireUserId();

  const { data: assignment, error: assignmentError } = await supabase
    .from("debt_transaction_assignments")
    .select("*")
    .eq("id", assignmentId)
    .eq("user_id", uid)
    .single();

  if (assignmentError) throw new Error(assignmentError.message);

  const { data: debt, error: debtError } = await supabase
    .from("debts")
    .select("id, balance, original_amount")
    .eq("id", assignment.debt_id)
    .eq("user_id", uid)
    .single();

  if (debtError) throw new Error(debtError.message);

  const { error: deleteError } = await supabase

    .from("debt_transaction_assignments")
    .delete()
    .eq("id", assignmentId)
    .eq("user_id", uid);

  if (deleteError) throw new Error(deleteError.message);

  const originalAmount = debt.original_amount === null || debt.original_amount === undefined
    ? null
    : Number(debt.original_amount);
  const restoredBalance = Number(debt.balance) + Number(assignment.amount);
  const cappedBalance = originalAmount && originalAmount > 0 ? Math.min(restoredBalance, originalAmount) : restoredBalance;
  const { error: updateError } = await supabase
    .from("debts")
    .update({
      balance: cappedBalance,
      is_paid_off: false,
      updated_at: new Date().toISOString(),
    })

    .eq("id", assignment.debt_id)
    .eq("user_id", uid);

  if (updateError) throw new Error(updateError.message);
}

export type { Debt } from "../types";
