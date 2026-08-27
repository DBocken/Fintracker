/**
 * Vermögenswerte, die in keiner Buchung stehen (Welle 4, #333 Punkt 1).
 *
 * Die Aufstellung kannte bisher nur, was die App ohnehin sieht: Kontostände,
 * Depots, Forderungen, Schulden. Für die meisten Menschen fehlt damit der
 * GRÖSSTE Posten — Wohnung, Auto, Sachwerte. Wer „Wie hoch ist mein
 * Vermögen?" fragt und eine Zahl ohne sein Haus bekommt, bekommt keine
 * halbe Antwort, sondern eine falsche.
 *
 * Form in `lib`, Wert im Dienst (AGENTS.md §3, „Wohin ein Typ gehört").
 */

/**
 * Art des Werts. Bewusst grob: Sie steuert nur Symbol und Sortierung, nicht
 * die Rechnung — eine feinere Taxonomie („Eigentumswohnung" gegen
 * „Reihenhaus") wäre eine Behauptung über die Bewertung, die niemand einlöst.
 */
export type ManualAssetKind = 'property' | 'vehicle' | 'valuables' | 'other';

export interface ManualAsset {
  id: string;
  user_id: string;
  /** Anzeigename — Nutzerdatum, nie Bildschirmtext. */
  name: string;
  kind: ManualAssetKind;
  /** Geschätzter Wert in Euro. */
  value: number;
  /**
   * Stichtag der Schätzung (ISO `YYYY-MM-DD`) — PFLICHT, nicht Zierde.
   *
   * Ein manuell gepflegter Wert veraltet, und eine drei Jahre alte
   * Fahrzeugschätzung als heutigen Wert auszugeben wäre dieselbe stille
   * Falschaussage wie ein Kontostand ohne Anker. Die Aufstellung weist das
   * Alter deshalb aus, statt es zu verschweigen.
   */
  valued_at: string;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Ab wann eine Schätzung als veraltet gilt.
 *
 * Ein Jahr, weil das der Rhythmus ist, in dem sich Immobilien- und
 * Fahrzeugwerte spürbar bewegen — und weil eine Grenze, die nie erreicht
 * wird, keine ist. Sie wird an ihrer Prüfstelle gelesen
 * (`istVeraltet`), nicht bloss deklariert (AGENTS.md §3: keine
 * Grenzkonstante ohne Prüfstelle).
 */
export const BEWERTUNG_VERALTET_NACH_TAGEN = 365;

/** Wie viele Tage die Schätzung am Stichtag alt ist. */
export function bewertungsAlterInTagen(asset: ManualAsset, jetzt: Date): number {
  const bewertet = Date.parse(`${asset.valued_at}T00:00:00Z`);
  if (Number.isNaN(bewertet)) return 0;
  const tage = Math.floor((jetzt.getTime() - bewertet) / 86_400_000);
  return Math.max(0, tage);
}

/** Ist die Schätzung so alt, dass die Fläche das sagen muss? */
export function istVeraltet(asset: ManualAsset, jetzt: Date): boolean {
  return bewertungsAlterInTagen(asset, jetzt) >= BEWERTUNG_VERALTET_NACH_TAGEN;
}

/** Summe aller Werte — Einzelposten roh, maskiert wird in der Präsentation. */
export function summeManuellerWerte(assets: readonly ManualAsset[]): number {
  return assets.reduce((summe, a) => summe + (Number.isFinite(a.value) ? a.value : 0), 0);
}
