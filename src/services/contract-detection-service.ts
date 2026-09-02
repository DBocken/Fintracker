/**
 * Anwendung der Vertragserkennung auf den Bestand — das I/O drumherum.
 *
 * Die Ableitung selbst steht in `@/lib/contract-derivation` und gruppiert nach
 * Händler-Fingerprint. Hier lag bis WP-A eine ZWEITE Ableitung
 * (`detectRecurringTransactions`), die nach rohem `payee` gruppierte und damit
 * dieselbe Zahlung in so viele Familien zerlegte, wie die Bank Schreibweisen
 * liefert. Sie hatte nie einen Produktivaufrufer — `applyDetectedContracts`
 * benutzt seit jeher `computeContracts` — und ist deshalb entfallen statt
 * korrigiert zu werden: Eine unbenutzte Alternative neben der benutzten ist
 * die Fehlerquelle, nicht ihre Gruppierung. Das Verhalten, das sie falsch
 * machte, sichern jetzt Tests auf der benutzten Seite ab
 * (`src/lib/__tests__/contract-derivation.test.ts`, „gruppiert nach
 * Händlerfamilie").
 */
import type { Transaction } from "@/types";
import { mapCycleToRhythmus } from "@/lib/contract-types";
import { getAllTransactions, getCategories, updateTransaction, type TransactionUpdate } from "./transaction-service";
import { computeContracts, computeIncomeContracts } from "@/lib/contract-derivation";

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
 * Erkennt wiederkehrende Transaktionen und markiert die zugehörigen Buchungen
 * als Vertrag (inkl. Zyklus). Nutzt IBAN-basiertes Fingerprinting (computeContracts)
 * statt exakter Payee-Suche, damit auch Gehalt und Versorger sicher erkannt werden.
 */
export async function applyDetectedContracts(): Promise<number> {
  const [transactions, categories] = await Promise.all([
    getAllTransactions(),
    getCategories(),
  ]);

  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const allContracts = [
    ...computeContracts(transactions, categoryMap, "Ausgabe"),
    // Einnahmen inkl. gehaltsspezifischer Erkennung (Arbeitgeber-basiert).
    ...computeIncomeContracts(transactions, categoryMap),
  ];

  if (allContracts.length === 0) return 0;

  const seen = new Set<string>();
  const updates: TransactionUpdate[] = [];
  for (const contract of allContracts) {
    const cycle = mapCycleToRhythmus(contract.cycle) ?? null;
    for (const id of contract.transactionIds) {
      if (!seen.has(id)) {
        seen.add(id);
        updates.push({ id, is_contract: true, contract_cycle: cycle });
      }
    }
  }

  if (updates.length === 0) return 0;
  await updateTransaction(updates);
  return updates.length;
}
