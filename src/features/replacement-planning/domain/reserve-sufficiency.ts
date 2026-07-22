import { differenceInCalendarMonths, parseISO } from 'date-fns';
import {
  developedReplacementCostMinor,
  monthsUntilReplacement,
  monthlyReserveContributionMinor,
  priceUncertaintyCv,
  resolveReplacementDate,
  type ReplacementConfig,
  type ReplacementPlan,
} from './replacement-plan';

/**
 * Rücklagen-Suffizienz und erwarteter Fehlbetrag (Slice A4, #242). Reines
 * Post-Processing — analytisch geschlossen über die lognormale Preisunsicherheit
 * (Muster: pure Risiko-Aufbereitung wie `src/lib/finrisk/breach.ts`). Kein
 * Zugriff auf Monte-Carlo-Pfade nötig; deterministisch testbar.
 *
 * Modell: Der Ersatzpreis ist lognormal um den erwarteten (preisentwickelten)
 * Preis verteilt (Erwartungswert = developedCost, Variationskoeffizient je
 * Preismodus, D6). Gefragt wird, ob die Rücklage beim Ersatz reicht.
 */

/** Fehlerfunktion (Abramowitz-Stegun 7.1.26) — für die Normalverteilungs-CDF. */
function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

function normalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

export interface ReserveSufficiency {
  expectedCostMinor: number;
  reserveMinor: number;
  /** Wahrscheinlichkeit, dass die Rücklage den Ersatzpreis deckt (0..1). */
  sufficiencyProbability: number;
  /** Erwarteter Fehlbetrag E[max(0, Preis − Rücklage)] in Cent (≥ 0). */
  expectedShortfallMinor: number;
}

/**
 * Suffizienz eines einzelnen Plans. `reserveMinor` (Default: die aktuelle
 * Rücklage) ist die zu prüfende Rücklage — der Aufrufer kann auch die projizierte
 * Rücklage übergeben (`projectedReserveMinor`).
 */
export function reserveSufficiency(
  plan: ReplacementPlan,
  config: ReplacementConfig,
  options: { reserveMinor?: number } = {},
): ReserveSufficiency {
  const expectedCostMinor = developedReplacementCostMinor(plan, config);
  const reserveMinor = options.reserveMinor ?? plan.reserve_minor;

  if (expectedCostMinor <= 0) {
    return { expectedCostMinor, reserveMinor, sufficiencyProbability: 1, expectedShortfallMinor: 0 };
  }

  const cv = priceUncertaintyCv(plan);
  if (cv <= 0) {
    // Kein Preisrisiko ⇒ deterministisch.
    const covers = reserveMinor >= expectedCostMinor;
    return {
      expectedCostMinor,
      reserveMinor,
      sufficiencyProbability: covers ? 1 : 0,
      expectedShortfallMinor: Math.max(0, expectedCostMinor - reserveMinor),
    };
  }

  const sigma = Math.sqrt(Math.log(1 + cv * cv));
  const k = reserveMinor / expectedCostMinor; // Rücklage relativ zum Erwartungspreis
  const lnK = Math.log(k); // k=0 ⇒ -Infinity, sauber von normalCdf verarbeitet
  const d1 = (-lnK + (sigma * sigma) / 2) / sigma;
  const d2 = d1 - sigma;

  const sufficiencyProbability = normalCdf((lnK + (sigma * sigma) / 2) / sigma);
  const expectedShortfallMinor = Math.round(
    expectedCostMinor * (normalCdf(d1) - k * normalCdf(d2)),
  );

  return { expectedCostMinor, reserveMinor, sufficiencyProbability, expectedShortfallMinor };
}

/** Projizierte Rücklage beim Ersatz: aktuelle Rücklage + geplante Beiträge. */
export function projectedReserveMinor(plan: ReplacementPlan, config: ReplacementConfig): number {
  const months = monthsUntilReplacement(plan, config);
  return plan.reserve_minor + monthlyReserveContributionMinor(plan, config) * months;
}

export interface AggregateReplacementRisk {
  totalExpectedShortfallMinor: number;
  /** Kleinste Einzel-Suffizienz — der schwächste Plan bestimmt das Gesamtrisiko. */
  minSufficiencyProbability: number;
  perPlan: (ReserveSufficiency & { id: string })[];
}

/** Gesamtrisiko über mehrere Pläne (erwarteter Fehlbetrag summiert). */
export function aggregateReplacementRisk(
  plans: ReplacementPlan[],
  config: ReplacementConfig,
  options: { useProjectedReserve?: boolean } = {},
): AggregateReplacementRisk {
  const perPlan = plans.map((plan) => {
    const reserveMinor = options.useProjectedReserve
      ? projectedReserveMinor(plan, config)
      : plan.reserve_minor;
    return { id: plan.id, ...reserveSufficiency(plan, config, { reserveMinor }) };
  });

  return {
    totalExpectedShortfallMinor: perPlan.reduce((sum, p) => sum + p.expectedShortfallMinor, 0),
    minSufficiencyProbability: perPlan.reduce(
      (min, p) => Math.min(min, p.sufficiencyProbability),
      1,
    ),
    perPlan,
  };
}

export interface ReplacementCluster {
  planIds: string[];
  startDate: string;
  endDate: string;
}

/**
 * Gruppiert Pläne, deren Ersatztermine innerhalb von `windowMonths` beieinander
 * liegen (gemeinsame Wirkung mehrerer Ersatzereignisse). Nach Termin sortiert;
 * ein Cluster entsteht, sobald der nächste Termin ≤ `windowMonths` nach dem
 * Cluster-Beginn liegt.
 */
export function overlappingReplacements(
  plans: ReplacementPlan[],
  config: ReplacementConfig,
  windowMonths = 3,
): ReplacementCluster[] {
  const dated = plans
    .map((plan) => ({ id: plan.id, date: resolveReplacementDate(plan, config) }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const clusters: ReplacementCluster[] = [];
  for (const entry of dated) {
    const last = clusters[clusters.length - 1];
    if (
      last &&
      differenceInCalendarMonths(parseISO(entry.date), parseISO(last.startDate)) <= windowMonths
    ) {
      last.planIds.push(entry.id);
      last.endDate = entry.date;
    } else {
      clusters.push({ planIds: [entry.id], startDate: entry.date, endDate: entry.date });
    }
  }
  return clusters.filter((c) => c.planIds.length > 1);
}
