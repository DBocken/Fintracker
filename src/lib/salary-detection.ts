/**
 * Gehaltserkennung als eigene Produktdomäne (eine Quelle der Wahrheit).
 *
 * Gehalt verhält sich anders als ein Ausgaben-Abo: Es kann die Bank/IBAN
 * wechseln, der Betrag schwankt (Bonus, Überstunden, Steueranpassung) und der
 * Zahler-Text trägt oft den Abrechnungsmonat. Deshalb wird Gehalt bewusst NICHT
 * IBAN-zuerst, sondern nach normalisiertem Arbeitgebernamen gruppiert und über
 * ein Schlüsselwort (Gehalt/Lohn/…) erkannt.
 *
 * Diese reine Funktion ist die gemeinsame Basis für (a) den Liquiditäts-Forecast
 * (`buildDetectedSalaryFlows`) und (b) die Vertragsübersicht
 * (`buildSalaryContractRows`). So erscheint Gehalt überall konsistent.
 */
import { normalizeMerchantName } from '@/services/merchant-normalization';
import type { Transaction } from '@/types';

/** Trifft typische Gehalts-/Lohnbegriffe in Zahler-, Beschreibungs- und Rohtext. */
const SALARY_PATTERN = /\b(gehalt|lohn|salary|entgeltabrechnung|bezüge|besoldung|verdienst)\b/i;

/** Tagesabstand in [min,max] (inkl.) – Monatsraster mit Toleranz. */
const MONTHLY_GAP_MIN = 20;
const MONTHLY_GAP_MAX = 40;
/** Mindestens so viel der Abstände müssen monatlich sein. */
const MONTHLY_GAP_RATIO = 0.7;
/** Höchstalter der letzten Buchung in Tagen, damit die Serie als aktuell gilt. */
const MAX_AGE_DAYS = 50;
/** Mindestanzahl Monate, um einen verlässlichen Rhythmus zu erkennen. */
const MIN_MONTHS = 3;

export interface SalarySeries {
  /** Normalisierter Arbeitgeber-Schlüssel (Gruppierungsgrundlage). */
  employer: string;
  /** Anzeigename (zuletzt gesehener Zahler). */
  payeeLabel: string;
  /** Eine repräsentative Buchung je Monat, aufsteigend nach Datum. */
  monthly: Transaction[];
  /** Alle zugehörigen Buchungen (für Markierung als Vertrag). */
  all: Transaction[];
  /** Median aller Monatsbeträge. */
  amountTypical: number;
  /** Median der letzten bis zu drei Monatsbeträge (für aktuelle Planung). */
  amountRecentTypical: number;
  /** Betrag der jüngsten Buchung. */
  amountLast: number;
  firstDateISO: string;
  lastDateISO: string;
  /** Nächste erwartete Fälligkeit (jüngste + 1 Monat). */
  nextDateISO: string;
  /** Alter der jüngsten Buchung in Tagen (Referenz: now). */
  ageDays: number;
  /** Heuristische Sicherheit (mehr Historie → höher). */
  confidence: number;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function dayDiff(aISO: string, bISO: string): number {
  const a = new Date(`${aISO.slice(0, 10)}T12:00:00`).getTime();
  const b = new Date(`${bISO.slice(0, 10)}T12:00:00`).getTime();
  return Math.round((a - b) / 86_400_000);
}

function addOneMonthISO(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Erkennt aktuelle, regelmäßige Gehaltsserien. Gruppiert nach Arbeitgeber,
 * reduziert auf eine Buchung je Monat und prüft Rhythmus + Aktualität.
 */
export function detectSalarySeries(
  transactions: Transaction[],
  now: Date = new Date(),
): SalarySeries[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (Number(t.amount) <= 0) continue;
    const text = `${t.payee ?? ''} ${t.description ?? ''} ${t.original_text ?? ''}`;
    if (!SALARY_PATTERN.test(text)) continue;
    const employer = normalizeMerchantName(t.payee) || `konto-${t.account_id ?? 'unbekannt'}`;
    const list = groups.get(employer) ?? [];
    list.push(t);
    groups.set(employer, list);
  }

  const result: SalarySeries[] = [];
  for (const [employer, group] of groups) {
    // Höchstens eine repräsentative Buchung pro Monat; Sonderzahlungen im selben
    // Monat dürfen den Rhythmus nicht künstlich verbessern.
    const byMonth = new Map<string, Transaction>();
    for (const t of group) {
      const date = new Date(`${t.date.slice(0, 10)}T12:00:00`);
      if (Number.isNaN(date.getTime())) continue;
      const month = t.date.slice(0, 7);
      const previous = byMonth.get(month);
      if (!previous || t.date > previous.date) byMonth.set(month, t);
    }
    const monthly = [...byMonth.values()].sort((a, b) => a.date.localeCompare(b.date));
    if (monthly.length < MIN_MONTHS) continue;

    const gaps = monthly.slice(1).map((t, i) => dayDiff(t.date, monthly[i].date));
    const monthlyGaps = gaps.filter((d) => d >= MONTHLY_GAP_MIN && d <= MONTHLY_GAP_MAX).length;
    if (gaps.length === 0 || monthlyGaps / gaps.length < MONTHLY_GAP_RATIO) continue;

    const last = monthly.at(-1)!;
    const ageDays = Math.floor(dayDiff(now.toISOString(), last.date));
    if (ageDays > MAX_AGE_DAYS) continue;

    const allAmounts = monthly.map((t) => Math.abs(Number(t.amount)));
    const recentAmounts = allAmounts.slice(-3);

    result.push({
      employer,
      payeeLabel: last.payee?.trim() || 'Gehalt',
      monthly,
      all: group,
      amountTypical: median(allAmounts),
      amountRecentTypical: median(recentAmounts),
      amountLast: Math.abs(Number(last.amount)),
      firstDateISO: monthly[0].date.slice(0, 10),
      lastDateISO: last.date.slice(0, 10),
      nextDateISO: addOneMonthISO(last.date),
      ageDays,
      confidence: monthly.length >= 6 ? 0.95 : 0.8,
    });
  }

  return result;
}
