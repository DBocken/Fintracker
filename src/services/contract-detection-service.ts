import { parseISO, differenceInDays, addMonths, addWeeks, addQuarters, addYears } from "date-fns";
import type { Transaction, Rhythmus } from "@/types";
import type { ContractRow, Cycle } from "@/components/contracts/contract-types";
import { mapCycleToRhythmus } from "@/components/contracts/contract-types";
import { getTransactions, updateTransaction, type TransactionUpdate } from "./transaction-service";

/**
 * Detects recurring transactions with equal amounts and identifies price increases.
 * Returns contract rows for subscription-like recurring expenses/income.
 */
export async function detectRecurringTransactions(): Promise<ContractRow[]> {
  const transactions = await getTransactions(2000);

  // Group transactions by payee
  const payeeGroups = new Map<string, Transaction[]>();

  for (const t of transactions) {
    if (t.is_transfer) continue;

    const payee = t.payee || "Unbekannt";
    const arr = payeeGroups.get(payee) || [];
    arr.push(t);
    payeeGroups.set(payee, arr);
  }

  const contracts: ContractRow[] = [];

  // Analyze each payee group for recurring pattern
  for (const [payee, payeeTxns] of payeeGroups) {
    if (payeeTxns.length < 3) continue; // Need at least 3 to detect pattern

    // Sort by date
    const sorted = [...payeeTxns].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Try to detect the main recurring pattern
    const amountCounts = new Map<number, Transaction[]>();
    for (const t of sorted) {
      const amountAbs = Math.abs(t.amount);
      const arr = amountCounts.get(amountAbs) || [];
      arr.push(t);
      amountCounts.set(amountAbs, arr);
    }

    // Find the most common amount (likely the baseline)
    let mainAmount = 0;
    let mainTxns: Transaction[] = [];
    for (const [amount, txns] of amountCounts) {
      if (txns.length > mainTxns.length) {
        mainAmount = amount;
        mainTxns = txns;
      }
    }

    if (mainTxns.length < 2) continue;

    const recurring = detectCycle(mainTxns);
    if (!recurring?.isRecurring) continue;

    const { cycle, avgDaysBetween } = recurring;
    const lastTxn = sorted[sorted.length - 1];
    const lastAmount = Math.abs(lastTxn.amount);
    const changed = lastAmount !== mainAmount;
    const changeAmount = changed ? lastAmount - mainAmount : 0;

    // Predict next date based on cycle
    const lastDate = parseISO(lastTxn.date);
    const nextDate = predictNextDate(lastDate, cycle, avgDaysBetween);

    const categoryId = lastTxn.category_id || lastTxn.subcategory_id || null;

    contracts.push({
      key: `contract:${payee}:${categoryId}:${mainAmount}`,
      type: lastTxn.amount > 0 ? "Einnahme" : "Ausgabe",
      payee,
      categoryName: categoryId ? "Category" : "Uncategorized",
      categoryId,
      amountTypical: mainAmount,
      amountLast: lastAmount,
      cycle,
      lastDateISO: lastTxn.date,
      nextDateISO: nextDate?.toISOString().split("T")[0] || null,
      changed,
      changeAmount,
      changeSinceLabel: changed ? `Geändert zu ${lastAmount.toFixed(2)}€` : null,
      confirmed: sorted.some((t) => t.is_contract === true),
      transactionIds: sorted.map((t) => t.id || "").filter(Boolean),
    });
  }

  return contracts;
}

/**
 * Bildet erkannte Verträge auf konkrete Transaktions-Updates ab (reine
 * Funktion, ohne IO). Eine Transaktion gehört zu einem Vertrag, wenn der
 * Payee übereinstimmt und der Absolutbetrag dem typischen oder dem zuletzt
 * gebuchten Betrag des Vertrags entspricht (so werden auch Preiserhöhungen
 * miterfasst, aber einmalige Sonderzahlungen ausgelassen).
 */
export function matchContractsToTransactions(
  transactions: Transaction[],
  contracts: ContractRow[]
): TransactionUpdate[] {
  const updates: TransactionUpdate[] = [];

  for (const contract of contracts) {
    const cycle = mapCycleToRhythmus(contract.cycle);
    const targetAmounts = new Set([
      round2(contract.amountTypical),
      round2(contract.amountLast),
    ]);

    for (const t of transactions) {
      if (!t.id) continue;
      if (t.is_transfer) continue;
      if ((t.payee || "Unbekannt") !== contract.payee) continue;
      if (!targetAmounts.has(round2(Math.abs(t.amount)))) continue;

      updates.push({ id: t.id, is_contract: true, contract_cycle: cycle });
    }
  }

  return updates;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Normalisiert einen Payee für den Vergleich (lower-case, getrimmt).
 */
function normalizePayee(payee: string | null | undefined): string {
  return (payee || "Unbekannt").toLowerCase().trim();
}

/**
 * Findet Transaktionen, die zur selben wiederkehrenden Zahlung gehören wie die
 * Referenz: gleicher Payee und Betrag im Toleranzbereich (Standard 15 %, mind.
 * 0,50 €). Reine Funktion (testbar). Die Referenz selbst ist im Ergebnis
 * enthalten, sofern sie in `transactions` vorkommt.
 */
export function findSimilarContractTransactions(
  transactions: Transaction[],
  reference: Pick<Transaction, "payee" | "amount">,
  tolerancePercent = 0.15
): Transaction[] {
  const refPayee = normalizePayee(reference.payee);
  const refAmount = Math.abs(reference.amount);
  const tolerance = Math.max(0.5, refAmount * tolerancePercent);

  return transactions.filter((t) => {
    if (t.is_transfer) return false;
    if (normalizePayee(t.payee) !== refPayee) return false;
    // Gleiche Richtung (Einnahme/Ausgabe) verlangen.
    if (Math.sign(t.amount) !== Math.sign(reference.amount)) return false;
    const diff = Math.abs(Math.abs(t.amount) - refAmount);
    return diff <= tolerance;
  });
}

/**
 * Markiert eine Transaktion und alle gleichartigen (gleicher Payee + ähnlicher
 * Betrag, gleiche Richtung) als Vertrag bzw. hebt die Markierung auf. Gibt die
 * Anzahl der aktualisierten Transaktionen zurück. So genügt es, eine einzelne
 * Buchung als Vertrag zu kennzeichnen — die übrigen werden automatisch erfasst.
 */
export async function applyContractToSimilar(
  reference: Pick<Transaction, "payee" | "amount">,
  isContract: boolean,
  cycle: Rhythmus | null
): Promise<number> {
  const transactions = await getTransactions(2000);
  const similar = findSimilarContractTransactions(transactions, reference);

  const updates: TransactionUpdate[] = similar
    .filter((t) => t.id)
    .map((t) => ({
      id: t.id!,
      is_contract: isContract,
      contract_cycle: isContract ? cycle : null,
    }));

  if (updates.length === 0) return 0;
  await updateTransaction(updates);
  return updates.length;
}

/**
 * Erkennt wiederkehrende Transaktionen und markiert die zugehörigen Buchungen
 * als Vertrag (inkl. Zyklus). Persistiert die Änderungen und gibt die Anzahl
 * der aktualisierten Transaktionen zurück.
 */
export async function applyDetectedContracts(): Promise<number> {
  const contracts = await detectRecurringTransactions();
  if (contracts.length === 0) return 0;

  const transactions = await getTransactions(2000);
  const updates = matchContractsToTransactions(transactions, contracts);
  if (updates.length === 0) return 0;

  await updateTransaction(updates);
  return updates.length;
}

interface CycleDetection {
  isRecurring: boolean;
  cycle: Cycle;
  avgDaysBetween: number;
}

function detectCycle(transactions: Transaction[]): CycleDetection | null {
  if (transactions.length < 2) return null;

  const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const intervals: number[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const prev = parseISO(sorted[i - 1].date);
    const curr = parseISO(sorted[i].date);
    const days = differenceInDays(curr, prev);
    if (days > 0) intervals.push(days);
  }

  if (intervals.length === 0) return null;

  const avgDays = Math.round(intervals.reduce((a, b) => a + b) / intervals.length);
  const variance = intervals.reduce((sum, d) => sum + Math.pow(d - avgDays, 2), 0) / intervals.length;
  const stdDev = Math.sqrt(variance);

  // Consider it recurring if variance is low (coefficient of variation < 0.3)
  const cv = stdDev / avgDays;
  if (cv > 0.3 && intervals.length < 4) return null;

  // Map days to cycle
  let cycle: Cycle = "Unbekannt";
  if (avgDays >= 5 && avgDays <= 9) cycle = "Wöchentlich";
  else if (avgDays >= 27 && avgDays <= 35) cycle = "Monatlich";
  else if (avgDays >= 80 && avgDays <= 100) cycle = "Vierteljährlich";
  else if (avgDays >= 170 && avgDays <= 190) cycle = "Halbjährlich";
  else if (avgDays >= 350 && avgDays <= 370) cycle = "Jährlich";

  return {
    isRecurring: cycle !== "Unbekannt",
    cycle,
    avgDaysBetween: avgDays,
  };
}

function predictNextDate(lastDate: Date, cycle: Cycle, avgDays: number): Date | null {
  switch (cycle) {
    case "Wöchentlich":
      return addWeeks(lastDate, 1);
    case "Monatlich":
      return addMonths(lastDate, 1);
    case "Vierteljährlich":
      return addQuarters(lastDate, 1);
    case "Halbjährlich":
      return addMonths(lastDate, 6);
    case "Jährlich":
      return addYears(lastDate, 1);
    case "Unbekannt":
      const nextDate = new Date(lastDate);
      nextDate.setDate(nextDate.getDate() + avgDays);
      return nextDate;
    default:
      return null;
  }
}
