/**
 * Daten für die teilbare Income-Mix-Karte („So verdiene ich mein Geld").
 *
 * PRIVACY-GARANTIE: Der Rückgabetyp enthält KEINE absoluten Beträge — nur
 * ganzzahlige Prozentanteile. Damit kann die Share-Card strukturell keine
 * Einkommenshöhe verraten, egal wie sie gerendert wird.
 */
import type { IncomeStreamsResult } from "./income-streams";

export interface ShareCardSlice {
  key: string;
  /** Anzeigename; leer für den gebündelten „Sonstige"-Slice (UI setzt Label via i18n). */
  label: string;
  /** Ganzzahliger Anteil in %, Summe aller Slices exakt 100. */
  percent: number;
  isOther: boolean;
}

export interface ShareCardData {
  slices: ShareCardSlice[];
  streamCount: number;
  diversification: IncomeStreamsResult["diversification"];
  hasData: boolean;
}

/**
 * Rundet Anteile per Largest-Remainder-Methode auf ganze Prozent, sodass die
 * Summe exakt 100 ergibt (naives Runden würde 99 oder 101 liefern).
 */
function roundToHundred(rawPercents: number[]): number[] {
  const floors = rawPercents.map((p) => Math.floor(p));
  let remainder = 100 - floors.reduce((a, b) => a + b, 0);
  // Indizes mit dem größten Nachkomma-Rest bekommen je +1, bis 100 erreicht ist.
  const order = rawPercents
    .map((p, i) => ({ i, frac: p - Math.floor(p) }))
    .sort((a, b) => b.frac - a.frac);
  const result = [...floors];
  for (const { i } of order) {
    if (remainder <= 0) break;
    result[i] += 1;
    remainder -= 1;
  }
  return result;
}

/**
 * Baut die Share-Card-Daten aus dem Einkommensstrom-Ergebnis: die Top-Ströme
 * (Default: 4 benannt + 1 „Sonstige"-Bündel) mit ganzzahligen Prozentanteilen.
 */
export function buildShareCardData(
  result: IncomeStreamsResult,
  options?: { maxSlices?: number },
): ShareCardData {
  const maxSlices = options?.maxSlices ?? 5;
  const total = result.totalIncome;

  if (total <= 0 || result.streams.length === 0) {
    return { slices: [], streamCount: 0, diversification: result.diversification, hasData: false };
  }

  // Nach Anteil absteigend (streams ist bereits so sortiert, defensiv kopieren).
  const sorted = [...result.streams].sort((a, b) => b.totalInWindow - a.totalInWindow);
  const namedCount = Math.min(sorted.length, Math.max(1, maxSlices - 1));

  const named = sorted.slice(0, namedCount);
  const rest = sorted.slice(namedCount);

  const rawValues = named.map((s) => (s.totalInWindow / total) * 100);
  let entries = named.map((s, i) => ({ key: s.key, label: s.label, raw: rawValues[i], isOther: false }));

  if (rest.length > 0) {
    const restValue = rest.reduce((sum, s) => sum + s.totalInWindow, 0);
    entries = [...entries, { key: "__other", label: "", raw: (restValue / total) * 100, isOther: true }];
  }

  const rounded = roundToHundred(entries.map((e) => e.raw));
  const slices: ShareCardSlice[] = entries.map((e, i) => ({
    key: e.key,
    label: e.label,
    percent: rounded[i],
    isOther: e.isOther,
  }));

  return {
    slices,
    streamCount: result.streams.length,
    diversification: result.diversification,
    hasData: true,
  };
}
