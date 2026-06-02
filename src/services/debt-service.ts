"use client";

import type { Debt, DebtType } from "../types";
import { getCurrentUserId } from "./auth-service";
import { getTransactions } from "./transaction-service";
import {
  deleteLocalFinanceItem,
  readLocalFinanceList,
  updateLocalFinanceItem,
  upsertLocalFinanceItem,
  writeLocalFinanceList,
} from "./local-finance-store";

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

async function localUserId(): Promise<string> {
  return (await getCurrentUserId()) || "local";
}

export async function getDebts(): Promise<Debt[]> {
  const debts = await readLocalFinanceList<Debt>("debts");
  return debts.sort((a, b) => Number(b.balance) - Number(a.balance));
}

export async function createDebt(debt: Partial<Debt>): Promise<Debt> {
  const now = new Date().toISOString();
  return upsertLocalFinanceItem<Debt>("debts", {
    id: debt.id || crypto.randomUUID(),
    user_id: await localUserId(),
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
    created_at: debt.created_at ?? now,
    updated_at: debt.updated_at ?? now,
  });
}

export async function updateDebt(debt: Partial<Debt> & { id: string }): Promise<Debt> {
  return updateLocalFinanceItem<Debt>("debts", debt.id, debt);
}

export async function deleteDebt(id: string): Promise<void> {
  await deleteLocalFinanceItem<Debt>("debts", id);
  const assignments = await readLocalFinanceList<DebtTransactionAssignment>("debtAssignments");
  await writeLocalFinanceList("debtAssignments", assignments.filter((assignment) => assignment.debt_id !== id));
}

export function getTotalDebt(debts: Debt[]): number {
  return debts.filter((d) => !d.is_paid_off).reduce((sum, d) => sum + Math.max(0, d.balance), 0);
}

export function getTotalMinPayment(debts: Debt[]): number {
  return debts.filter((d) => !d.is_paid_off).reduce((sum, d) => sum + Math.max(0, d.min_payment), 0);
}

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
  insufficientBudget: boolean;
}

export function calculatePayoffPlan(
  debts: Debt[],
  monthlyBudget: number,
  strategy: PayoffStrategy,
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
    if (strategy === "snowball") return a.initialBalance - b.initialBalance || b.annualRate - a.annualRate;
    return b.annualRate - a.annualRate || a.initialBalance - b.initialBalance;
  });
  const priorityOrder = new Map(priority.map((d, index) => [d.id, index + 1]));

  if (active.length === 0) {
    return { strategy, steps: [], totalMonths: 0, totalInterestPaid: 0, insufficientBudget: false };
  }
  if (monthlyBudget + 0.01 < totalMin) {
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
  while (active.some((d) => d.balance > 0.01) && month < 600) {
    month += 1;

    for (const d of active) {
      if (d.balance <= 0.01) continue;
      const interest = d.balance * d.rate;
      d.balance += interest;
      d.interestPaid += interest;
    }

    let remainingBudget = monthlyBudget;
    for (const d of active) {
      if (d.balance <= 0.01) continue;
      const payment = Math.min(d.balance, d.min);
      d.balance -= payment;
      remainingBudget -= payment;
      if (d.balance <= 0.01 && !d.monthsToPayoff) d.monthsToPayoff = month;
    }

    for (const target of priority) {
      if (remainingBudget <= 0.01) break;
      if (target.balance <= 0.01) continue;
      const extra = Math.min(target.balance, remainingBudget);
      target.balance -= extra;
      remainingBudget -= extra;
      if (target.balance <= 0.01 && !target.monthsToPayoff) target.monthsToPayoff = month;
    }
  }

  const steps = priority.map((d) => ({
    debtId: d.id,
    name: d.name,
    balance: d.initialBalance,
    interestRate: d.annualRate,
    monthsToPayoff: d.monthsToPayoff || month,
    totalInterestPaid: Math.round(d.interestPaid * 100) / 100,
    priorityOrder: priorityOrder.get(d.id) || 0,
  }));

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
  const assignments = await readLocalFinanceList<DebtTransactionAssignment>("debtAssignments");
  return assignments.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
}

export async function assignTransactionToDebt(params: {
  debtId: string;
  transactionId: string;
}): Promise<DebtTransactionAssignment> {
  const debts = await getDebts();
  const debt = debts.find((entry) => entry.id === params.debtId);
  if (!debt) throw new Error("Schuld nicht gefunden");

  const transaction = (await getTransactions(10000)).find((entry) => entry.id === params.transactionId);
  if (!transaction) throw new Error("Transaktion nicht gefunden");

  const amount = Math.abs(Number(transaction.amount) || 0);
  if (amount <= 0 || Number(transaction.amount) >= 0) {
    throw new Error("Nur Abbuchungen können einer Schuld als Tilgung zugewiesen werden.");
  }

  const assignments = await readLocalFinanceList<DebtTransactionAssignment>("debtAssignments");
  if (assignments.some((assignment) => assignment.transaction_id === params.transactionId)) {
    throw new Error("Diese Abbuchung ist bereits einer Schuld zugewiesen.");
  }

  const assignment: DebtTransactionAssignment = {
    id: crypto.randomUUID(),
    user_id: await localUserId(),
    debt_id: params.debtId,
    transaction_id: params.transactionId,
    amount,
    created_at: new Date().toISOString(),
  };
  await writeLocalFinanceList("debtAssignments", [assignment, ...assignments]);

  const newBalance = Math.max(0, Number(debt.balance) - amount);
  await updateDebt({ id: params.debtId, balance: newBalance, is_paid_off: newBalance <= 0 });

  return assignment;
}

export async function unassignDebtTransaction(assignmentId: string): Promise<void> {
  const assignments = await readLocalFinanceList<DebtTransactionAssignment>("debtAssignments");
  const assignment = assignments.find((entry) => entry.id === assignmentId);
  if (!assignment) throw new Error("Zuweisung nicht gefunden");

  await writeLocalFinanceList("debtAssignments", assignments.filter((entry) => entry.id !== assignmentId));

  const debts = await getDebts();
  const debt = debts.find((entry) => entry.id === assignment.debt_id);
  if (!debt) return;

  const originalAmount = debt.original_amount === null || debt.original_amount === undefined
    ? null
    : Number(debt.original_amount);
  const restoredBalance = Number(debt.balance) + Number(assignment.amount);
  const cappedBalance = originalAmount && originalAmount > 0 ? Math.min(restoredBalance, originalAmount) : restoredBalance;
  await updateDebt({ id: assignment.debt_id, balance: cappedBalance, is_paid_off: false });
}

export type { Debt } from "../types";
