/**
 * Steuer-Puffer-Faustregel für Creator-/Selbstständigen-Einnahmen.
 *
 * KEINE Steuerberechnung: Es wird ausschließlich ein konfigurierbarer Prozentsatz
 * auf die Summe der steuerrelevanten Einnahmen angewendet. Der tatsächliche
 * Steuersatz kann abweichen — die UI zeigt dazu einen Pflicht-Disclaimer.
 */
import type { UserSettings } from "@/types";
import type { IncomeStream } from "./income-streams";

/**
 * Einkommens-Hauptkategorien, für die eine Steuer-Rücklage sinnvoll ist:
 * Nebenerwerb & Selbstständigkeit, Online & Creator, Verkäufe. Anstellung
 * (Lohnsteuer bereits abgeführt) und staatliche Leistungen bleiben außen vor.
 */
export const TAX_RELEVANT_MAIN_IDS = [
  "local-cat-nebenerwerb",
  "local-cat-onlinecreator",
  "local-cat-verkaeufe",
] as const;

export const DEFAULT_TAX_RESERVE_PERCENT = 30;

/** undefined → Default (30); Clamp auf 0..100; 0 = Feature aus. */
export function resolveTaxReservePercent(
  settings: Pick<UserSettings, "tax_reserve_percent"> | null | undefined,
): number {
  const raw = settings?.tax_reserve_percent;
  if (raw === undefined || raw === null || Number.isNaN(raw)) return DEFAULT_TAX_RESERVE_PERCENT;
  return Math.max(0, Math.min(100, raw));
}

export interface TaxReserveByMain {
  mainCategoryId: string;
  mainCategoryName: string;
  incomeTotal: number;
  reserveAmount: number;
}

export interface TaxReserveResult {
  percent: number;
  incomeTotal: number;
  reserveTotal: number;
  byMain: TaxReserveByMain[];
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * Berechnet die empfohlene Rücklage je steuerrelevanter Hauptkategorie und in
 * Summe. `null`, wenn der Prozentsatz ≤ 0 ist (Feature aus) oder keine
 * relevanten Einnahmen vorliegen.
 */
export function computeTaxReserve(streams: IncomeStream[], percent: number): TaxReserveResult | null {
  if (percent <= 0) return null;

  const relevant = new Set<string>(TAX_RELEVANT_MAIN_IDS);
  const byMainMap = new Map<string, TaxReserveByMain>();

  for (const s of streams) {
    if (!s.mainCategoryId || !relevant.has(s.mainCategoryId)) continue;
    const entry = byMainMap.get(s.mainCategoryId) ?? {
      mainCategoryId: s.mainCategoryId,
      mainCategoryName: s.mainCategoryName,
      incomeTotal: 0,
      reserveAmount: 0,
    };
    entry.incomeTotal += s.totalInWindow;
    byMainMap.set(s.mainCategoryId, entry);
  }

  if (byMainMap.size === 0) return null;

  const byMain = [...byMainMap.values()]
    .map((e) => ({ ...e, incomeTotal: round2(e.incomeTotal), reserveAmount: round2(e.incomeTotal * (percent / 100)) }))
    .sort((a, b) => b.incomeTotal - a.incomeTotal);

  const incomeTotal = round2(byMain.reduce((sum, e) => sum + e.incomeTotal, 0));
  const reserveTotal = round2(incomeTotal * (percent / 100));

  return { percent, incomeTotal, reserveTotal, byMain };
}
