import type { Account, Transaction } from "../types";
import { createTransaction, markTransferPair } from "./transaction-service";

/**
 * Stichwörter, die auf eine Bargeldabhebung am Automaten / Schalter hindeuten.
 * Wird genutzt, um importierte Giro-Abbuchungen vorzuschlagen, die ins
 * Bargeld-Konto übernommen werden sollten.
 */
const ATM_WITHDRAWAL_RE =
  /(geldautomat|bargeldausz|bargeld\s*ausz|auszahlung|abhebung|atm|cash\s*group|geldausgabe)/i;

function transactionText(t: Transaction): string {
  return `${t.payee || ""} ${t.description || ""} ${t.original_text || ""}`;
}

/**
 * Findet Giro-Abbuchungen (amount < 0), die nach einer Bargeldabhebung aussehen
 * und noch nicht als interner Übertrag markiert sind. Die zugehörige Gutschrift
 * kann anschließend per {@link moveWithdrawalToCash} ins Bargeld-Konto gebucht werden.
 */
export function detectCashWithdrawals(
  transactions: Transaction[],
  cashAccountId?: string | null,
): Transaction[] {
  return transactions.filter((t) => {
    if (!t.id) return false;
    if (Number(t.amount) >= 0) return false;
    if (t.is_transfer) return false;
    if (cashAccountId && t.account_id === cashAccountId) return false;
    return ATM_WITHDRAWAL_RE.test(transactionText(t));
  });
}

/**
 * Übernimmt eine bereits importierte Giro-Abhebung ins Bargeld-Konto: legt die
 * gespiegelte Gutschrift auf dem Bargeld-Konto an und verknüpft beide Buchungen
 * als internen Übertrag (damit sie nicht als Ausgabe/Einnahme zählen).
 */
export async function moveWithdrawalToCash(params: {
  giroTransaction: Transaction;
  cashAccountId: string;
}): Promise<Transaction> {
  const { giroTransaction, cashAccountId } = params;
  if (!giroTransaction.id) throw new Error("Buchung ohne ID kann nicht übernommen werden.");
  const amount = Math.abs(Number(giroTransaction.amount) || 0);
  if (amount <= 0) throw new Error("Betrag der Abhebung ist 0.");

  const cashCredit = await createTransaction({
    account_id: cashAccountId,
    date: giroTransaction.date,
    amount,
    payee: "Bargeldabhebung",
    description: "Abhebung aufs Bargeld-Konto",
    is_transfer: true,
  });

  await markTransferPair(giroTransaction.id, cashCredit.id!);
  return cashCredit;
}

/**
 * Erfasst eine manuelle Bargeldabhebung: erzeugt die Abbuchung auf dem
 * Giro-/Quellkonto und die Gutschrift auf dem Bargeld-Konto und verknüpft beide
 * als internen Übertrag.
 */
export async function recordCashWithdrawal(params: {
  sourceAccountId: string;
  cashAccountId: string;
  amount: number;
  date: string;
  note?: string;
}): Promise<{ debit: Transaction; credit: Transaction }> {
  const amount = Math.abs(Number(params.amount) || 0);
  if (amount <= 0) throw new Error("Bitte einen Betrag größer 0 angeben.");
  if (params.sourceAccountId === params.cashAccountId) {
    throw new Error("Quell- und Bargeld-Konto müssen unterschiedlich sein.");
  }

  const debit = await createTransaction({
    account_id: params.sourceAccountId,
    date: params.date,
    amount: -amount,
    payee: "Bargeldabhebung",
    description: params.note || "Geld abgehoben",
    is_transfer: true,
  });

  const credit = await createTransaction({
    account_id: params.cashAccountId,
    date: params.date,
    amount,
    payee: "Bargeldabhebung",
    description: params.note || "Geld abgehoben",
    is_transfer: true,
  });

  await markTransferPair(debit.id!, credit.id!);
  return { debit, credit };
}

/** Liefert das (erste) Bargeld-Konto, falls vorhanden. */
export function findCashAccount(accounts: Account[]): Account | undefined {
  return accounts.find((a) => a.type === "cash");
}
