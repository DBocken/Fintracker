import { parseISO, format, isWithinInterval } from "date-fns";
import type { Transaction } from "@/types";

/**
 * Analyse-Modi (Audit P0-5): die im (premium-gegateten) Analyse-Dashboard nur
 * indirekt vorhandene Zeitraum-/Durchschnittslogik wird hier als pure, testbare
 * Berechnung zusammengeführt, damit sie auch im aktiven Dashboard nutzbar ist.
 *
 * Der Analysemodus ist bewusst von normalen Filtern (Konto, Kategorie) getrennt:
 *  - "Zeitraum"/"Gesamthistorie" deckt bereits der bestehende Range-Filter ab.
 *  - "Typischer Monat" mittelt über echte, abgeschlossene Kalendermonate.
 *  - "Tendenz" vergleicht den aktuellen mit dem vorhergehenden, gleich langen Zeitraum.
 */

export interface PeriodTotals {
  income: number;
  expenses: number;
  net: number;
}

export interface TypicalMonth extends PeriodTotals {
  /** Anzahl abgeschlossener Monate mit Daten, über die gemittelt wurde. */
  monthsCounted: number;
  /** true, wenn mangels abgeschlossener Monate der laufende Monat einbezogen wurde. */
  partial: boolean;
}

function monthKey(dateISO: string): string {
  return format(parseISO(dateISO), "yyyy-MM");
}

function totalsFor(transactions: Transaction[]): PeriodTotals {
  let income = 0;
  let expenses = 0;
  for (const t of transactions) {
    if (t.is_transfer) continue;
    if (t.amount > 0) income += t.amount;
    else expenses += Math.abs(t.amount);
  }
  return { income, expenses, net: income - expenses };
}

/** Sortierte, eindeutige Monats-Keys (yyyy-MM) der vorhandenen Buchungen. */
export function listMonths(transactions: Transaction[]): string[] {
  const set = new Set<string>();
  for (const t of transactions) {
    if (t.is_transfer) continue;
    set.add(monthKey(t.date));
  }
  return [...set].sort();
}

/**
 * Typischer Monat: Mittelwert über abgeschlossene Kalendermonate mit Daten. Der
 * laufende (unvollständige) Monat wird ausgeschlossen. Existieren keine
 * abgeschlossenen Monate, wird der laufende Monat einbezogen und `partial` gesetzt.
 * Leere Lückenmonate ohne Buchungen deflationieren den Durchschnitt nicht.
 */
export function computeTypicalMonth(transactions: Transaction[], now = new Date()): TypicalMonth {
  const currentKey = format(now, "yyyy-MM");
  const flow = transactions.filter((t) => !t.is_transfer);

  const byMonth = new Map<string, Transaction[]>();
  for (const t of flow) {
    const key = monthKey(t.date);
    const list = byMonth.get(key) || [];
    list.push(t);
    byMonth.set(key, list);
  }

  const completedKeys = [...byMonth.keys()].filter((k) => k < currentKey);
  const usedKeys = completedKeys.length > 0 ? completedKeys : [...byMonth.keys()];
  const partial = completedKeys.length === 0 && byMonth.size > 0;

  if (usedKeys.length === 0) {
    return { income: 0, expenses: 0, net: 0, monthsCounted: 0, partial: false };
  }

  let income = 0;
  let expenses = 0;
  for (const key of usedKeys) {
    const t = totalsFor(byMonth.get(key)!);
    income += t.income;
    expenses += t.expenses;
  }
  const n = usedKeys.length;
  const avgIncome = income / n;
  const avgExpenses = expenses / n;
  return {
    income: avgIncome,
    expenses: avgExpenses,
    net: avgIncome - avgExpenses,
    monthsCounted: n,
    partial,
  };
}

export interface MonthComparison {
  a: PeriodTotals;
  b: PeriodTotals;
  /** Differenz b − a je Kennzahl. */
  delta: PeriodTotals;
  /** Prozentuale Ausgabenänderung von a nach b (null wenn a keine Ausgaben hatte). */
  expensesChangePct: number | null;
}

/**
 * Vergleicht zwei Kalendermonate (yyyy-MM) direkt. Reine Funktion für die
 * Premium-„Monate vergleichen"-Ansicht (Audit P1.5).
 */
export function computeMonthComparison(
  transactions: Transaction[],
  monthA: string,
  monthB: string,
): MonthComparison {
  const a = totalsFor(transactions.filter((t) => !t.is_transfer && monthKey(t.date) === monthA));
  const b = totalsFor(transactions.filter((t) => !t.is_transfer && monthKey(t.date) === monthB));
  const expensesChangePct = a.expenses > 0 ? ((b.expenses - a.expenses) / a.expenses) * 100 : null;
  return {
    a,
    b,
    delta: { income: b.income - a.income, expenses: b.expenses - a.expenses, net: b.net - a.net },
    expensesChangePct,
  };
}

export interface CategoryCause {
  categoryId: string | null;
  /** Veränderung der Ausgaben in dieser Kategorie (aktuell − vorher), positiv = Anstieg. */
  delta: number;
}

export interface TrendResult {
  current: PeriodTotals;
  previous: PeriodTotals;
  /** Differenz des Nettos (current.net − previous.net). */
  deltaNet: number;
  /** Prozentuale Veränderung der Ausgaben ggü. Vorperiode (null wenn Vorperiode 0). */
  expensesChangePct: number | null;
  /** Wichtigste Kategorie-Ursachen für die Ausgabenänderung (größte Beträge zuerst). */
  topCauses: CategoryCause[];
}

function expensesByCategory(transactions: Transaction[]): Map<string | null, number> {
  const map = new Map<string | null, number>();
  for (const t of transactions) {
    if (t.is_transfer || t.amount >= 0) continue;
    const key = t.category_id ?? null;
    map.set(key, (map.get(key) ?? 0) + Math.abs(t.amount));
  }
  return map;
}

/**
 * Tendenz: vergleicht einen aktuellen Zeitraum mit dem unmittelbar
 * vorhergehenden, gleich langen Zeitraum. Liefert absolute Werte, prozentuale
 * Ausgabenänderung und die wichtigsten Kategorie-Ursachen.
 */
export function computeTrend(
  transactions: Transaction[],
  current: { start: Date; end: Date },
): TrendResult {
  const lengthMs = current.end.getTime() - current.start.getTime();
  const prevEnd = new Date(current.start.getTime());
  const prevStart = new Date(current.start.getTime() - lengthMs);

  const inRange = (t: Transaction, start: Date, end: Date) =>
    !t.is_transfer && isWithinInterval(parseISO(t.date), { start, end });

  const currentTx = transactions.filter((t) => inRange(t, current.start, current.end));
  const previousTx = transactions.filter((t) => inRange(t, prevStart, prevEnd));

  const cur = totalsFor(currentTx);
  const prev = totalsFor(previousTx);

  const expensesChangePct = prev.expenses > 0 ? ((cur.expenses - prev.expenses) / prev.expenses) * 100 : null;

  const curByCat = expensesByCategory(currentTx);
  const prevByCat = expensesByCategory(previousTx);
  const cats = new Set<string | null>([...curByCat.keys(), ...prevByCat.keys()]);
  const topCauses: CategoryCause[] = [...cats]
    .map((categoryId) => ({
      categoryId,
      delta: (curByCat.get(categoryId) ?? 0) - (prevByCat.get(categoryId) ?? 0),
    }))
    .filter((c) => Math.abs(c.delta) > 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3);

  return {
    current: cur,
    previous: prev,
    deltaNet: cur.net - prev.net,
    expensesChangePct,
    topCauses,
  };
}
