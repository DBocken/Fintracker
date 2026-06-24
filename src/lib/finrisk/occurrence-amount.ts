/**
 * FinRisk – Occurrence-Amount-Modell (PR 3)
 *
 * Variable Buchungslinien sind spiky: an manchen Tagen passiert nichts, an
 * anderen eine größere Ausgabe. Ein geglätteter Tagesbetrag (PR 2) ist für den
 * deterministischen Pfad richtig, erzeugt im Monte-Carlo aber unrealistisch
 * glatte Saldo-Verläufe. Dieses zweistufige Modell trennt:
 *   Stufe 1 – Tritt an einem Tag eine Ausgabe auf? (Wochentags-Wahrscheinlichkeit)
 *   Stufe 2 – Wenn ja, wie hoch? (lognormale Streuung)
 *
 * Reine Logik ohne IO. Erwartungstreu: über viele Trials trifft die erwartete
 * Monatssumme exakt den Zielwert (Kalibrierung in `sampleOccurrenceMonth`).
 * Speist ausschließlich den Monte-Carlo-Pfad.
 */
import { getDay, startOfMonth, subMonths } from 'date-fns';
import { merchantFingerprint } from '../merchant-fingerprint';
import type { OccurrenceModel } from '../forecast-types';
import type { Transaction } from '@/types';

export type { OccurrenceModel };

export interface OccurrenceModelOptions {
  /** Mindestzahl aktiver Ausgabetage je Kategorie, sonst kein Modell. Default 12. */
  minActiveDays?: number;
  /** Historien-Fenster in Monaten. Default 12. */
  monthsBack?: number;
  now?: Date;
  excludedFingerprints?: ReadonlySet<string>;
  categoryNames?: ReadonlyMap<string, string>;
}

function categoryOf(t: Transaction, names?: ReadonlyMap<string, string>): string {
  return t.category?.trim() || (t.category_id ? names?.get(t.category_id) : undefined) || 'Sonstiges';
}

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Leitet je Kategorie ein Occurrence-Amount-Modell aus der Historie ab.
 *
 * @returns Map Kategorie → Modell. Kategorien mit zu wenig aktiven Tagen fehlen
 *          (Aufrufer behält dann die geglättete Verteilung).
 */
export function buildOccurrenceModel(
  transactions: Transaction[],
  options: OccurrenceModelOptions = {},
): Map<string, OccurrenceModel> {
  const minActiveDays = options.minActiveDays ?? 12;
  const monthsBack = options.monthsBack ?? 12;
  const now = options.now ?? new Date();
  const windowStart = startOfMonth(subMonths(now, Math.max(0, monthsBack - 1)));

  // Kalendertage je Wochentag im Fenster (Nenner für die Wahrscheinlichkeit).
  const weekdayCalendarDays = new Array(7).fill(0);
  for (let d = new Date(windowStart); d <= now; d = new Date(d.getTime() + 86400000)) {
    weekdayCalendarDays[getDay(d)] += 1;
  }

  // Pro Kategorie: Tagessummen (ein Eintrag je Datum mit Ausgabe).
  const perCategory = new Map<string, Map<string, { amount: number; dow: number }>>();
  for (const t of transactions) {
    if (t.is_transfer || t.is_contract) continue;
    if (t.amount >= 0) continue;
    if (options.excludedFingerprints?.has(merchantFingerprint(t))) continue;
    const date = new Date(t.date);
    if (Number.isNaN(date.getTime())) continue;
    if (date < windowStart || date > now) continue;
    const category = categoryOf(t, options.categoryNames);
    let byDate = perCategory.get(category);
    if (!byDate) {
      byDate = new Map();
      perCategory.set(category, byDate);
    }
    const key = isoOf(date);
    const existing = byDate.get(key);
    if (existing) existing.amount += Math.abs(t.amount);
    else byDate.set(key, { amount: Math.abs(t.amount), dow: getDay(date) });
  }

  const result = new Map<string, OccurrenceModel>();
  for (const [category, byDate] of perCategory) {
    if (byDate.size < minActiveDays) continue;

    const activeByWeekday = new Array(7).fill(0);
    const amounts: number[] = [];
    for (const { amount, dow } of byDate.values()) {
      activeByWeekday[dow] += 1;
      amounts.push(amount);
    }

    const weekdayProb = activeByWeekday.map((active, d) =>
      weekdayCalendarDays[d] > 0 ? Math.min(1, active / weekdayCalendarDays[d]) : 0,
    );

    const mean = amounts.reduce((s, v) => s + v, 0) / amounts.length;
    const variance = amounts.reduce((s, v) => s + (v - mean) ** 2, 0) / amounts.length;
    const amountCv = mean > 0 ? Math.sqrt(variance) / mean : 0;

    result.set(category, {
      weekdayProb: weekdayProb.map((p) => Math.round(p * 1000) / 1000),
      amountCv: Math.round(amountCv * 1000) / 1000,
    });
  }

  return result;
}

/** Lognormaler Multiplikator mit Erwartungswert 1 und Variationskoeffizient cv. */
function lognormalMultiplier(normal: () => number, cv: number): number {
  if (cv <= 0) return 1;
  const sigma = Math.sqrt(Math.log(1 + cv * cv));
  const z = normal();
  return Math.exp(sigma * z - (sigma * sigma) / 2);
}

/**
 * Zieht für einen Monat die Tagesbeträge (in der Einheit von `targetMonthly`).
 *
 * Kalibrierung: `meanPerEvent = targetMonthly / Σ_d weekdayProb[dow(d)]` über
 * **alle** Tage des Monats. Damit ist der Erwartungswert der Monatssumme exakt
 * `targetMonthly` (erwartungstreu); für ein Teilfenster ist er anteilig.
 *
 * @param model        Occurrence-Modell der Kategorie.
 * @param fullWeekdays Wochentage **aller** Monatstage (Kalibrier-Nenner).
 * @param emitWeekdays Wochentage der zu ziehenden Tage (z. B. nur im Horizont).
 * @param targetMonthly Zielsumme des Monats.
 * @param normal       Standardnormal-Ziehung (Box-Muller).
 * @param rng          Uniform-PRNG in [0,1) für die Ereignis-Ziehung.
 */
export function sampleOccurrenceMonth(
  model: OccurrenceModel,
  fullWeekdays: number[],
  emitWeekdays: number[],
  targetMonthly: number,
  normal: () => number,
  rng: () => number,
): number[] {
  const denom = fullWeekdays.reduce((s, d) => s + (model.weekdayProb[d] ?? 0), 0);
  if (denom <= 0 || targetMonthly <= 0) return new Array(emitWeekdays.length).fill(0);
  const meanPerEvent = targetMonthly / denom;

  return emitWeekdays.map((d) => {
    const p = model.weekdayProb[d] ?? 0;
    if (p > 0 && rng() < p) {
      return meanPerEvent * lognormalMultiplier(normal, model.amountCv);
    }
    return 0;
  });
}
