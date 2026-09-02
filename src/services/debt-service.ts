import type { Debt, DebtPriority, DebtType } from "../types";
import type { DebtTransactionAssignment } from "@/lib/debt-types";
import { getCurrentUserId } from "./auth-service";
import { getAllTransactions } from "./transaction-service";
import { t } from "../i18n/serviceT";
import {
  calculatePayoffPlan,
  type PayoffPlan,
  type PayoffStep,
  type PayoffStrategy,
} from "@/lib/debt-payoff";

// Die Rechnung liegt in `lib`; der Re-Export haelt jede Importstelle gueltig.
export { calculatePayoffPlan };
export type { PayoffPlan, PayoffStep, PayoffStrategy };
import {
  deleteLocalFinanceItem,
  mutateLocalFinanceList,
  readLocalFinanceList,
  updateLocalFinanceItem,
  upsertLocalFinanceItem,
} from "./local-finance-store";

/** Übersetzte Anzeige-Labels je Schuldenart — als Funktion, damit sie die aktuelle Sprache widerspiegeln. */
export function getDebtTypeLabels(): Record<DebtType, string> {
  return {
    credit_card: t("debtService.typeCreditCard"),
    bnpl: t("debtService.typeBnpl"),
    installment: t("debtService.typeInstallment"),
    overdraft: t("debtService.typeOverdraft"),
    private_loan: t("debtService.typePrivateLoan"),
    car_loan: t("debtService.typeCarLoan"),
    student_loan: t("debtService.typeStudentLoan"),
    mortgage: t("debtService.typeMortgage"),
    other: t("debtService.typeOther"),
  };
}

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

/** Übersetzte Prioritäts-Labels — als Funktion, damit sie die aktuelle Sprache widerspiegeln. */
export function getDebtPriorityLabels(): Record<DebtPriority, string> {
  return {
    existenzsichernd: t("debtService.priorityExistential"),
    normal: t("debtService.priorityNormal"),
  };
}

/**
 * Warum existenzsichernde Rückstände immer zuerst kommen — Standard-Wissen
 * der Schuldnerberatung, als Erklärtext fürs UI (#51).
 */
export function getExistentialPriorityExplanation(): string {
  return t("debtService.existentialPriorityExplanation");
}

/** Gläubiger-Muster, die auf existenzsichernde Schulden hindeuten. */
const EXISTENTIAL_CREDITOR_RE =
  /(miete|vermiet|wohnung|hausverwaltung|immobilien|wohnbau|wbg|gwg|stadtwerke|energie|strom|gas|fernw[äa]rme|wasser(werk)?|vattenfall|e\.?on|enbw|rwe|unterhalt|jugendamt|jobcenter)/i;

/**
 * Schlägt bei der Forderungsakten-Übernahme automatisch eine Priorität vor
 * (Vermieter, Stadtwerke/Energie, Unterhaltskasse → existenzsichernd).
 */
export function suggestDebtPriority(creditorOrName: string | null | undefined): DebtPriority {
  if (creditorOrName && EXISTENTIAL_CREDITOR_RE.test(creditorOrName)) return "existenzsichernd";
  return "normal";
}

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
    name: debt.name || t("debtService.defaultDebtName"),
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
    priority: debt.priority ?? "normal",
    created_at: debt.created_at ?? now,
    updated_at: debt.updated_at ?? now,
  });
}

export async function updateDebt(debt: Partial<Debt> & { id: string }): Promise<Debt> {
  return updateLocalFinanceItem<Debt>("debts", debt.id, debt);
}

export async function deleteDebt(id: string): Promise<void> {
  await deleteLocalFinanceItem<Debt>("debts", id);
  await mutateLocalFinanceList<DebtTransactionAssignment>("debtAssignments", (assignments) =>
    assignments.filter((assignment) => assignment.debt_id !== id),
  );
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
  if (!debt) throw new Error(t("debtService.debtNotFound"));

  const transaction = (await getAllTransactions()).find((entry) => entry.id === params.transactionId);
  if (!transaction) throw new Error(t("debtService.transactionNotFound"));

  const amount = Math.abs(Number(transaction.amount) || 0);
  if (amount <= 0 || Number(transaction.amount) >= 0) {
    throw new Error(t("debtService.onlyDebitsAllowed"));
  }

  const assignment: DebtTransactionAssignment = {
    id: crypto.randomUUID(),
    user_id: await localUserId(),
    debt_id: params.debtId,
    transaction_id: params.transactionId,
    amount,
    created_at: new Date().toISOString(),
  };

  // Die Dublettenprüfung liegt INNERHALB des Locks (Issue #311): Stünde sie
  // davor, könnten zwei gleichzeitige Zuordnungen derselben Buchung beide an
  // ihr vorbeikommen — die Prüfung wäre dann Zierde, keine Zusicherung.
  await mutateLocalFinanceList<DebtTransactionAssignment>("debtAssignments", (assignments) => {
    if (assignments.some((entry) => entry.transaction_id === params.transactionId)) {
      throw new Error(t("debtService.alreadyAssigned"));
    }
    return [assignment, ...assignments];
  });

  const newBalance = Math.max(0, Number(debt.balance) - amount);
  await updateDebt({ id: params.debtId, balance: newBalance, is_paid_off: newBalance <= 0 });

  return assignment;
}

export async function unassignDebtTransaction(assignmentId: string): Promise<void> {
  const entfernt: { zuordnung: DebtTransactionAssignment | null } = { zuordnung: null };
  await mutateLocalFinanceList<DebtTransactionAssignment>("debtAssignments", (assignments) => {
    const gefunden = assignments.find((entry) => entry.id === assignmentId);
    if (!gefunden) throw new Error(t("debtService.assignmentNotFound"));
    entfernt.zuordnung = gefunden;
    return assignments.filter((entry) => entry.id !== assignmentId);
  });
  const assignment = entfernt.zuordnung;
  if (!assignment) return;

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
