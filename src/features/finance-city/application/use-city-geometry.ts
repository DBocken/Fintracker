/**
 * Geometrie- und Auswahl-Ableitungen der Stadt (herausgelöst aus
 * `CityPage.tsx` in WP 6.4). Alles hier ist `useMemo` über Modell + Navigation
 * — keine Berechnung, die nicht schon in `domain/` steht.
 *
 * `buildCityLayout` ist die EINZIGE Geometrie-Quelle (README): `presentation/`
 * trifft keine eigenen Layout-Entscheidungen, und dieser Hook auch nicht.
 */

import { useMemo } from 'react';
import { buildCityLayout, computeFocusBounds, type CityLayout } from '../domain/city-layout';
import { buildFlowLines } from '../domain/city-flow-lines';
import { selectCityLabels } from '../domain/city-labels';
import { selectCityContext } from '../domain/city-context';
import type { CityFlowLine } from '../domain/city-flow-lines';
import type { CityLabel } from '../domain/city-labels';
import type { CityContextSummary } from '../domain/city-context';
import type { Vec3 } from '../domain/city-model';
import type { CityModel, CityNavigationViewModel } from './city-view-model';

export type CityGeometry = {
  layout: CityLayout;
  /** Fokus-Bounding-Sphere des aktuellen Kamera-Intents; `null` = kein Fokusziel. */
  focusLayout: { center: Vec3; radius: number } | null;
  /** WP-5.1: Flusslinien wiederkehrender Zahlungen — nur auf Stadt-Ebene. */
  flowLines: CityFlowLine[];
  labels: CityLabel[];
  /** WP-D3: Kontext-Chip der aktuellen Ebene; `null`, wenn die Fokus-Ids nicht auflösbar sind. */
  context: CityContextSummary | null;
};

export function useCityGeometry(model: CityModel, nav: CityNavigationViewModel): CityGeometry {
  // `focusDistrictId` bedeutet je nach Ebene etwas anderes: auf city-Ebene der
  // (noch nicht betretene) Fokus-Tap, ab district-Ebene der betretene Distrikt.
  const layout = useMemo(() => {
    const focusDistrictId = (nav.level === 'city' ? nav.focusDistrictId : nav.activeDistrictId) ?? undefined;
    const focusSubcategoryId = nav.activeSubcategoryId ?? undefined;
    return buildCityLayout(model, { level: nav.level, focusDistrictId, focusSubcategoryId });
  }, [model, nav.level, nav.focusDistrictId, nav.activeDistrictId, nav.activeSubcategoryId]);

  // WP-C4: `computeFocusBounds` liest ausschließlich das bereits gebaute
  // `layout`. Die Id-Konvention (`districtId/subcategoryId`) verlangt für
  // `enter-subcategory` den zusammengesetzten Schlüssel.
  const focusLayout = useMemo(() => {
    const intent = nav.cameraIntent;
    if (intent.kind === 'focus-district' || intent.kind === 'enter-district') {
      return intent.targetId ? computeFocusBounds(layout, intent.targetId) : null;
    }
    if (intent.kind === 'enter-subcategory') {
      const districtId = nav.activeDistrictId ?? nav.focusDistrictId;
      return districtId && intent.targetId ? computeFocusBounds(layout, `${districtId}/${intent.targetId}`) : null;
    }
    return null;
  }, [layout, nav.cameraIntent, nav.activeDistrictId, nav.focusDistrictId]);

  // Nur auf STADT-Ebene: beim Eintauchen beantworten die Etagen dieselbe Frage
  // genauer, dort würden die Linien nur die Baukörper verstellen.
  const flowLines = useMemo(
    () => (nav.level === 'city' ? buildFlowLines(model, layout) : []),
    [model, layout, nav.level],
  );

  // Reine Auswahl, KEINE Screen-Projektion — die übernimmt `CityLabels.reproject()`
  // pro `onFrame`-Tick (Perf-Vorgabe).
  const labels = useMemo(() => selectCityLabels(model, layout, nav.level), [model, layout, nav.level]);

  const context = useMemo(
    () =>
      selectCityContext(
        model,
        nav.level,
        nav.level === 'city' ? undefined : nav.activeDistrictId,
        nav.activeSubcategoryId,
      ),
    [model, nav.level, nav.activeDistrictId, nav.activeSubcategoryId],
  );

  return { layout, focusLayout, flowLines, labels, context };
}
