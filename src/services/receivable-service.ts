import type {
  Receivable,
  ReceivableTransactionAssignment,
  ReceivableType,
  Transaction,
} from "../types";
import { getCurrentUserId } from "./auth-service";
import { getTransactions } from "./transaction-service";
import { normalizeMerchantName } from "./merchant-normalization";
import {
  deleteLocalFinanceItem,
  readLocalFinanceList,
  updateLocalFinanceItem,
  upsertLocalFinanceItem,
  writeLocalFinanceList,
} from "./local-finance-store";

export const RECEIVABLE_TYPE_LABELS: Record<ReceivableType, string> = {
  private_loan: "Privat verliehen",
  shared_expense: "Geteilte Ausgabe",
  deposit: "Kaution / Pfand",
  other: "Sonstige Forderung",
};

export const RECEIVABLE_TYPE_ICONS: Record<ReceivableType, string> = {
  private_loan: "🤝",
  shared_expense: "🧾",
  deposit: "🔑",
  other: "💶",
};

async function localUserId(): Promise<string> {
  return (await getCurrentUserId()) || "local";
}

export async function getReceivables(): Promise<Receivable[]> {
  const receivables = await readLocalFinanceList<Receivable>("receivables");
  return receivables.sort((a, b) => Number(b.amount) - Number(a.amount));
}

export async function createReceivable(receivable: Partial<Receivable>): Promise<Receivable> {
  const now = new Date().toISOString();
  return upsertLocalFinanceItem<Receivable>("receivables", {
    id: receivable.id || crypto.randomUUID(),
    user_id: await localUserId(),
    name: receivable.name || "Neue Forderung",
    debtor: receivable.debtor ?? null,
    type: receivable.type || "private_loan",
    amount: receivable.amount ?? 0,
    original_amount: receivable.original_amount ?? receivable.amount ?? 0,
    is_cash: receivable.is_cash ?? false,
    due_date: receivable.due_date ?? null,
    notes: receivable.notes ?? null,
    is_settled: receivable.is_settled ?? false,
    created_at: receivable.created_at ?? now,
    updated_at: receivable.updated_at ?? now,
  });
}

export async function updateReceivable(
  receivable: Partial<Receivable> & { id: string },
): Promise<Receivable> {
  return updateLocalFinanceItem<Receivable>("receivables", receivable.id, receivable);
}

export async function deleteReceivable(id: string): Promise<void> {
  await deleteLocalFinanceItem<Receivable>("receivables", id);
  const assignments = await readLocalFinanceList<ReceivableTransactionAssignment>("receivableAssignments");
  await writeLocalFinanceList(
    "receivableAssignments",
    assignments.filter((assignment) => assignment.receivable_id !== id),
  );
}

export function getTotalReceivables(receivables: Receivable[]): number {
  return receivables
    .filter((r) => !r.is_settled)
    .reduce((sum, r) => sum + Math.max(0, r.amount), 0);
}

export async function getReceivableTransactionAssignments(): Promise<ReceivableTransactionAssignment[]> {
  const assignments = await readLocalFinanceList<ReceivableTransactionAssignment>("receivableAssignments");
  return assignments.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
}

/**
 * Weist eine eingehende Buchung (Gutschrift) als (Teil-)Rückzahlung einer Forderung
 * zu und reduziert den offenen Betrag. Im Gegensatz zur Schuld-Tilgung sind hier nur
 * Geldeingänge (amount > 0) zulässig.
 */
export async function assignTransactionToReceivable(params: {
  receivableId: string;
  transactionId: string;
}): Promise<ReceivableTransactionAssignment> {
  const receivables = await getReceivables();
  const receivable = receivables.find((entry) => entry.id === params.receivableId);
  if (!receivable) throw new Error("Forderung nicht gefunden");

  const transaction = (await getTransactions(10000)).find((entry) => entry.id === params.transactionId);
  if (!transaction) throw new Error("Transaktion nicht gefunden");

  const amount = Number(transaction.amount) || 0;
  if (amount <= 0) {
    throw new Error("Nur Geldeingänge können einer Forderung als Rückzahlung zugewiesen werden.");
  }

  const assignments = await readLocalFinanceList<ReceivableTransactionAssignment>("receivableAssignments");
  if (assignments.some((assignment) => assignment.transaction_id === params.transactionId)) {
    throw new Error("Dieser Geldeingang ist bereits einer Forderung zugewiesen.");
  }

  const assignment: ReceivableTransactionAssignment = {
    id: crypto.randomUUID(),
    user_id: await localUserId(),
    receivable_id: params.receivableId,
    transaction_id: params.transactionId,
    amount,
    created_at: new Date().toISOString(),
  };
  await writeLocalFinanceList("receivableAssignments", [assignment, ...assignments]);

  const newAmount = Math.max(0, Number(receivable.amount) - amount);
  await updateReceivable({ id: params.receivableId, amount: newAmount, is_settled: newAmount <= 0 });

  return assignment;
}

export async function unassignReceivableTransaction(assignmentId: string): Promise<void> {
  const assignments = await readLocalFinanceList<ReceivableTransactionAssignment>("receivableAssignments");
  const assignment = assignments.find((entry) => entry.id === assignmentId);
  if (!assignment) throw new Error("Zuweisung nicht gefunden");

  await writeLocalFinanceList(
    "receivableAssignments",
    assignments.filter((entry) => entry.id !== assignmentId),
  );

  const receivables = await getReceivables();
  const receivable = receivables.find((entry) => entry.id === assignment.receivable_id);
  if (!receivable) return;

  const originalAmount =
    receivable.original_amount === null || receivable.original_amount === undefined
      ? null
      : Number(receivable.original_amount);
  const restoredAmount = Number(receivable.amount) + Number(assignment.amount);
  const cappedAmount =
    originalAmount && originalAmount > 0 ? Math.min(restoredAmount, originalAmount) : restoredAmount;
  await updateReceivable({ id: assignment.receivable_id, amount: cappedAmount, is_settled: false });
}

/**
 * Schlägt eingehende Buchungen vor, die zu einer Forderung passen könnten – auch
 * kleine Teilrückzahlungen. Matcht über den normalisierten Namen des Schuldners
 * bzw. der Forderungsbezeichnung gegen den Zahler (payee) der Buchung.
 */
export function suggestReceivableRepayments(
  receivable: Receivable,
  incomingTransactions: Transaction[],
): Transaction[] {
  const needles = [receivable.debtor, receivable.name]
    .map((value) => normalizeMerchantName(value || ""))
    .filter((value) => value.length >= 3);
  if (needles.length === 0) return [];

  return incomingTransactions.filter((t) => {
    if (Number(t.amount) <= 0) return false;
    const haystack = normalizeMerchantName(`${t.payee || ""} ${t.description || ""}`);
    return needles.some((needle) => haystack.includes(needle));
  });
}

export type { Receivable, ReceivableTransactionAssignment } from "../types";
