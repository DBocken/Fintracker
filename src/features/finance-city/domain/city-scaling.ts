/**
 * Höhen-/Etagen-Mathematik der 3D-Finanzstadt (WP-C1). Reine Funktionen ohne
 * React/three.js/Browser-Bezug (README-Architekturtabelle, `domain/`).
 */

import type { CityContract } from './city-model';

/** Anteil der Balkenhöhe, den jede Etage MINDESTENS bekommt (Spec: 2 %). */
const MIN_FLOOR_HEIGHT_RATIO = 0.02;

/**
 * Wurzel-Skalierung: `sqrt(amount / maxAmount) * maxHeight`.
 *
 * Lineare Skalierung würde kleine Beträge (z. B. Apple TV 1 € neben Miete
 * 980 €) auf eine kaum wahrnehmbare Restfläche stauchen. Die Wurzelfunktion
 * komprimiert das Verhältnis der GRÖSSEN, nicht der Werte: ein Gebäude mit
 * 1 % des Referenzbetrags bekommt 10 % der Referenzhöhe statt 1 % — es bleibt
 * als Gebäude erkennbar. Die exakten Zahlenwerte gehen dadurch NICHT verloren:
 * das HTML-Label (README, "HTML-Labels statt Sprites") zeigt immer den realen
 * Betrag an; die Höhe ist nur eine grobe visuelle Ordnungsrelation.
 *
 * Guards: nicht-positive Beträge/Referenzbeträge ergeben 0 Höhe (kein
 * Gebäude), statt `NaN` oder negativer Höhe.
 */
export function scaleHeight(amount: number, maxAmount: number, maxHeight: number): number {
  if (amount <= 0 || maxAmount <= 0) return 0;
  return Math.sqrt(amount / maxAmount) * maxHeight;
}

export type CityFloor = {
  id: string;
  label: string;
  amount: number;
  /** Vertikaler MITTELPUNKT der Etage, lokal vom Balkenfuß (0) aus gezählt — konsistent mit `LayoutBox.center` (Fußpunkt-Konvention, `city-layout.ts`). */
  y: number;
  height: number;
};

/**
 * Verteilt die Etagen eines aufgelösten Balkens (z. B. "Streaming & Abos" ->
 * Netflix/Spotify/HBO/Apple TV) proportional zu ihren Beträgen auf EXAKT
 * `barHeight` — bewusst LINEAR (nicht wurzel-skaliert wie `scaleHeight`):
 * innerhalb eines Gebäudes muss die Summe der Etagenhöhen exakt der
 * Balkenhöhe entsprechen (Summen-Treue schlägt hier Einzelsichtbarkeit,
 * anders als bei der Gebäudehöhe selbst).
 *
 * Mindesthöhen-Klausel: Etagen, die weniger als `MIN_FLOOR_HEIGHT_RATIO`
 * (2 %) von `barHeight` bekämen, werden auf genau 2 % angehoben; der dadurch
 * "verbrauchte" Anteil wird von den verbleibenden Etagen proportional zu
 * ihren Beträgen gestaucht. Das läuft iterativ (Kaskade), falls eine
 * Stauchung eine bis dahin ausreichend große Etage selbst unter 2 % drückt.
 * Die Summe aller Höhen bleibt dabei exakt `barHeight` (bis auf
 * Floating-Point-Rundung im Femto-Bereich).
 *
 * Stapelreihenfolge: größter Betrag unten (kleinstes `y`).
 */
export function scaleFloors(
  contracts: CityContract[],
  barHeight: number,
): CityFloor[] {
  if (barHeight <= 0 || contracts.length === 0) return [];

  const total = contracts.reduce((sum, c) => sum + c.amount, 0);
  if (total <= 0) return [];

  const sorted = [...contracts].sort((a, b) => b.amount - a.amount);
  const minHeight = barHeight * MIN_FLOOR_HEIGHT_RATIO;

  // Guard gegen pathologische Eingaben (mehr Etagen, als bei 2%-Mindesthöhe
  // je in barHeight passen): dann kann die Mindesthöhen-Klausel nicht für
  // alle gelten - degradiere auf reine Proportionalverteilung, damit die
  // Summen-Invariante (wichtiger laut Spec) in jedem Fall exakt bleibt.
  const heights = new Array<number>(sorted.length).fill(0);
  const fixed = new Array<boolean>(sorted.length).fill(false);

  if (minHeight * sorted.length <= barHeight) {
    let remainingHeight = barHeight;
    let remainingIndices = sorted.map((_, i) => i);
    let changed = true;

    while (changed) {
      changed = false;
      const remTotal = remainingIndices.reduce((sum, i) => sum + sorted[i].amount, 0);
      for (const i of remainingIndices) {
        const share = remTotal > 0 ? (sorted[i].amount / remTotal) * remainingHeight : 0;
        if (share < minHeight) {
          fixed[i] = true;
          heights[i] = minHeight;
          remainingHeight -= minHeight;
          changed = true;
        }
      }
      remainingIndices = remainingIndices.filter((i) => !fixed[i]);
    }

    const remTotal = remainingIndices.reduce((sum, i) => sum + sorted[i].amount, 0);
    for (const i of remainingIndices) {
      heights[i] = remTotal > 0 ? (sorted[i].amount / remTotal) * remainingHeight : 0;
    }
  } else {
    // Fallback ohne Mindesthöhen-Garantie, Summe bleibt exakt barHeight.
    for (let i = 0; i < sorted.length; i++) {
      heights[i] = (sorted[i].amount / total) * barHeight;
    }
  }

  let y = 0;
  return sorted.map((c, i) => {
    const height = heights[i];
    const floor: CityFloor = { id: c.id, label: c.label, amount: c.amount, y: y + height / 2, height };
    y += height;
    return floor;
  });
}
