/**
 * Der simulierte Depot-Verlauf für Depots ohne echte Kursdaten.
 *
 * Nur für Nicht-eToro-Depots: eToro liefert echte tägliche Kontostände
 * (`/balances/history`), die der Performance-Tab dann anzeigt. Hier gibt es
 * keine Historie, sondern nur zwei bekannte Punkte — Einstandswert und
 * aktueller Wert. Die Kurve dazwischen ist eine gerade Interpolation und wird
 * unter dem Diagramm auch so benannt („Simulierter Verlauf basierend auf
 * aktuellen Portfoliodaten").
 *
 * Zwei Gründe, warum das eine reine Funktion sein muss:
 *
 * 1. Die frühere Fassung stand als `generatePerformanceData()` in
 *    `TradingDashboard.tsx` und benutzte `Math.random()`. Sie wurde im selben
 *    Render ZWEIMAL aufgerufen — einmal für die zugängliche Tabelle
 *    (`ChartFigure rows`), einmal für das Diagramm (`LineChart data`). Beide
 *    bekamen andere Zahlen. Die nicht-visuelle Entsprechung, die WP-6.10
 *    ausdrücklich eingeführt hat, widersprach damit dem Bild, das sie
 *    ersetzen sollte.
 * 2. Sie würfelte bei jedem Re-Render neu, also zappelte der „Verlauf" bei
 *    jeder unabhängigen Zustandsänderung auf der Seite.
 *
 * Das Rauschen ist ersatzlos entfallen. Es hat der Aussage nichts hinzugefügt
 * — es hat nur echte Schwankung vorgetäuscht, wo keine bekannt ist.
 */

/** Ein Punkt des simulierten Verlaufs. */
export interface PerformancePreviewPoint {
  /** Beschriftung der x-Achse: `null` für den Startpunkt, sonst der Tagesindex. */
  day: number | null;
  value: number;
}

export interface PerformancePreviewInput {
  /** Summe der Einstandswerte. */
  totalCost: number;
  /** Aktueller Gesamtwert. */
  totalValue: number;
}

/** Wie viele Tage der simulierte Verlauf abbildet. */
export const PERFORMANCE_PREVIEW_DAYS = 30;

/**
 * Gerade Interpolation vom Einstandswert zum aktuellen Wert.
 *
 * Deterministisch: gleiche Eingabe, gleiche Ausgabe. Der erste Punkt trifft
 * exakt den Einstandswert, der letzte exakt den aktuellen Wert — sonst würde
 * die Kurve neben den Kennzahlen daneben enden, die dieselben Zahlen zeigen.
 */
export function buildPerformancePreview(
  summary: PerformancePreviewInput | null | undefined,
  days: number = PERFORMANCE_PREVIEW_DAYS,
): PerformancePreviewPoint[] {
  if (!summary) return [];
  if (days < 1) return [{ day: null, value: summary.totalCost }];

  const step = (summary.totalValue - summary.totalCost) / days;
  return Array.from({ length: days + 1 }, (_, index) => ({
    day: index === 0 ? null : index,
    // Der letzte Punkt wird exakt gesetzt statt aufsummiert: sonst weicht er
    // durch die Float-Addition um Bruchteile vom angezeigten Gesamtwert ab.
    value: index === days ? summary.totalValue : summary.totalCost + step * index,
  }));
}
