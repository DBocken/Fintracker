/**
 * Forecast Engine – Tagesprofil für variable Ausgaben (PR 2)
 *
 * Der bisherige Forecast verteilt die monatliche variable Baseline **linear**
 * über jeden Monatstag (`forecast.ts`: `monthlyCents / daysInMonth`). Das erzeugt
 * den unrealistischen linearen Saldo-Abfall zwischen Gehaltstagen. Dieses Modul
 * leitet aus der Historie ein **Wochentags-Profil** je Kategorie ab und verteilt
 * den Monatsbetrag profilgewichtet – die Monatssumme bleibt dabei **exakt**
 * erhalten (Largest-Remainder auf ganze Cent, kein Float-Drift).
 *
 * Reine Logik ohne IO. Robust gegen Spikes (Winsorisierung) und gegen dünne
 * Daten (Schrumpfung Richtung neutral + Mindest-Transaktionszahl).
 */
import { getDay, startOfMonth, subMonths } from 'date-fns';
import { merchantFingerprint } from './merchant-fingerprint';
import type { DailySpendingProfile } from './forecast-types';
import type { Transaction } from '@/types';

export type { DailySpendingProfile };

/**
 * Linear interpoliertes Perzentil eines aufsteigend sortierten Arrays (p in
 * 0..100). Lokal gehalten, damit dieses Modul keine Laufzeit-Abhängigkeit auf
 * den Monte-Carlo-Layer hat (vermeidet einen Import-Zyklus mit `forecast.ts`).
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

export interface DailyProfileOptions {
  /** Mindestzahl an Transaktionen je Kategorie, sonst kein Profil. Default 20. */
  minTransactions?: number;
  /** Historien-Fenster in Monaten. Default 12 (Wochentagsmuster über ein Jahr). */
  monthsBack?: number;
  now?: Date;
  excludedFingerprints?: ReadonlySet<string>;
  categoryNames?: ReadonlyMap<string, string>;
  /** Schrumpfung Richtung neutral (0 = roh, 1 = komplett neutral). Default 0.25. */
  shrinkage?: number;
}

const NEUTRAL_WEIGHTS = [1, 1, 1, 1, 1, 1, 1];

/** Neutrales (flaches) Profil – äquivalent zur bisherigen Linearverteilung. */
export function neutralProfile(): DailySpendingProfile {
  return { weekdayWeights: [...NEUTRAL_WEIGHTS] };
}

function categoryOf(t: Transaction, names?: ReadonlyMap<string, string>): string {
  return t.category?.trim() || (t.category_id ? names?.get(t.category_id) : undefined) || 'Sonstiges';
}

/**
 * Leitet je Kategorie ein Wochentags-Profil aus der Historie ab.
 *
 * @returns Map Kategorie → Profil. Kategorien mit zu wenig Daten fehlen bewusst
 *          (Aufrufer fällt dann auf die Linearverteilung zurück).
 */
export function buildDailySpendingProfile(
  transactions: Transaction[],
  options: DailyProfileOptions = {},
): Map<string, DailySpendingProfile> {
  const minTransactions = options.minTransactions ?? 20;
  const monthsBack = options.monthsBack ?? 12;
  const now = options.now ?? new Date();
  const shrinkage = Math.min(Math.max(options.shrinkage ?? 0.25, 0), 1);
  const windowStart = startOfMonth(subMonths(now, Math.max(0, monthsBack - 1)));

  // Pro Kategorie alle Tagesausgaben (Betrag, Wochentag) sammeln.
  const perCategory = new Map<string, Array<{ amount: number; dow: number }>>();
  for (const t of transactions) {
    if (t.is_transfer || t.is_contract) continue;
    if (t.amount >= 0) continue;
    if (options.excludedFingerprints?.has(merchantFingerprint(t))) continue;
    const date = new Date(t.date);
    if (Number.isNaN(date.getTime())) continue;
    if (date < windowStart || date > now) continue;
    const category = categoryOf(t, options.categoryNames);
    let list = perCategory.get(category);
    if (!list) {
      list = [];
      perCategory.set(category, list);
    }
    list.push({ amount: Math.abs(t.amount), dow: getDay(date) });
  }

  const result = new Map<string, DailySpendingProfile>();
  for (const [category, entries] of perCategory) {
    if (entries.length < minTransactions) continue;

    // Winsorisierung: Großausgaben auf das 95. Perzentil kappen, damit einzelne
    // Lumpy-Events das Wochentagsmuster nicht dominieren.
    const sortedAmounts = entries.map((e) => e.amount).sort((a, b) => a - b);
    const cap = percentile(sortedAmounts, 95);
    const sumByDow = new Array(7).fill(0);
    for (const e of entries) sumByDow[e.dow] += Math.min(e.amount, cap);

    const mean = sumByDow.reduce((s, v) => s + v, 0) / 7;
    if (mean <= 0) continue;

    // Rohgewicht, Schrumpfung Richtung neutral, Renormierung auf Mittel 1.0.
    const shrunk = sumByDow.map((v) => {
      const raw = v / mean;
      return (1 - shrinkage) * raw + shrinkage * 1;
    });
    const shrunkMean = shrunk.reduce((s, v) => s + v, 0) / 7;
    const weekdayWeights = shrunk.map((w) => Math.round((w / shrunkMean) * 1000) / 1000);
    result.set(category, { weekdayWeights });
  }

  return result;
}

/**
 * Verteilt `monthlyCents` profilgewichtet auf die Tage eines Monats. Die Summe
 * der Rückgabe ist **exakt** `monthlyCents` (Largest-Remainder, ganze Cent).
 *
 * @param monthlyCents Monatsbetrag in Cent (>= 0).
 * @param weekdays     Wochentag (`getDay()`) je Tag des Monats, in Tagesreihenfolge.
 * @param profile      Wochentags-Profil; neutral verhält sich wie Linearverteilung.
 */
export function distributeMonthlyByProfile(
  monthlyCents: number,
  weekdays: number[],
  profile: DailySpendingProfile,
): number[] {
  const n = weekdays.length;
  if (n === 0 || monthlyCents <= 0) return new Array(n).fill(0);

  const weights = weekdays.map((d) => Math.max(0, profile.weekdayWeights[d] ?? 1));
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  // Entartetes Profil (alle 0) → gleichmäßig.
  const raw =
    totalWeight > 0
      ? weights.map((w) => (monthlyCents * w) / totalWeight)
      : new Array(n).fill(monthlyCents / n);

  const result = raw.map((v) => Math.floor(v));
  const used = result.reduce((s, v) => s + v, 0);
  const remainder = monthlyCents - used; // < n, ganze Cent zu verteilen

  // Rest-Cent an die größten Nachkommaanteile (Tie-Break: früherer Tag zuerst –
  // identisch zur bisherigen Linearverteilung bei neutralem Profil).
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; k < remainder; k++) result[order[k].i] += 1;

  return result;
}
