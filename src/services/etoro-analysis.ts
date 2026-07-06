import type { EtoroAggregatePortfolioResponse } from './etoro-api-schemas';

// -----------------------------------------------------------------------------
// Analyse (Sektor-Exposure, Gebühren-/P&L-Breakdown) — reine Selektor-
// Funktionen über die BEREITS geladene aggregate-portfolio-Antwort (geteilte
// Query mit Übersicht/Smart-Portfolios, siehe TradingDashboard). Kein eigener
// Konto-Fetch hier — nur Ableitung fürs UI (EtoroAnalysisTab), analog
// etoro-mirrors.ts/etoro-history.ts.
//
// stocksIndustryId steht NICHT in den instrumentAggregates selbst (die kennen
// nur instrumentId + Kennzahlen) — die Zuordnung kommt aus der
// Instrument-Metadaten-Auflösung (fetchEtoroInstrumentMeta), der Branchenname
// aus fetchEtoroStocksIndustries. Beide werden hier nur als Maps entgegen-
// genommen, nicht selbst geladen.
// -----------------------------------------------------------------------------

export interface SectorExposureView {
  /** null = keine Branche zugeordnet (Instrument-Metadaten fehlten/unauflösbar). */
  industryId: number | null;
  /** undefined = Branchenname nicht auflösbar; Komponente zeigt Fallback ("Branche #<id>"). */
  industryName: string | undefined;
  /** Σ |netCurrentExposureAccountCurrency| (USD) aller Instrumente dieser Branche. */
  exposure: number;
  /** Anteil an der Gesamt-Exposure über alle Instrumente (0..100). */
  percent: number;
}

/**
 * Gruppiert die Instrument-Aggregate nach Branche (stocksIndustryId) und
 * summiert die aktuelle Exposure je Branche. Exposure wird absolut gerechnet
 * (Short-Positionen zählen mit vollem Betrag zur Branchen-Konzentration, nicht
 * gegenläufig zu Long-Positionen derselben Branche).
 */
export function selectSectorExposure(
  aggregate: EtoroAggregatePortfolioResponse | undefined,
  instrumentIndustryMap: Map<number, number | undefined>,
  industryNameMap: Map<number, string>,
): SectorExposureView[] {
  const instrumentAggregates = aggregate?.instrumentAggregates ?? [];
  const byIndustry = new Map<number | null, number>();

  for (const inst of instrumentAggregates) {
    const industryId = instrumentIndustryMap.get(inst.instrumentId) ?? null;
    const exposure = Math.abs(inst.netCurrentExposureAccountCurrency ?? 0);
    byIndustry.set(industryId, (byIndustry.get(industryId) ?? 0) + exposure);
  }

  const total = [...byIndustry.values()].reduce((sum, v) => sum + v, 0);

  return [...byIndustry.entries()]
    .map(([industryId, exposure]) => ({
      industryId,
      industryName: industryId != null ? industryNameMap.get(industryId) : undefined,
      exposure,
      percent: total > 0 ? (exposure / total) * 100 : 0,
    }))
    .sort((a, b) => b.exposure - a.exposure);
}

export interface InstrumentBreakdownView {
  instrumentId: number;
  /** Σ totalFeesAcctCcy (USD), Fallback totalFees. */
  fees: number;
  /** Σ totalTaxesAcctCcy (USD), Fallback totalTaxes. */
  taxes: number;
  /**
   * accountCurrencyReturn (USD) — laut Live-Spec-Beispiel ein kleiner
   * absoluter $-Betrag (z. B. -10), nicht zu verwechseln mit
   * accountCurrencyRoePercent (Prozent-Rendite). Siehe etoro-mirrors.ts für
   * ein analoges Faktor-vs-Prozent-Beispiel dieser API.
   */
  pnl: number;
}

/** Bildet die Instrument-Aggregate auf ein Gebühren-/P&L-Breakdown ab, größte |P&L| zuerst. */
export function selectFeesPnlBreakdown(
  aggregate: EtoroAggregatePortfolioResponse | undefined,
): InstrumentBreakdownView[] {
  const instrumentAggregates = aggregate?.instrumentAggregates ?? [];

  return instrumentAggregates
    .map((inst) => ({
      instrumentId: inst.instrumentId,
      fees: inst.totalFeesAcctCcy ?? inst.totalFees ?? 0,
      taxes: inst.totalTaxesAcctCcy ?? inst.totalTaxes ?? 0,
      pnl: inst.accountCurrencyReturn ?? 0,
    }))
    .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));
}

/** Summen über das Gebühren-/P&L-Breakdown — für den Kopf des Analyse-Tabs. */
export function selectFeesPnlTotals(breakdown: InstrumentBreakdownView[]): {
  totalFees: number;
  totalTaxes: number;
  totalPnl: number;
} {
  return breakdown.reduce(
    (acc, b) => ({
      totalFees: acc.totalFees + b.fees,
      totalTaxes: acc.totalTaxes + b.taxes,
      totalPnl: acc.totalPnl + b.pnl,
    }),
    { totalFees: 0, totalTaxes: 0, totalPnl: 0 },
  );
}
