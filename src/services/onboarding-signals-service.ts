import type { Category, Transaction } from '@/types';
import { getAllTransactions, getCategories } from './transaction-service';
import { getDebts } from './debt-service';
import { getPortfolios } from './portfolio-service';
import { detectSalarySeries } from '@/lib/salary-detection';
import type { OnboardingSignals } from '@/lib/onboarding-proposal';

/**
 * Erhebt die Signale, aus denen `proposeOnboarding` einen Vorschlag für
 * Lebenssituation und Umstände macht (`docs/tutorial-sequence.md`).
 *
 * Die Bewertung selbst liegt bewusst nicht hier, sondern in der reinen
 * Domänenschicht: Diese Datei liest nur, sie urteilt nicht.
 */

/** Haupt-Kategorien der Einnahmen-Taxonomie (`data/merchant-keywords.ts`). */
const SELF_EMPLOYED_MAIN_IDS = ['local-cat-nebenerwerb', 'local-cat-onlinecreator'];
const PENSION_SUB_ID = 'local-cat-rentesoziales';

/**
 * Ab dieser relativen Streuung gelten Einnahmen als schwankend.
 *
 * Bezugsgröße ist die mittlere Abweichung vom Monatsmittel, nicht die Spanne:
 * Ein einzelner Bonusmonat soll ein sonst gleichmäßiges Gehalt nicht zu
 * „schwankend" machen.
 */
const INCOME_VARIATION_THRESHOLD = 0.25;

/** Mindesthistorie, unter der eine Schwankung nicht beurteilbar ist. */
const MIN_MONTHS_FOR_VARIATION = 3;

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

/** Hauptkategorie einer Buchung — Unterkategorien werden auf ihr Elternteil gehoben. */
function mainCategoryId(transaction: Transaction, byId: Map<string, Category>): string | null {
  const own = transaction.category_id ? byId.get(transaction.category_id) : undefined;
  if (!own) return transaction.category_id ?? null;
  return own.parent_id ?? own.id;
}

/**
 * Schwanken die monatlichen Einnahmen? Reine Rechnung über die Monatssummen,
 * exportiert für den Test — die Schwelle ist eine Setzung und soll überprüfbar
 * bleiben.
 */
export function incomeVariesAcross(transactions: Transaction[]): boolean {
  const byMonth = new Map<string, number>();
  for (const t of transactions) {
    const amount = Number(t.amount);
    if (amount <= 0 || t.is_transfer) continue;
    byMonth.set(monthKey(t.date), (byMonth.get(monthKey(t.date)) ?? 0) + amount);
  }

  const totals = [...byMonth.values()];
  if (totals.length < MIN_MONTHS_FOR_VARIATION) return false;

  const mean = totals.reduce((sum, v) => sum + v, 0) / totals.length;
  if (mean <= 0) return false;

  const meanDeviation =
    totals.reduce((sum, v) => sum + Math.abs(v - mean), 0) / totals.length / mean;
  return meanDeviation >= INCOME_VARIATION_THRESHOLD;
}

export async function collectOnboardingSignals(now: Date = new Date()): Promise<OnboardingSignals> {
  const [transactions, categories, debts, portfolios] = await Promise.all([
    getAllTransactions(),
    getCategories(),
    getDebts(),
    getPortfolios(),
  ]);

  const byId = new Map(categories.map((c) => [c.id, c]));
  const income = transactions.filter((t) => Number(t.amount) > 0 && !t.is_transfer);

  let hasSelfEmployedIncome = false;
  let hasPensionIncome = false;
  for (const t of income) {
    if (t.category_id === PENSION_SUB_ID) hasPensionIncome = true;
    const main = mainCategoryId(t, byId);
    if (main && SELF_EMPLOYED_MAIN_IDS.includes(main)) hasSelfEmployedIncome = true;
  }

  return {
    hasRegularSalary: detectSalarySeries(transactions, now).length > 0,
    hasSelfEmployedIncome,
    hasPensionIncome,
    incomeVaries: incomeVariesAcross(transactions),
    hasDebts: debts.length > 0,
    hasInvestments: portfolios.length > 0,
  };
}
