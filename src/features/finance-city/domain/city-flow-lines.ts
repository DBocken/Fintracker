/**
 * WP-5.1 — Flusslinien für wiederkehrende Zahlungen.
 *
 * Die Stadt zeigte bisher, WOHIN das Geld geht (Gebäudehöhe je
 * Unterkategorie), aber nicht, welcher Teil davon jeden Monat ohne weiteres
 * Zutun abfließt. Genau dieser Teil ist der, den man kennen muss: Fixkosten
 * kann man kündigen, einmalige Ausgaben kann man nur bereuen.
 *
 * Die Linie verbindet die MITTE der Platte mit dem Fuß des Gebäudes. Die Mitte
 * steht für das Konto — von dort geht jeden Monat etwas weg, ohne dass jemand
 * eine Entscheidung trifft. Kein erfundener Ort: `layout.center` ist derselbe
 * Punkt, um den die Kamera die Stadt rahmt.
 *
 * BEWUSST OHNE BEWEGUNG. Eine „fließende" Animation widerspräche der
 * Render-on-Demand-Vorgabe des Slice (README: keine Ambient-Animation, der
 * Loop steht bei Stillstand still) — sie liefe endlos und kostete auf einem
 * Telefon dauerhaft Akku, ohne eine einzige zusätzliche Zahl zu zeigen. Die
 * Linien bauen sich mit der Stadt auf und stehen dann; die Aussage steckt in
 * Vorhandensein und Stärke, nicht in Bewegung.
 *
 * Rein und browserfrei (README-Architekturtabelle, `domain/`).
 */

import type { CityLayout } from './city-layout';
import type { CityModel, Vec3 } from './city-model';

export type CityFlowLine = {
  /** `flow:<buildingId>` — stabil über Re-Renders, damit die Presentation diffen kann. */
  id: string;
  /** Konto-Anker: Mitte der Platte auf Bodenhöhe. */
  from: Vec3;
  /** Fußpunkt des Gebäudes (nicht die Mitte — die Linie soll am Boden ankommen). */
  to: Vec3;
  /** Wiederkehrender Anteil des Gebäudes (Anzeige-Euro, wie im übrigen Modell). */
  amount: number;
  /** Anteil am gesamten wiederkehrenden Betrag (0..1) — Stärke/Deckkraft der Linie. */
  share: number;
  color: string;
};

/**
 * Höchstzahl gleichzeitig gezeichneter Linien. Ohne Deckel wird aus der
 * Betonung ein Netz: bei zwanzig Linien sieht man nur noch, DASS es viele
 * gibt, nicht mehr welche schwer wiegt. Die stärksten gewinnen — der Rest
 * bleibt über Gebäudehöhe und Etagen weiter zugänglich.
 */
export const MAX_FLOW_LINES = 6;

/** Fußpunkt-Höhe der Linie über dem Boden — knapp darüber, damit sie nicht mit der Bodenplatte z-fightet. */
const FLOW_LINE_Y = 0.02;

/**
 * Baut die Flusslinien für ein Layout. Berücksichtigt nur Balken (`kind:
 * 'bar'`), deren Unterkategorie einen wiederkehrenden Anteil hat — Hüllen,
 * Grundstücke und Etagen bekommen keine eigene Linie.
 *
 * Liefert eine leere Liste, wenn nichts wiederkehrt (dann gibt es auch nichts
 * zu betonen) — die Presentation muss keinen Sonderfall kennen.
 */
export function buildFlowLines(model: CityModel, layout: CityLayout): CityFlowLine[] {
  const recurringBySubcategory = new Map<string, number>();
  for (const district of model.districts) {
    for (const subcategory of district.subcategories) {
      const recurring = subcategory.recurringAmount;
      if (recurring !== undefined && recurring > 0) {
        recurringBySubcategory.set(`${district.id}/${subcategory.id}`, recurring);
      }
    }
  }
  if (recurringBySubcategory.size === 0) return [];

  const candidates = layout.boxes
    .filter((box) => box.kind === 'bar')
    .flatMap((box) => {
      const amount = recurringBySubcategory.get(box.id);
      if (amount === undefined) return [];
      return [{ box, amount }];
    });
  if (candidates.length === 0) return [];

  // Stärkste zuerst, dann deckeln: der Deckel soll die WICHTIGSTEN behalten,
  // nicht die zufällig erstgenannten. Tie-Breaker id für eine stabile
  // Reihenfolge (sonst wechselte die Auswahl bei gleichen Beträgen zwischen
  // zwei Renders).
  candidates.sort((a, b) => b.amount - a.amount || a.box.id.localeCompare(b.box.id));
  const visible = candidates.slice(0, MAX_FLOW_LINES);

  // Anteil am SICHTBAREN Gesamtbetrag: sonst wäre die stärkste Linie einer
  // gedeckelten Auswahl dünner als dieselbe Linie ohne Deckel — die
  // Darstellung hinge daran, wie viele andere es gibt.
  const totalVisible = visible.reduce((sum, candidate) => sum + candidate.amount, 0);

  return visible.map(({ box, amount }) => ({
    id: `flow:${box.id}`,
    from: { x: layout.center.x, y: FLOW_LINE_Y, z: layout.center.z },
    to: { x: box.center.x, y: FLOW_LINE_Y, z: box.center.z },
    amount,
    share: totalVisible > 0 ? amount / totalVisible : 0,
    color: box.color,
  }));
}
