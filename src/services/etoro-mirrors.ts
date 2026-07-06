import type { EtoroAggregatePortfolioResponse } from './etoro-api-schemas';

// -----------------------------------------------------------------------------
// Smart Portfolios (eToro "mirrors" = Copy-Trading-Beziehungen) — reine
// Selektor-Funktionen über den Konto-Snapshot aus etoro-api-schemas.ts. Keine
// Netzwerk-/Persistenz-Logik hier, nur Ableitung fürs UI (EtoroMirrorsTab) und
// den Übersicht-Abgleich (EtoroOverviewTab).
// -----------------------------------------------------------------------------

export interface MirrorView {
  mirrorId: number;
  /** Netto-Einzahlung in den Mirror (Einzahlungen − Auszahlungen, oder mirrorTotals.mirrorNetFunding falls vorhanden). */
  investedNet: number;
  /** Aktueller Liquidationswert des Mirrors (USD). */
  value: number;
  /** G/V: offene Positions-G/V + realisierte G/V geschlossener Positionen. */
  pnl: number;
  /** G/V in Prozent (bereits ×100, siehe Kommentar unten). */
  pnlPercent: number;
  instrumentIds: number[];
}

/**
 * Bildet die Konto-Snapshot-Mirrors auf ein UI-taugliches Shape ab.
 *
 * WARUM ×100 bei pnlPercent: Das Live-Spec-Beispiel (v1.291.0) zeigt
 * mirrorPositionsPnl=-75.05 bei mirrorLiquidationValue=209.08 und
 * mirrorPositionsPnlPercent=-0.35 — bezogen auf ein investiertes Kapital von
 * ~214 (209.08 + 75.05... ≈ Investition) ergibt -0.35 eine Rendite von rund
 * -35%. Das Feld ist also ein FAKTOR (Anteil), keine bereits fertige Prozentzahl.
 * Wir multiplizieren daher mit 100, bevor wir es anzeigen. Der Fallback
 * (pnl / investedNet * 100) ist konsistent dazu bereits in Prozent.
 */
export function selectEtoroMirrors(
  aggregate: EtoroAggregatePortfolioResponse | undefined,
): MirrorView[] {
  const mirrors = aggregate?.mirrors ?? [];

  return mirrors.map((mirror) => {
    const totals = mirror.mirrorTotals;

    const investedNet =
      totals?.mirrorNetFunding ??
      (mirror.mirrorDepositTotal ?? 0) - (mirror.mirrorWithdrawalTotal ?? 0);

    const value = totals?.mirrorLiquidationValue ?? 0;

    const pnl = (totals?.mirrorPositionsPnl ?? 0) + (mirror.mirrorClosedPositionsPnl ?? 0);

    const pnlPercent =
      totals?.mirrorPositionsPnlPercent !== undefined
        ? totals.mirrorPositionsPnlPercent * 100
        : investedNet !== 0
          ? (pnl / investedNet) * 100
          : 0;

    const instrumentIds = (mirror.instrumentAggregates ?? []).map((a) => a.instrumentId);

    return {
      mirrorId: mirror.mirrorId,
      investedNet,
      value,
      pnl,
      pnlPercent,
      instrumentIds,
    };
  });
}

/** Summen über alle Mirrors — für den Kopf des Smart-Portfolios-Tabs. */
export function selectMirrorTotals(mirrors: MirrorView[]): {
  totalValue: number;
  totalNetFunding: number;
  totalPnl: number;
} {
  return mirrors.reduce(
    (acc, m) => ({
      totalValue: acc.totalValue + m.value,
      totalNetFunding: acc.totalNetFunding + m.investedNet,
      totalPnl: acc.totalPnl + m.pnl,
    }),
    { totalValue: 0, totalNetFunding: 0, totalPnl: 0 },
  );
}

/**
 * Σ Liquidationswert aller Mirrors — wird im Übersicht-Abgleich
 * (EtoroOverviewTab) neben lokalen Positionen und Cash berücksichtigt, da der
 * eToro-Kontowert Smart Portfolios mit einschließt.
 */
export function sumMirrorLiquidationValue(
  aggregate: EtoroAggregatePortfolioResponse | undefined,
): number {
  return selectEtoroMirrors(aggregate).reduce((sum, m) => sum + m.value, 0);
}
