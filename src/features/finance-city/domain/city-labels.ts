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
  /** Sortier-/Auswahlkriterium für `resolveLabelCollisions` — aktuell 1:1 der Betrag (höherer Betrag = höhere Priorität). */
  priority: number;
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
): { text: string; amount: number } | null {
  const parts = id.split('/');

  if (level === 'city') {
    const district = model.districts.find((d) => d.id === parts[0]);
    if (!district) return null;
    return { text: district.label, amount: district.total };
  }

  if (level === 'district') {
    const [districtId, subcategoryId] = parts;
    const district = model.districts.find((d) => d.id === districtId);
    const subcategory = district?.subcategories.find((s) => s.id === subcategoryId);
    if (!subcategory) return null;
    return { text: subcategory.label, amount: subcategory.amount };
  }

  // level === 'subcategory': Etagen-Id-Konvention `districtId/subId/contractId`.
  const [districtId, subcategoryId, contractId] = parts;
  const district = model.districts.find((d) => d.id === districtId);
  const subcategory = district?.subcategories.find((s) => s.id === subcategoryId);
  const contract = subcategory?.contracts?.find((c) => c.id === contractId);
  if (!contract) return null;
  return { text: contract.label, amount: contract.amount };
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
