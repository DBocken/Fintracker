/**
 * WP-5.8 — Visuelle Erklärbarkeit der Finanzstadt.
 *
 * Die Stadt kodiert inzwischen fünf Dinge gleichzeitig: Höhe (Betrag),
 * Distriktfarbe (Bereich), Hülle (Soll bzw. Kopffreiheit), Flusslinien
 * (Wiederkehr, WP-5.1) und Fassaden-Fenster (Aktivität, WP-5.4). Nichts davon
 * erklärt sich von selbst — und ein Kanal, den niemand liest, ist kein Kanal,
 * sondern Dekoration mit Extraschritten.
 *
 * WICHTIG, was das hier NICHT ist: kein Tutorial, keine Tour, keine
 * Freischaltung. `docs/tutorial-progressive-disclosure.md` hält dafür bereits
 * eine Architektur fest (eigene Freischaltungs-Achse, `data-tour-id`-Anker,
 * Overlay ERST nach der Achse) — die wird hier nicht vorweggenommen und nicht
 * untergraben. Die Legende ist eine in sich geschlossene Erklärfläche, auf die
 * eine spätere Führung zeigen kann.
 *
 * Der Kern dieser Datei ist eine Auswahl, keine Liste: Die Legende erklärt
 * NUR, was gerade tatsächlich zu sehen ist. Eine feste Aufzählung wäre in drei
 * von vier Tabs schlicht falsch — im Ziele-Tab bedeutet Höhe Fortschritt und
 * nicht Euro, Flusslinien gibt es nur auf Stadt-Ebene der Ausgaben, und ohne
 * Etagen-Daten gibt es keine Aktivität.
 *
 * Rein und browserfrei (README-Architekturtabelle, `domain/`).
 */

import type { CityModel } from './city-model';

/** Erklärbare Kanäle. Reihenfolge = Anzeigereihenfolge (vom Auffälligsten zum Feinsten). */
export const CITY_LEGEND_ITEMS = [
  'height',
  'heightProgress',
  'districtColor',
  'goalStage',
  'hull',
  'floors',
  'flowLines',
  'activity',
  'projected',
] as const;

export type CityLegendItem = (typeof CITY_LEGEND_ITEMS)[number];

export type CityLegendInput = {
  model: CityModel;
  /** Aktuelle Drill-down-Ebene — Etagen und Flusslinien sind ebenenabhängig. */
  level: 'city' | 'district' | 'subcategory';
  /** Werden gerade Flusslinien gezeichnet? (Nicht aus dem Modell ableitbar: die Qualitätsstufe kann sie abschalten.) */
  hasFlowLines: boolean;
};

/**
 * Welche Kanäle sind gerade erklärungsbedürftig, weil sie gerade etwas zeigen?
 *
 * Regeln:
 * - Höhe bedeutet je nach Welt Betrag ODER Fortschritt — nie beides zugleich.
 * - Die Hüllen-Erklärung unterscheidet mit: bei Zielen ist die Hülle das SOLL
 *   (der Füllgrad ist der Fortschritt), sonst nur Kopffreiheit über dem
 *   höchsten Balken. Deshalb hängt sie am `targetAmount`, nicht am Tab-Namen.
 * - Etagen erklärt sich erst, wenn man tief genug ist, um sie zu sehen.
 */
export function cityLegendItems(input: CityLegendInput): CityLegendItem[] {
  const { model, level, hasFlowLines } = input;
  const isProgress = model.valueKind === 'progress';
  const items: CityLegendItem[] = [];

  items.push(isProgress ? 'heightProgress' : 'height');

  if (isProgress) {
    // Bei Zielen trägt die Farbe die Fortschritts-Stufe (WP-5.3), nicht den
    // Bereich — die Distrikt-Erklärung wäre hier irreführend.
    if (model.districts.some((district) => district.stage !== undefined)) items.push('goalStage');
  } else if (model.districts.length > 1) {
    items.push('districtColor');
  }

  if (model.districts.some((district) => district.targetAmount !== undefined)) items.push('hull');

  if (level !== 'city' && model.districts.some((d) => d.subcategories.some((s) => s.contracts?.length))) {
    items.push('floors');
  }

  if (hasFlowLines) items.push('flowLines');

  if (model.districts.some((d) => d.subcategories.some((s) => s.activity !== undefined))) {
    items.push('activity');
  }

  // WP-5.2: Der auffälligste Unterschied überhaupt — durchscheinende Gebäude —
  // braucht die Erklärung am dringendsten, steht aber zuletzt: er gilt für die
  // ganze Ansicht, während die anderen Einträge einzelne Kanäle erklären.
  if (model.projected) items.push('projected');

  // Anzeigereihenfolge festschreiben, unabhängig davon, in welcher Reihenfolge
  // die Regeln oben zugeschlagen haben.
  return CITY_LEGEND_ITEMS.filter((item) => items.includes(item));
}
