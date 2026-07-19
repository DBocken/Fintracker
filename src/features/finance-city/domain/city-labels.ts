/**
 * Auswahl- und Kollisionslogik für die HTML-Overlay-Labels der Finanzstadt
 * (WP-C5, `src/features/finance-city/README.md` "HTML-Labels statt Sprites").
 * Reine Funktionen, kein React/three.js/Browser-Bezug (README-Architektur-
 * tabelle, `domain/`).
 *
 * Liest NUR bereits gebaute `LayoutBox`en (`labelAnchor`, `id`-Konvention aus
 * `city-layout.ts`: `districtId` | `districtId/subId` | `districtId/subId/
 * contractId`) für die Geometrie, und das `CityModel` für Text/Betrag — KEINE
 * eigene Aggregation (AGENTS.md §8): jede Ebene trägt ihren Betrag bereits
 * fertig im Model (`CityDistrict.total`, `CitySubcategory.amount`,
 * `CityContract.amount`), also keine `reduce`-Kette hier.
 */

import type { CityLayout, LayoutBoxKind, CityLevel } from './city-layout';
import type { CityModel, Vec3 } from './city-model';
import { sumMinor, toMinor } from '@/lib/money';

export type CityLabel = {
  /** Identisch zur `LayoutBox.id` (stabil über Renders hinweg, für React-Keys/DOM-Refs). */
  id: string;
  /** Reiner Name (Distrikt/Unterkategorie/Vertrag) — KEIN Betrag/Formatierung eingebettet. */
  text: string;
  /**
   * Roher Anzeige-Euro-Betrag (Float, wie `CityModel`, siehe dessen Kommentar
   * zu Geld-Werten) — bewusst NICHT hier vorformatiert: `formatCurrency` ist
   * i18n-Presentation-Verantwortung (AGENTS.md §6/§8), nicht Domain.
   * `undefined` nur, falls für die id kein Betrag auflösbar ist (kommt in der
   * Praxis nicht vor, da jede gewählte Box einen Modell-Betrag hat).
   */
  amount?: number;
  anchor: Vec3;
  /**
   * Farbe der zugehörigen `LayoutBox` (`box.color`) — auf Etagen-Ebene die
   * bereits schattierte Etagenfarbe (`city-layout.ts#buildFloorBoxes`). Die
   * Presentation nutzt sie für die Führungslinie vom versetzten Label zur
   * jeweiligen Etage (gleiche Farbe wie die Etage), damit Zuordnung ohne
   * Überdeckung des Balkens erkennbar bleibt.
   */
  color: string;
  /**
   * Anteil dieses Betrags an der GESAMTAUSGABE der Stadt (Summe aller
   * Distrikt-Totale), als Bruch in [0, 1]. Wird in der Presentation hinter dem
   * Euro-Betrag als Prozent angezeigt. `undefined`, falls die Gesamtausgabe 0
   * ist (keine Division durch 0).
   */
  share?: number;
  /**
   * Anteil dieses Betrags an seiner ELTERN-Kategorie (Bruch in [0, 1]):
   * Unterkategorie → Distrikt, Etage/Vertrag → Unterkategorie. Wird in der
   * Presentation zusätzlich zum Gesamtanteil in der Kategorienfarbe angezeigt.
   * `undefined` auf Stadt-Ebene (Elternteil = ganze Stadt, deckungsgleich mit
   * `share`) und bei Eltern-Betrag 0 (kein Division durch 0).
   */
  parentShare?: number;
  /** Sortier-/Auswahlkriterium für `resolveLabelCollisions` — aktuell 1:1 der Betrag (höherer Betrag = höhere Priorität). */
  priority: number;
}

/**
 * Gesamtausgabe der Stadt in Integer-Cent = Summe aller Distrikt-Totale
 * (AGENTS.md §8: Geld-Summierung über `toMinor`/`sumMinor`, kein roher
 * Float-`reduce`). Bezugsgröße für den prozentualen Anteil jedes Labels.
 */
function computeCityTotalMinor(model: CityModel): number {
  return sumMinor(model.districts.map((d) => toMinor(d.total)));
};

/** Welche `LayoutBoxKind` je Ebene die Label-Anker trägt (README, "Die 3 Ebenen"). */
const KIND_BY_LEVEL: Record<CityLevel, LayoutBoxKind> = {
  city: 'hull',
  district: 'bar',
  subcategory: 'floor',
};

function resolveLabelContent(
  model: CityModel,
  level: CityLevel,
  id: string,
): { text: string; amount: number; parentTotal: number | null } | null {
  const parts = id.split('/');

  if (level === 'city') {
    const district = model.districts.find((d) => d.id === parts[0]);
    if (!district) return null;
    // Elternteil = ganze Stadt (== Gesamtausgabe) -> parentShare wäre
    // deckungsgleich mit `share`, deshalb `null` (kein doppelter Prozentwert).
    return { text: district.label, amount: district.total, parentTotal: null };
  }

  if (level === 'district') {
    const [districtId, subcategoryId] = parts;
    const district = model.districts.find((d) => d.id === districtId);
    const subcategory = district?.subcategories.find((s) => s.id === subcategoryId);
    if (!district || !subcategory) return null;
    // Elternteil = der Distrikt (Anteil der Unterkategorie am Distrikt).
    return { text: subcategory.label, amount: subcategory.amount, parentTotal: district.total };
  }

  // level === 'subcategory': Etagen-Id-Konvention `districtId/subId/contractId`.
  const [districtId, subcategoryId, contractId] = parts;
  const district = model.districts.find((d) => d.id === districtId);
  const subcategory = district?.subcategories.find((s) => s.id === subcategoryId);
  const contract = subcategory?.contracts?.find((c) => c.id === contractId);
  if (!subcategory || !contract) return null;
  // Elternteil = die Unterkategorie (Anteil des Vertrags/der Etage daran).
  return { text: contract.label, amount: contract.amount, parentTotal: subcategory.amount };
}

/**
 * Wählt je Ebene die zu zeigenden Labels aus den `LayoutBox`en mit
 * `labelAnchor`, holt Text + Betrag aus dem `CityModel`:
 * - `'city'`: ein Label je Distrikt (Hülle), Betrag = `district.total`.
 * - `'district'`: ein Label je Unterkategorie-Balken, Betrag = `subcategory.amount`.
 * - `'subcategory'`: ein Label je Etage/Vertrag, Betrag = `contract.amount`.
 *
 * Ergebnis ist nach Priorität (= Betrag) absteigend sortiert — Bildschirm-
 * abhängige Kollisionsauflösung übernimmt `resolveLabelCollisions` erst in
 * der Presentation-Schicht (dort sind Screen-Rects bekannt).
 */
export function selectCityLabels(model: CityModel, layout: CityLayout, level: CityLevel): CityLabel[] {
  const kind = KIND_BY_LEVEL[level];
  const labels: CityLabel[] = [];
  // WP-D7 (Ziele-Tab): Beträge sind dort bereits Fortschritts-BRÜCHE — die
  // Anteils-Prozente an Gesamt/Eltern wären doppelte/irreführende Prozente
  // und entfallen komplett (share/parentShare bleiben undefined).
  const isProgressModel = model.valueKind === 'progress';
  // Bezugsgröße für den prozentualen Anteil: Gesamtausgabe der Stadt (in Cent).
  const cityTotalMinor = isProgressModel ? 0 : computeCityTotalMinor(model);

  for (const box of layout.boxes) {
    if (box.kind !== kind || !box.labelAnchor) continue;
    const content = resolveLabelContent(model, level, box.id);
    if (!content) continue;
    labels.push({
      id: box.id,
      text: content.text,
      amount: content.amount,
      anchor: box.labelAnchor,
      color: box.color,
      // Anteil an der Gesamtausgabe (Cent/Cent -> Bruch), `undefined` bei
      // Gesamtausgabe 0 (kein Division-durch-0, kein irreführendes "0 %").
      share: cityTotalMinor > 0 ? toMinor(content.amount) / cityTotalMinor : undefined,
      // Anteil an der Eltern-Kategorie (Cent/Cent), `undefined` wenn kein
      // Elternteil (Stadt-Ebene) oder Eltern-Betrag 0.
      parentShare:
        !isProgressModel && content.parentTotal !== null && toMinor(content.parentTotal) > 0
          ? toMinor(content.amount) / toMinor(content.parentTotal)
          : undefined,
      priority: content.amount,
    });
  }

  return labels.sort((a, b) => b.priority - a.priority);
}

export type LabelCollisionRect = { x: number; y: number; width: number; height: number };
export type LabelCollisionCandidate = { id: string; rect: LabelCollisionRect; priority: number };

function rectsOverlap(a: LabelCollisionRect, b: LabelCollisionRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/**
 * Reine, greedy Kollisionsauflösung (voll ohne DOM testbar): nach Priorität
 * absteigend sortieren (Tie-Breaker `id`, damit die Reihenfolge bei
 * gleicher Priorität deterministisch bleibt), dann ein Label akzeptieren,
 * wenn sein AABB keines der bereits akzeptierten überlappt UND `maxVisible`
 * noch nicht erreicht ist.
 */
export function resolveLabelCollisions(candidates: LabelCollisionCandidate[], maxVisible: number): Set<string> {
  const sorted = [...candidates].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  const acceptedRects: LabelCollisionRect[] = [];
  const acceptedIds = new Set<string>();

  for (const candidate of sorted) {
    if (acceptedIds.size >= maxVisible) break;
    if (acceptedRects.some((rect) => rectsOverlap(rect, candidate.rect))) continue;
    acceptedRects.push(candidate.rect);
    acceptedIds.add(candidate.id);
  }

  return acceptedIds;
}
