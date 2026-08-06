/**
 * WP-6.4 — Vermögen als Volumen.
 *
 * Der bisherige Zusammensetzungsbalken war 2,5 px hoch. Er zeigte **Anteile**
 * korrekt, aber keine **Größenordnung**: Ein Vermögen aus 2.000 € Bargeld und
 * ein Vermögen aus 200.000 € Bargeld sahen identisch aus, solange die
 * Aufteilung dieselbe war. „Wie viel" war aus der Grafik nicht ablesbar, nur
 * aus den Zahlen daneben.
 *
 * Diese Datei rechnet Beträge in Flächen um — und hält dabei die eine Regel
 * ein, an der solche Darstellungen meistens scheitern:
 *
 * **Die FLÄCHE muss proportional zum Wert sein, nicht der Radius.** Wer den
 * Radius linear mit dem Wert skaliert, erzeugt eine Fläche, die quadratisch
 * wächst: Ein doppelt so großer Betrag sieht dann viermal so groß aus. Das ist
 * keine Feinheit, sondern eine Falschaussage über Geld — und sie fällt
 * niemandem auf, weil die Grafik „irgendwie stimmig" wirkt.
 *
 * Deshalb: `radius ∝ √wert`.
 */

export type VolumeItem = {
  key: string;
  value: number;
};

export type VolumeSegment = VolumeItem & {
  /** Radius in Pixeln, flächenproportional zum Wert. */
  radius: number;
  /** Anteil am Gesamtwert (0..1) — für Beschriftung und Sprachausgabe. */
  share: number;
};

export type VolumeScaleOptions = {
  /** Radius des größten Elements in Pixeln. */
  maxRadius: number;
  /**
   * Kleinster Radius, den ein Element mit einem Wert > 0 bekommt.
   *
   * Ohne Untergrenze verschwindet ein 12-€-Posten neben einem
   * 120.000-€-Posten vollständig — mathematisch korrekt und praktisch
   * unbrauchbar: „nicht vorhanden" und „sehr klein" sind verschiedene
   * Aussagen, und nur eine davon stimmt.
   */
  minRadius?: number;
};

const DEFAULT_MIN_RADIUS = 6;

/**
 * Flächenproportionaler Radius für einen Wert.
 *
 * Liefert `0` für nicht-positive oder unbrauchbare Werte — ein Posten, den es
 * nicht gibt, bekommt keinen Kreis.
 */
export function areaProportionalRadius(
  value: number,
  maxValue: number,
  { maxRadius, minRadius = DEFAULT_MIN_RADIUS }: VolumeScaleOptions
): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (!Number.isFinite(maxValue) || maxValue <= 0) return 0;

  // Wurzel, nicht linear: sonst waechst die Flaeche quadratisch mit dem Wert.
  const radius = maxRadius * Math.sqrt(Math.min(value, maxValue) / maxValue);
  return Math.max(minRadius, radius);
}

/**
 * Rechnet eine Postenliste in flächenproportionale Segmente um.
 *
 * Nicht-positive Posten fallen heraus: Ein Vermögensteil, den es nicht gibt,
 * soll auch nicht als winziger Punkt erscheinen. Sortiert absteigend, damit
 * das Größte zuerst gelesen wird.
 */
export function volumeSegments(
  items: readonly VolumeItem[],
  options: VolumeScaleOptions
): VolumeSegment[] {
  const usable = items.filter(
    (item) => Number.isFinite(item.value) && item.value > 0
  );
  if (usable.length === 0) return [];

  const total = usable.reduce((sum, item) => sum + item.value, 0);
  const maxValue = usable.reduce((max, item) => Math.max(max, item.value), 0);

  return usable
    .map((item) => ({
      ...item,
      radius: areaProportionalRadius(item.value, maxValue, options),
      share: item.value / total,
    }))
    .sort((a, b) => b.value - a.value);
}
