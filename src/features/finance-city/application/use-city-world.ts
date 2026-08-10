/**
 * Welt-Wechsel, Hover-Kopplung und Tap-Zuordnung der Stadt
 * (WP-D3/D5/D8, herausgelöst aus `CityPage.tsx` in WP 6.4).
 *
 * Drei Dinge, die zusammengehören und deshalb hier zusammen liegen:
 *
 * - **Welt** (`tab`): Ausgaben, Einnahmen, Ziele, Übersicht. Ein Weltwechsel
 *   setzt die Navigation auf die Stadt-Ebene zurück — die Fokus-Ids der alten
 *   Welt existieren im neuen Modell nicht.
 * - **Hover**: EIN gemeinsamer Zustand, gespeist aus Canvas-Raycast UND
 *   Label-Hover; er wird bei jedem Ebenen- und Weltwechsel aufgehoben, weil
 *   die gehoverte Box im neuen Layout evtl. nicht mehr existiert.
 * - **Tap**: Box-Id → Navigations-Aktion. Die fachliche Zuordnung selbst steht
 *   rein in `domain/city-tap-target.ts`; hier wird sie nur ausgeführt.
 *
 * Der Tab wird **hereingereicht, nicht gehalten**: `useCityModel` braucht ihn
 * eine Hook-Zeile früher (es lädt das Modell der Welt), und `nav` entsteht
 * erst aus diesem Modell. Ein zweiter, gespiegelter Tab-Zustand hier wäre
 * genau die Art Doppelung, die WP 6.4 auflöst.
 *
 * KEIN three.js, kein Canvas — der Hook ist vollständig ohne WebGL-Kontext
 * testbar (`__tests__/use-city-world.test.tsx`).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveCityTapTarget } from '../domain/city-tap-target';
import type { CityNavigationViewModel } from './city-view-model';
import type { CityModelTab } from './use-city-model';

export type CityWorld = {
  hoveredBoxId: string | null;
  setHoveredBox: (id: string | null) => void;
  handleTapBox: (id: string | null) => void;
};

export function useCityWorld(args: {
  tab: CityModelTab;
  setTab: (tab: CityModelTab) => void;
  nav: CityNavigationViewModel;
  /** `CityOverviewInfo.incomeDistrictIds` als Menge — nur in der Übersicht gefüllt. */
  incomeDistrictIds: ReadonlySet<string>;
  /** Erste erfolgreiche Interaktion (WP-D3: blendet den Erst-Besuch-Hinweis aus). */
  onInteract?: () => void;
}): CityWorld {
  const { tab, setTab, nav, incomeDistrictIds, onInteract } = args;

  const [hoveredBoxId, setHoveredBox] = useState<string | null>(null);

  // WP-D8 (Übersicht → Welt-Sprung): beim zweiten Tap auf ein Viertel der
  // Übersicht wird in dessen Welt gewechselt UND direkt der Distrikt betreten
  // — der Welt-Reset-Effekt liest dieses Ziel, statt auf die Stadt-Ebene zu gehen.
  const pendingWorldFocusRef = useRef<{ districtId: string } | null>(null);

  // `nav.actions` ist referenzstabil (use-city-navigation.ts), bewusst nicht
  // in den Deps — sonst liefe der Reset bei jedem Render der Seite.
  useEffect(() => {
    const pending = pendingWorldFocusRef.current;
    pendingWorldFocusRef.current = null;
    if (pending) nav.actions.goTo('district', pending.districtId);
    else nav.actions.goTo('city');
    setHoveredBox(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Ebenenwechsel: die gehoverte Box existiert im neuen Layout evtl. nicht
  // mehr — Hover-Zustand zurücksetzen statt ein totes Highlight zu halten.
  useEffect(() => {
    setHoveredBox(null);
  }, [nav.level]);

  const handleTapBox = useCallback(
    (id: string | null) => {
      // `null` (Boden/Leere) macht bewusst nichts — auch keine „erste
      // Interaktion": der Nutzer hat nichts getroffen.
      if (!id) return;
      onInteract?.();

      const target = resolveCityTapTarget(id, {
        isOverview: tab === 'overview',
        focusDistrictId: nav.focusDistrictId,
        incomeDistrictIds,
      });

      switch (target.kind) {
        case 'none':
          return;
        case 'enter-world':
          pendingWorldFocusRef.current = { districtId: target.districtId };
          setTab(target.world);
          return;
        case 'district':
          nav.actions.tapDistrict(target.districtId);
          return;
        case 'subcategory':
          nav.actions.tapSubcategory(target.subcategoryId);
          return;
        case 'contract':
          nav.actions.tapContract(target.contractId);
          return;
      }
    },
    [nav.actions, nav.focusDistrictId, tab, setTab, incomeDistrictIds, onInteract],
  );

  return { hoveredBoxId, setHoveredBox, handleTapBox };
}
