/**
 * Pure Jahres-Aggregation steuerrelevanter Buchungen. Deterministisch und ohne
 * Seiteneffekte (Muster wie cloud-mcp-sync-service). Die UI ruft dies via useMemo
 * über die geladenen Transaktionen + das Jahres-Steuer-Profil auf.
 *
 * Kernregeln:
 * - Jahreszuordnung nach Buchungsdatum (Abflussprinzip §11 EStG).
 * - Interne Überträge (`is_transfer`) zählen NIE, auch nicht wenn markiert.
 * - Ausgaben (`amount < 0`) zählen als Kosten; positive markierte Beträge sind
 *   Erstattungen und MINDERN die Rubrik (Netto, Clamp auf 0 + Warnung).
 * - §35a Abs. 3 (Handwerker): nur `tax_labor_costs` ist begünstigt; fehlt der
 *   Wert, werden 0 € angesetzt und eine Warnung ausgegeben (nie 100 % annehmen).
 * - EÜR-Rubriken (Anlage 'euer') sind AUSGESCHLOSSEN: Betriebseinnahmen/-ausgaben
 *   wertet buildEuerReport separat aus (eigene Netting-Regeln, Bewirtung 70 %) —
 *   hier mitzuzählen wäre eine Doppelzählung mit falscher Mathematik.
 */
import type { Transaction } from '@/types';
import {
  TAX_RUBRICS,
  getRubricForCategory,
  taxCategoryById,
  getTaxParams,
  compute35aCredit,
  computePendlerpauschale,
  computeHomeofficePauschale,
  type Credit35aTrace,
  type TaxRubric,
  type TaxRubricId,
  type TaxYearParams,
} from '@/data/tax-catalog';
import type { TaxYearProfile } from '@/services/tax-profile-service';

export type TaxWarningKind =
  | 'missingLaborCosts'
  | 'capCostsExceeded'
  | 'capCreditReached'
  | 'negativeNet'
  | 'paramsNotExact';

export interface TaxReportWarning {
  kind: TaxWarningKind;
  count?: number;
  amount?: number;
}

export interface TaxCategorySum {
  taxCategoryId: string;
  costs: number;
  refunds: number;
  net: number;
  txCount: number;
}

export interface TaxVirtualItem {
  labelKey: string;
  amount: number;
}

export interface TaxThreshold {
  value: number;
  reached: boolean;
  remaining: number;
}

export interface TaxRubricReport {
  rubricId: TaxRubricId;
  anlage: TaxRubric['anlage'];
  kind: TaxRubric['kind'];
  informationalOnly: boolean;
  /** Netto-Kosten (Erstattungen abgezogen, Clamp auf 0). */
  costsTotal: number;
  /** Begünstigte Kosten nach laborOnly + Kosten-Höchstbetrag (nur credit). */
  eligibleCosts: number;
  /** Exakte Steuerermäßigung (§35a); null bei deduction-Rubriken. */
  credit: number | null;
  /** Ausschöpfung 0..1 des Ermäßigungs-Höchstbetrags; null bei deduction. */
  capUtilization: number | null;
  /** Kosten-Höchstbetrag (für Fortschrittsanzeige); null bei deduction. */
  capCosts: number | null;
  /** Vollständiger Rechenweg (§35a); null bei deduction/informational. */
  calculation: Credit35aTrace | null;
  /** Pauschbetrag-Schwelle (Anlage N); null sonst. */
  threshold: TaxThreshold | null;
  /** Virtuelle Posten aus dem Jahres-Profil (Pendler-/Homeoffice-Pauschale). */
  virtualItems: TaxVirtualItem[];
  byCategory: TaxCategorySum[];
  transactionIds: string[];
  warnings: TaxReportWarning[];
}

export interface TaxYearReport {
  year: number;
  paramsExact: boolean;
  paramsUsedYear: number;
  rubrics: TaxRubricReport[];
  markedTotal: number;
  creditTotal: number;
  txCount: number;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function paramValue(params: TaxYearParams, key: keyof TaxYearParams | undefined): number {
  if (!key) return 0;
  return params[key];
}

/** Rubriken, die immer angezeigt werden (auch ohne Daten) – die Kern-Wertversprechen. */
const ALWAYS_SHOWN: TaxRubricId[] = ['35a-handwerker', '35a-dienstleistungen', 'werbungskosten'];

/**
 * Gibt es EÜR-markierte Buchungen? Steuert die Pointer-Karte auf /tax:
 * Bestandsdaten dürfen durch die Entkopplung nie unsichtbar werden.
 */
export function hasEuerMarkings(transactions: Transaction[]): boolean {
  return transactions.some(
    (tx) => tx.tax_category_id && getRubricForCategory(tx.tax_category_id)?.anlage === 'euer',
  );
}

export function buildTaxYearReport(
  transactions: Transaction[],
  year: number,
  profile: TaxYearProfile | null,
): TaxYearReport {
  const { params, exact } = getTaxParams(year);
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;

  // Markierte, jahres- und nicht-transfer-relevante Buchungen einsammeln.
  const marked = transactions.filter(
    (tx) =>
      tx.tax_category_id &&
      !tx.is_transfer &&
      typeof tx.date === 'string' &&
      tx.date >= from &&
      tx.date <= to &&
      taxCategoryById.has(tx.tax_category_id),
  );

  // Gruppieren nach Rubrik → Kategorie.
  interface Bucket {
    byCat: Map<string, TaxCategorySum>;
    txIds: string[];
    laborCostsSum: number;
    missingLaborCount: number;
  }
  const buckets = new Map<TaxRubricId, Bucket>();

  for (const tx of marked) {
    const rubric = getRubricForCategory(tx.tax_category_id!);
    if (!rubric || rubric.anlage === 'euer') continue;
    const bucket =
      buckets.get(rubric.id) ??
      ({ byCat: new Map(), txIds: [], laborCostsSum: 0, missingLaborCount: 0 } as Bucket);

    const cat =
      bucket.byCat.get(tx.tax_category_id!) ??
      ({ taxCategoryId: tx.tax_category_id!, costs: 0, refunds: 0, net: 0, txCount: 0 } as TaxCategorySum);

    if (tx.amount < 0) {
      cat.costs += Math.abs(tx.amount);
    } else {
      // Positive markierte Beträge = Erstattung, mindern die Rubrik.
      cat.refunds += tx.amount;
    }
    cat.txCount += 1;
    bucket.byCat.set(tx.tax_category_id!, cat);
    if (tx.id) bucket.txIds.push(tx.id);

    // §35a Abs. 3: nur der Arbeitskostenanteil zählt.
    if (rubric.laborCostOnly) {
      if (tx.amount < 0 && (tx.tax_labor_costs === null || tx.tax_labor_costs === undefined)) {
        bucket.missingLaborCount += 1;
      } else if (tx.amount < 0) {
        bucket.laborCostsSum += tx.tax_labor_costs ?? 0;
      }
    }

    buckets.set(rubric.id, bucket);
  }

  const rubrics: TaxRubricReport[] = [];
  let markedTotal = 0;
  let creditTotal = 0;
  let txCount = 0;

  for (const rubric of TAX_RUBRICS) {
    if (rubric.anlage === 'euer') continue;
    const bucket = buckets.get(rubric.id);
    const hasData = Boolean(bucket && bucket.byCat.size > 0);
    if (!hasData && !ALWAYS_SHOWN.includes(rubric.id)) continue;

    const warnings: TaxReportWarning[] = [];
    if (!exact) warnings.push({ kind: 'paramsNotExact' });

    const byCategory: TaxCategorySum[] = [];
    let costsTotal = 0;
    for (const cat of bucket?.byCat.values() ?? []) {
      const net = round2(cat.costs - cat.refunds);
      const clamped = Math.max(0, net);
      if (net < 0) warnings.push({ kind: 'negativeNet', amount: round2(-net) });
      byCategory.push({
        taxCategoryId: cat.taxCategoryId,
        costs: round2(cat.costs),
        refunds: round2(cat.refunds),
        net: clamped,
        txCount: cat.txCount,
      });
      costsTotal += clamped;
    }
    costsTotal = round2(costsTotal);
    byCategory.sort((a, b) => b.net - a.net);

    const txIds = bucket?.txIds ?? [];
    txCount += txIds.length;
    markedTotal = round2(markedTotal + costsTotal);

    let credit: number | null = null;
    let capUtilization: number | null = null;
    let capCosts: number | null = null;
    let calculation: Credit35aTrace | null = null;
    let eligibleCosts = 0;

    if (rubric.kind === 'credit' && !rubric.informationalOnly) {
      capCosts = paramValue(params, rubric.capCostsParam);
      const rate = paramValue(params, rubric.creditRateParam);
      const capCredit = paramValue(params, rubric.capCreditParam);
      // Handwerker: nur Arbeitskosten; sonst die (netto) Kosten selbst.
      const base = rubric.laborCostOnly ? round2(bucket?.laborCostsSum ?? 0) : costsTotal;
      const result = compute35aCredit(base, rate, capCosts, capCredit);
      eligibleCosts = result.cappedCosts;
      credit = result.credit;
      capUtilization = result.capUtilization;
      calculation = result.trace;
      creditTotal = round2(creditTotal + credit);
      if (result.capCostsExceeded) warnings.push({ kind: 'capCostsExceeded' });
      if (result.capUtilization >= 1) warnings.push({ kind: 'capCreditReached' });
      if (rubric.laborCostOnly && bucket && bucket.missingLaborCount > 0) {
        warnings.push({ kind: 'missingLaborCosts', count: bucket.missingLaborCount });
      }
    } else if (rubric.informationalOnly) {
      eligibleCosts = costsTotal;
    }

    // Pauschbetrag-Schwelle (Werbungskosten/Anlage N).
    let threshold: TaxThreshold | null = null;
    const virtualItems: TaxVirtualItem[] = [];
    if (rubric.id === 'werbungskosten') {
      if (profile) {
        const pendler = computePendlerpauschale(
          profile.commuteDaysPerYear ?? 0,
          profile.commuteOneWayKm ?? 0,
          params,
        );
        const homeoffice = computeHomeofficePauschale(profile.homeofficeDays ?? 0, params);
        if (pendler > 0) virtualItems.push({ labelKey: 'tax.commute.pendlerResult', amount: pendler });
        if (homeoffice > 0) virtualItems.push({ labelKey: 'tax.commute.homeofficeResult', amount: homeoffice });
      }
      const virtualSum = virtualItems.reduce((s, v) => s + v.amount, 0);
      const totalForThreshold = round2(costsTotal + virtualSum);
      const thresholdValue = paramValue(params, rubric.thresholdParam);
      threshold = {
        value: thresholdValue,
        reached: totalForThreshold > thresholdValue,
        remaining: round2(Math.max(0, thresholdValue - totalForThreshold)),
      };
    }

    rubrics.push({
      rubricId: rubric.id,
      anlage: rubric.anlage,
      kind: rubric.kind,
      informationalOnly: Boolean(rubric.informationalOnly),
      costsTotal,
      eligibleCosts,
      credit,
      capUtilization,
      capCosts,
      calculation,
      threshold,
      virtualItems,
      byCategory,
      transactionIds: txIds,
      warnings,
    });
  }

  return {
    year,
    paramsExact: exact,
    paramsUsedYear: params.vz,
    rubrics,
    markedTotal,
    creditTotal,
    txCount,
  };
}
