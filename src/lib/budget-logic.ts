import type {
  Budget,
  BudgetHealth,
  BudgetPeriod,
  BudgetRule,
  BudgetStatus,
  BudgetSuggestion,
  Category,
  Transaction,
  TransactionAllocation,
} from "@/types";
import { getCategoryContributions } from "@/lib/analysis-data";

/** Standard-Warnschwelle in Prozent, wenn ein Budget keine eigene definiert. */
export const DEFAULT_WARN_THRESHOLD = 80;

/** Monatsschlüssel `YYYY-MM` aus einem ISO-/Datums-String. Leerstring bei Unparsbarem. */
export function monthKeyOf(dateStr: string | undefined | null): string {
  if (!dateStr) return "";
  // Datumsformat ist normalisiert (ISO `YYYY-MM-DD`); die ersten 7 Zeichen genügen.
  return dateStr.slice(0, 7);
}

/**
 * ISO-8601-Wochenschlüssel `YYYY-Www` (Woche beginnt Montag). Die Woche gehört zum
 * Jahr ihres Donnerstags – deshalb das Verschieben auf den Donnerstag, bevor die
 * Wochennummer gezählt wird (klassischer ISO-Trick, korrekt an Jahresgrenzen).
 */
function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7; // Sonntag (0) zählt als 7
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/**
 * Perioden-Schlüssel einer Transaktion je nach Budget-Periode:
 * `monthly` → `YYYY-MM`, `yearly` → `YYYY`, `weekly` → `YYYY-Www` (ISO-Woche).
 * Ohne Periode gilt `monthly`, sodass die Rückgabe zu {@link monthKeyOf}
 * identisch bleibt (abwärtskompatibel).
 */
export function periodKeyOf(
  dateStr: string | undefined | null,
  period: BudgetPeriod = "monthly",
): string {
  if (!dateStr) return "";
  if (period === "yearly") return dateStr.slice(0, 4);
  if (period === "weekly") {
    const d = new Date(`${dateStr.slice(0, 10)}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return "";
    return isoWeekKey(d);
  }
  return dateStr.slice(0, 7);
}

/**
 * Liefert die Menge aller Kategorie-IDs, deren Ausgaben in dieses Budget zählen.
 * Ohne ausgewählte Unterkategorien zählen Haupt- + alle Unterkategorien; mit
 * Auswahl ausschließlich die gewählten Unterkategorien.
 */
export function budgetCategoryIds(budget: Budget, categories: Category[]): Set<string> {
  const subs = budget.subcategory_ids ?? [];
  if (subs.length > 0) return new Set(subs);

  const ids = new Set<string>([budget.category_id]);
  for (const cat of categories) {
    if (cat.parent_id === budget.category_id) ids.add(cat.id);
  }
  return ids;
}

/**
 * Prüft die (Premium-)Match-Regeln eines Budgets gegen eine Transaktion.
 * Alle Regeln müssen zutreffen (UND-Verknüpfung). Ohne Regeln immer `true`.
 */
export function transactionMatchesRules(rules: BudgetRule[] | undefined, tx: Transaction): boolean {
  if (!rules || rules.length === 0) return true;
  return rules.every((rule) => {
    switch (rule.field) {
      case "payee":
      case "description": {
        const haystack = (tx[rule.field] ?? "").toString().toLowerCase();
        const needle = rule.value.toLowerCase();
        return rule.op === "equals" ? haystack === needle : haystack.includes(needle);
      }
      case "account":
        return rule.op === "equals"
          ? (tx.account_id ?? "") === rule.value
          : (tx.account_id ?? "").includes(rule.value);
      case "amount": {
        const amount = Math.abs(tx.amount);
        const value = Number(rule.value);
        if (!Number.isFinite(value)) return true;
        if (rule.op === "gt") return amount > value;
        if (rule.op === "lt") return amount < value;
        return amount === value;
      }
      default:
        return true;
    }
  });
}

/**
 * Ampel-Regel eines Budgets aus Verbrauch & Limit. Exportiert, damit auch der
 * virtuelle "Verfügbar bis Gehalt"-Tank exakt dieselbe Schwellen-Logik nutzt
 * (eine Quelle der Wahrheit für die Ampel statt einer zweiten, driftenden Kopie).
 */
export function healthFor(spent: number, limit: number, warnThreshold: number): BudgetHealth {
  if (limit <= 0) return spent > 0 ? "over" : "ok";
  if (spent > limit) return "over";
  if ((spent / limit) * 100 >= warnThreshold) return "warn";
  return "ok";
}

/**
 * Summiert die Ausgaben eines Budgets in einer konkreten Periode. Der `periodKey`
 * ist perioden-abhängig (`YYYY-MM` monatlich, `YYYY` jährlich, `YYYY-Www`
 * wöchentlich) und wird gegen die Periode des Budgets aufgelöst – für `monthly`
 * (Default) bleibt das Verhalten identisch zur früheren Monats-Summe.
 * Übertragsbuchungen werden ignoriert, Aufteilungen (Splits) korrekt anteilig
 * berücksichtigt. Nur negative Beiträge (echte Ausgaben) zählen.
 */
export function computeBudgetSpent(
  budget: Budget,
  transactions: Transaction[],
  categories: Category[],
  periodKey: string,
  allocationsByTx?: Map<string, TransactionAllocation[]>,
): number {
  const ids = budgetCategoryIds(budget, categories);
  const period = budget.period ?? "monthly";
  let spent = 0;

  for (const tx of transactions) {
    if (tx.is_transfer) continue;
    if (periodKeyOf(tx.date, period) !== periodKey) continue;
    if (!transactionMatchesRules(budget.rules, tx)) continue;

    for (const contribution of getCategoryContributions(tx, allocationsByTx)) {
      if (contribution.amount >= 0) continue; // nur Ausgaben
      if (contribution.assignedId && ids.has(contribution.assignedId)) {
        spent += Math.abs(contribution.amount);
      }
    }
  }

  return spent;
}

/** Berechnet den vollständigen Live-Stand eines Budgets für einen Monat. */
export function computeBudgetStatus(
  budget: Budget,
  transactions: Transaction[],
  categories: Category[],
  monthKey: string,
  allocationsByTx?: Map<string, TransactionAllocation[]>,
): BudgetStatus {
  const spent = computeBudgetSpent(budget, transactions, categories, monthKey, allocationsByTx);
  const limit = budget.limit;
  const ratio = limit > 0 ? spent / limit : 0;
  const warnThreshold = budget.warn_threshold ?? DEFAULT_WARN_THRESHOLD;

  return {
    budget,
    spent,
    remaining: limit - spent,
    ratio,
    fillPercent: Math.max(0, Math.min(100, ratio * 100)),
    health: healthFor(spent, limit, warnThreshold),
  };
}

/** Rundet einen Vorschlagsbetrag großzügig auf die nächste 10er-Stufe (min. 10). */
export function roundSuggestion(avgMonthly: number): number {
  // 5% Puffer, damit ein durchschnittlicher Monat nicht sofort die Schwelle reißt.
  return Math.max(10, Math.ceil((avgMonthly * 1.05) / 10) * 10);
}

interface SuggestOptions {
  /** Bezugsmonat (`YYYY-MM`), bis zu dem rückwärts gemittelt wird. */
  currentMonth: string;
  /** Anzahl der Monate im Mittelungsfenster (Default 3). */
  windowMonths?: number;
  /** Hauptkategorien, die bereits ein Budget haben und übersprungen werden. */
  excludeCategoryIds?: Set<string>;
  /** Mindest-Durchschnitt, ab dem überhaupt ein Vorschlag entsteht (Default 5 €). */
  minAvg?: number;
}

/** Liefert den Monatsschlüssel `windowMonths-1` Monate vor `currentMonth` als Fenstergrenze. */
function monthsBack(currentMonth: string, count: number): string[] {
  const [yStr, mStr] = currentMonth.split("-");
  let year = Number(yStr);
  let month = Number(mStr); // 1..12
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    result.push(`${year}-${String(month).padStart(2, "0")}`);
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  return result;
}

/**
 * Schlägt Budgets für Hauptkategorien vor – auf Basis des durchschnittlichen
 * Monatsverbrauchs im Mittelungsfenster. Einnahmen-/Spar-Kategorien werden
 * ausgelassen (Budgets begrenzen Ausgaben). Bereits budgetierte Kategorien und
 * Bagatellbeträge fallen raus.
 */
export function suggestBudgets(
  categories: Category[],
  transactions: Transaction[],
  options: SuggestOptions,
  allocationsByTx?: Map<string, TransactionAllocation[]>,
): BudgetSuggestion[] {
  const windowMonths = options.windowMonths ?? 3;
  const minAvg = options.minAvg ?? 5;
  const exclude = options.excludeCategoryIds ?? new Set<string>();
  const windowSet = new Set(monthsBack(options.currentMonth, windowMonths));

  const byId = new Map(categories.map((c) => [c.id, c]));
  // Map jeder Kategorie-ID auf ihre Hauptkategorie (Unterkategorie → Parent).
  const mainIdOf = (id: string): string | null => {
    const cat = byId.get(id);
    if (!cat) return null;
    return cat.parent_id ?? cat.id;
  };

  const spendByMain = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.is_transfer) continue;
    if (!windowSet.has(monthKeyOf(tx.date))) continue;
    for (const contribution of getCategoryContributions(tx, allocationsByTx)) {
      if (contribution.amount >= 0 || !contribution.assignedId) continue;
      const main = mainIdOf(contribution.assignedId);
      if (!main) continue;
      spendByMain.set(main, (spendByMain.get(main) ?? 0) + Math.abs(contribution.amount));
    }
  }

  const suggestions: BudgetSuggestion[] = [];
  for (const [mainId, total] of spendByMain) {
    if (exclude.has(mainId)) continue;
    const cat = byId.get(mainId);
    if (!cat) continue;
    if (cat.attributes?.ausgabenklasse === "einkommen") continue;

    const avgMonthly = total / windowMonths;
    if (avgMonthly < minAvg) continue;

    suggestions.push({
      category_id: mainId,
      name: cat.name,
      limit: roundSuggestion(avgMonthly),
      avgMonthly,
      color: cat.color,
      icon: cat.icon,
    });
  }

  return suggestions.sort((a, b) => b.avgMonthly - a.avgMonthly);
}
