/**
 * FinRisk – Zell-Details der Wahrscheinlichkeits-Heatmap.
 *
 * Beantwortet die Frage hinter einem Heatmap-Klick: „Welche konkreten Werte
 * haben einen Saldo in DIESER Zelle (Tag × Wert-Bin) erzeugt?" Statt nur P10/P50/
 * P90 zu zeigen, greift dieses Modul auf die je Durchlauf gezogenen Annahmen
 * ({@link TrialAssumptions}) zu, wählt den repräsentativen Pfad der Zelle
 * (vom Engine vorberechnet in `representativeByCell`) und schlüsselt dessen bis
 * zum Tag kumulierte variable Ausgaben je Kategorie auf – jeweils relativ zum
 * Median aller Pfade, denn die Abweichung vom Median ist der eigentliche Treiber,
 * der einen Pfad in eine hohe oder niedrige Zelle bringt.
 *
 * Reine Logik ohne IO – unabhängig testbar.
 */
import { getDaysInMonth, parseISO } from 'date-fns';
import type { DensityField } from './density';
import type { TrialAssumptions } from '../forecast-montecarlo-types';
import type { CompositionItem } from './scenario-payload-types';

/** Anzeigegruppe eines Geldfluss-Postens in der Zell-Zusammensetzung. */
export type CompositionGroup = 'income' | 'fixed' | 'variable' | 'event';

/**
 * Eine Zeile der vollständigen Zell-Zusammensetzung: ein benannter Geldfluss,
 * kumuliert bis zum Tag. `varies` markiert die je Pfad streuenden Posten
 * (variable Ausgaben, perturbierte Einnahmen), die zusätzlich gegen den Median
 * verglichen werden.
 */
export interface CompositionLine {
  name: string;
  group: CompositionGroup;
  /** Signierter kumulierter Betrag bis zum Tag (EUR): + Zufluss, − Abfluss. */
  amount: number;
  /** Streut über die Pfade? Nur dann sind `median`/`deltaPct` gesetzt. */
  varies: boolean;
  /** Median des Betrags über alle Pfade (signiert). */
  median?: number;
  /** Relative Abweichung der Beträge vom Median (auf Magnitude bezogen). */
  deltaPct?: number;
}

/** Beitrag einer variablen Ausgaben-Kategorie zum Saldo der Zelle. */
export interface CategoryContribution {
  category: string;
  /** Bis zum Tag kumulierte Ausgabe dieses Pfads (EUR, positiv). */
  amount: number;
  /** Median der kumulierten Ausgabe über alle Pfade (EUR, positiv). */
  median: number;
  /** Relative Abweichung (amount − median) / median; 0 bei median ≈ 0. */
  deltaPct: number;
}

/** Beitrag eines perturbierten Einnahme-Flows. */
export interface IncomeContribution {
  name: string;
  /** Realisierter Betrag je Vorkommen in diesem Pfad (EUR). */
  amount: number;
  /** Median des realisierten Betrags über alle Pfade (EUR). */
  median: number;
  /** Relative Abweichung (amount − median) / median; 0 bei median ≈ 0. */
  deltaPct: number;
}

/** Aufschlüsselung des repräsentativen Pfads einer Zelle. */
export interface CellRepresentative {
  /** Index in `assumptions` (für Debug/Tests). */
  trial: number;
  /** Repräsentativer Saldo der Zelle (≈ Bin-Zentrum, EUR). */
  value: number;
  /** Kategorien, absteigend nach absoluter Abweichung vom Median sortiert. */
  variableByCategory: CategoryContribution[];
  /** Perturbierte Einnahmen (leer, wenn ohne Income-Volatilität gerechnet). */
  income: IncomeContribution[];
  /** Summe der kumulierten variablen Ausgaben dieses Pfads (EUR). */
  totalVariable: number;
  /** Summe der Mediane der kumulierten variablen Ausgaben (EUR). */
  totalVariableMedian: number;
  /** Größter Einzeltreiber der Abweichung – oder null, wenn keine Kategorien. */
  topDriver: CategoryContribution | null;
  /**
   * Vollständige Zusammensetzung des Saldos bis zu diesem Tag – ein Posten je
   * Einnahme/Fixkosten-Vertrag/variabler Kategorie/geplantem Posten. Gruppiert
   * (Einnahmen → Fixkosten → variabel → geplant), innerhalb der Gruppe nach
   * Betrag absteigend. Leer, wenn keine Posten vorliegen.
   */
  composition: CompositionLine[];
}

/** Vollständiges Detail einer angeklickten Heatmap-Zelle. */
export interface CellDetail {
  day: number;
  date: string;
  bin: number;
  /** Untere Wertkante des Bins (EUR). */
  binLow: number;
  /** Obere Wertkante des Bins (EUR). */
  binHigh: number;
  /** Bin-Zentrum (EUR). */
  binCenter: number;
  /** Perzentil des Bin-Zentrums an diesem Tag (0..100, gerundet). */
  percentile: number;
  /** Anzahl Pfade in dieser Zelle. */
  pathsInCell: number;
  /** Gesamtzahl Pfade. */
  totalPaths: number;
  /** Anteil der Pfade in dieser Zelle (0..1). */
  share: number;
  /** Repräsentativer Pfad – null bei leerer Zelle oder fehlenden Annahmen. */
  representative: CellRepresentative | null;
}

export interface ComputeCellDetailParams {
  density: DensityField;
  /** Annahmen je Durchlauf, aligned mit den Pfaden hinter `density`. */
  assumptions: TrialAssumptions[];
  /** `representativeByCell[tag][bin]` – Trial-Index oder -1. */
  representativeByCell: number[][];
  /** Benannte deterministische Geldfluss-Posten (Einnahmen/Fixkosten/geplant). */
  compositionSchedule?: CompositionItem[];
  day: number;
  bin: number;
}

/** Reihenfolge der Gruppen in der Zusammensetzung. */
const GROUP_ORDER: Record<CompositionGroup, number> = {
  income: 0,
  fixed: 1,
  variable: 2,
  event: 3,
};

/** Median eines Zahlen-Arrays (leeres Array → 0). */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function relativeDelta(amount: number, ref: number): number {
  return Math.abs(ref) < 1e-9 ? 0 : (amount - ref) / ref;
}

/**
 * Kumulierte Ausgabe einer Kategorie bis einschließlich `dayWeights.length - 1`.
 * Spiegelt die geglättete Tagesverteilung der Engine (Monatsbetrag / Monatstage):
 * jeder Tag trägt `monthly[monat] * gewicht` bei, mit `gewicht = 1 / Monatstage`.
 */
function cumulativeToDay(
  monthly: Record<string, number>,
  dayMonths: string[],
  dayWeights: number[],
): number {
  let sum = 0;
  for (let t = 0; t < dayMonths.length; t++) {
    const amount = monthly[dayMonths[t]];
    if (amount) sum += amount * dayWeights[t];
  }
  return sum;
}

/**
 * Leitet das Detail einer Heatmap-Zelle ab. Liefert `null`, wenn das Dichtefeld
 * leer ist oder die Koordinate außerhalb liegt. Bei leeren Zellen oder fehlenden
 * Annahmen bleibt `representative` null, die Verteilungs-Kennzahlen werden aber
 * trotzdem gefüllt.
 */
export function computeCellDetail(params: ComputeCellDetailParams): CellDetail | null {
  const { density, assumptions, representativeByCell, compositionSchedule, day, bin } = params;
  if (!density || density.total === 0 || density.binSize <= 0) return null;
  const nDays = density.dates.length;
  if (day < 0 || day >= nDays) return null;
  if (bin < 0 || bin >= density.bins) return null;

  const binLow = density.valueMin + bin * density.binSize;
  const binHigh = binLow + density.binSize;
  const binCenter = binLow + density.binSize / 2;

  const column = density.counts[day] ?? [];
  let below = 0;
  for (let b = 0; b < bin; b++) below += column[b] ?? 0;
  const within = column[bin] ?? 0;
  // Perzentil des Bin-Zentrums: Masse unterhalb + halbe Zellenmasse (Mittelpunkt).
  const percentile = Math.max(
    0,
    Math.min(100, Math.round(((below + within / 2) / density.total) * 100)),
  );

  const detail: CellDetail = {
    day,
    date: density.dates[day],
    bin,
    binLow,
    binHigh,
    binCenter,
    percentile,
    pathsInCell: within,
    totalPaths: density.total,
    share: density.total > 0 ? within / density.total : 0,
    representative: null,
  };

  const trial = representativeByCell?.[day]?.[bin] ?? -1;
  const repAssumptions = trial >= 0 ? assumptions?.[trial] : undefined;
  if (!repAssumptions) return detail;

  // Tagesgewichte (1 / Monatstage) bis einschließlich `day` – Monatslänge cachen.
  const daysInMonthCache = new Map<string, number>();
  const dayMonths: string[] = new Array(day + 1);
  const dayWeights: number[] = new Array(day + 1);
  for (let t = 0; t <= day; t++) {
    const iso = density.dates[t];
    const monthKey = iso.slice(0, 7);
    let dim = daysInMonthCache.get(monthKey);
    if (dim === undefined) {
      dim = getDaysInMonth(parseISO(iso));
      daysInMonthCache.set(monthKey, dim);
    }
    dayMonths[t] = monthKey;
    dayWeights[t] = dim > 0 ? 1 / dim : 0;
  }

  const variableByCategory: CategoryContribution[] = repAssumptions.variableByCategory.map((cat) => {
    const amount = cumulativeToDay(cat.monthly, dayMonths, dayWeights);
    const acrossTrials = assumptions.map((a) => {
      const match = a.variableByCategory.find((c) => c.category === cat.category);
      return match ? cumulativeToDay(match.monthly, dayMonths, dayWeights) : 0;
    });
    const med = median(acrossTrials);
    return { category: cat.category, amount, median: med, deltaPct: relativeDelta(amount, med) };
  });
  variableByCategory.sort(
    (a, b) => Math.abs(b.amount - b.median) - Math.abs(a.amount - a.median),
  );

  const income: IncomeContribution[] = repAssumptions.income.map((inc) => {
    const acrossTrials = assumptions
      .map((a) => a.income.find((i) => i.name === inc.name)?.sampled)
      .filter((v): v is number => v != null);
    const med = median(acrossTrials);
    return { name: inc.name, amount: inc.sampled, median: med, deltaPct: relativeDelta(inc.sampled, med) };
  });

  const totalVariable = variableByCategory.reduce((s, c) => s + c.amount, 0);
  const totalVariableMedian = variableByCategory.reduce((s, c) => s + c.median, 0);

  // Vollständige Zusammensetzung: benannte deterministische Posten (Einnahmen/
  // Fixkosten/geplant) bis zum Tag kumuliert + variable Kategorien aus den
  // Annahmen. Perturbierte Einnahmen werden mit dem Verhältnis dieses Pfads
  // skaliert und gegen den Median verglichen.
  const composition: CompositionLine[] = [];
  const repIncomeByName = new Map(repAssumptions.income.map((i) => [i.name, i]));
  for (const item of compositionSchedule ?? []) {
    let cum = 0;
    for (const booking of item.bookings) if (booking.day <= day) cum += booking.amount;
    if (Math.abs(cum) < 0.5) continue; // an diesem Tag noch nicht aufgetreten

    const repInc = item.group === 'income' ? repIncomeByName.get(item.name) : undefined;
    if (repInc && repInc.planned !== 0) {
      const ratio = repInc.sampled / repInc.planned;
      const ratios = assumptions.map((a) => {
        const match = a.income.find((x) => x.name === item.name);
        return match && match.planned !== 0 ? match.sampled / match.planned : 1;
      });
      const med = cum * median(ratios);
      const amount = cum * ratio;
      composition.push({
        name: item.name,
        group: 'income',
        amount,
        varies: true,
        median: med,
        deltaPct: relativeDelta(Math.abs(amount), Math.abs(med)),
      });
    } else {
      composition.push({ name: item.name, group: item.group, amount: cum, varies: false });
    }
  }
  for (const cat of variableByCategory) {
    if (cat.amount < 0.5) continue;
    composition.push({
      name: cat.category,
      group: 'variable',
      amount: -cat.amount,
      varies: true,
      median: -cat.median,
      deltaPct: cat.deltaPct,
    });
  }
  composition.sort(
    (a, b) => GROUP_ORDER[a.group] - GROUP_ORDER[b.group] || Math.abs(b.amount) - Math.abs(a.amount),
  );

  detail.representative = {
    trial,
    value: binCenter,
    variableByCategory,
    income,
    totalVariable,
    totalVariableMedian,
    topDriver: variableByCategory[0] ?? null,
    composition,
  };
  return detail;
}
