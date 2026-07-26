import type { Category, Transaction } from '@/types';
import { getTransactions, getCategories } from './transaction-service';
import { getAccounts } from './account-service';
import { getDebts } from './debt-service';
import { getBudgets } from './budget-service';
import { getPortfolios } from './portfolio-service';
import { getSpecialCategories } from './special-category-service';
import { detectSalarySeries } from '@/lib/salary-detection';
import { isBusinessModeEnabled } from '@/lib/life-situations';
import { getUserSettings } from './user-settings-service';
import type { DataReadiness } from '@/lib/tutorial-sequence';

/**
 * Erhebt die Datenreife, aus der `buildCurriculum` entscheidet, welche
 * Tutorial-Kapitel jetzt etwas zu zeigen haben (`docs/tutorial-sequence.md`,
 * „Datenreife statt Schrittzähler").
 *
 * Bewusst hier und nicht in `src/lib/`: Das ist ausschließlich I/O. Die
 * Bewertung — welcher Wert für welches Kapitel reicht — bleibt in der reinen
 * Domänenschicht und damit ohne Mock testbar.
 */

/** Mindestanteil kategorisierter Buchungen, ab dem ein Monat als erschlossen gilt. */
const CATEGORIZED_SHARE = 0.5;

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

/**
 * Monate, in denen genug zugeordnet ist, dass eine Auswertung trägt.
 *
 * „Genug" statt „alles": Ein einzelner unkategorisierter Betrag soll den Monat
 * nicht entwerten — die Stadt und das Flussdiagramm sind auch dann schon eine
 * Aussage. Exportiert, weil die Schwelle eine Setzung ist und überprüfbar
 * bleiben soll.
 */
export function countCategorizedMonths(transactions: Transaction[]): number {
  const total = new Map<string, number>();
  const categorized = new Map<string, number>();

  for (const t of transactions) {
    if (t.is_transfer) continue;
    const key = monthKey(t.date);
    total.set(key, (total.get(key) ?? 0) + 1);
    if (t.category_id) categorized.set(key, (categorized.get(key) ?? 0) + 1);
  }

  let months = 0;
  for (const [key, count] of total) {
    if ((categorized.get(key) ?? 0) / count >= CATEGORIZED_SHARE) months += 1;
  }
  return months;
}

/** Zahl der Monate mit mindestens einer Buchung. */
export function countMonthsOfHistory(transactions: Transaction[]): number {
  const months = new Set<string>();
  for (const t of transactions) months.add(monthKey(t.date));
  return months.size;
}

/**
 * Gibt es eine Wiederholung, aus der die Vertragserkennung etwas machen kann?
 *
 * Bewusst dieselbe Schwelle wie `contract-detection-service` (drei Buchungen
 * je Zahlungsempfänger), aber ohne dessen vollständige Ableitung: Hier zählt
 * nur, ob das Kapitel etwas zu zeigen hätte.
 */
export function hasRecurringCandidate(transactions: Transaction[]): boolean {
  const byPayee = new Map<string, number>();
  for (const t of transactions) {
    if (t.is_transfer || Number(t.amount) >= 0) continue;
    const payee = t.payee?.trim();
    if (!payee) continue;
    const count = (byPayee.get(payee) ?? 0) + 1;
    if (count >= 3) return true;
    byPayee.set(payee, count);
  }
  return false;
}

/** Kategorien, die eine Steuer-Auswertung überhaupt füttern würden. */
function hasDeductible(transactions: Transaction[], categories: Category[]): boolean {
  const deductible = new Set(
    categories.filter((c) => c.attributes?.steuerrelevant).map((c) => c.id),
  );
  if (deductible.size === 0) return false;
  return transactions.some((t) => t.category_id && deductible.has(t.category_id));
}

/**
 * @param hasPremiumAccess Berechtigung kommt von der Aufrufstelle: Sie ist
 * keine Eigenschaft der Daten, sondern des Tarifs (`useTier`), und hat in
 * einem Daten-Service nichts verloren.
 */
export async function collectDataReadiness(
  hasPremiumAccess: boolean,
  now: Date = new Date(),
): Promise<DataReadiness> {
  const [transactions, categories, accounts, debts, budgets, portfolios, occasions, settings] =
    await Promise.all([
      getTransactions(2000),
      getCategories(),
      getAccounts(),
      getDebts(),
      getBudgets(),
      getPortfolios(),
      getSpecialCategories(),
      getUserSettings(),
    ]);

  return {
    transactionCount: transactions.length,
    monthsOfHistory: countMonthsOfHistory(transactions),
    categorizedMonths: countCategorizedMonths(transactions),
    accountCount: accounts.length,
    hasSalaryDetected: detectSalarySeries(transactions, now).length > 0,
    hasRecurringDetected: hasRecurringCandidate(transactions),
    hasBudget: budgets.length > 0,
    hasDebt: debts.length > 0,
    hasOccasion: occasions.length > 0,
    hasAssetsBeyondAccounts: portfolios.length > 0,
    hasDeductibleCategory: hasDeductible(transactions, categories),
    businessMode: isBusinessModeEnabled(settings.enabled_nav_features),
    hasPortfolio: portfolios.length > 0,
    hasPremiumAccess,
  };
}
