/**
 * ViewModel der Finanzstadt-Route (WP 6.4, ARCH-5/KOMP-1).
 *
 * Bündelt die vier Teilmodelle, aus denen die Fläche besteht — Daten
 * (`useCityModel`), Navigation (`useCityNavigation`), Welt/Interaktion
 * (`useCityWorld`) und Geometrie (`useCityGeometry`) — plus die kleinen
 * Ableitungen darüber. Die Route selbst (`src/pages/CityPage.tsx`) rendert
 * danach nur noch; sie hält keinen fachlichen Zustand mehr.
 *
 * KEIN three.js, kein Canvas: dieser Hook läuft vollständig in jsdom. Das ist
 * der eigentliche Gewinn der Aufteilung — Zustandsübergänge der Stadt sind
 * prüfbar, ohne einen WebGL-Kontext aufbauen zu müssen (den jsdom nicht hat).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatCurrency, formatPercent } from '@/lib/utils';
import type { CityRequestState } from '../domain/city-request-state';
import { buildCityContractSheet, selectCityContract, type CityContractSheet } from '../domain/city-contract-sheet';
import { useCityModel, type CityModelTab } from './use-city-model';
import { useCityNavigation } from './use-city-navigation';
import { useCityBackNavigation } from './use-city-back-navigation';
import { useCityWorld } from './use-city-world';
import { useCityGeometry, type CityGeometry } from './use-city-geometry';
import { useCityTimelineCursor, type CityTimelineCursor } from './use-city-timeline-cursor';
import { useCityTapHint, type CityTapHint } from './use-city-tap-hint';
import { deriveCityAtmospherePreset, type CityAtmospherePreset } from './city-atmosphere';
import type { CityMonth } from '../domain/city-timeline';
import type { CityOverviewInfo } from '../domain/city-overview-adapter';
import type { CityModel, CityNavigationViewModel } from './city-view-model';

export type CityPageModel = {
  model: CityModel;
  overview?: CityOverviewInfo;
  timeline: CityMonth[];
  requestState: CityRequestState;
  refetch: () => void;
  /** Canvas/Labels/Liste mounten NUR mit geladenen, nicht-leeren Daten — spart den WebGL-Kontext. */
  canvasMounted: boolean;

  nav: CityNavigationViewModel;
  geometry: CityGeometry;
  timelineCursor: CityTimelineCursor;
  tapHint: CityTapHint;

  tab: CityModelTab;
  setTab: (tab: CityModelTab) => void;
  hoveredBoxId: string | null;
  setHoveredBox: (id: string | null) => void;
  handleTapBox: (id: string | null) => void;

  /** WP-D7: Ziele tragen Fortschritts-Brüche statt Euros. */
  valueFormat: 'currency' | 'percent';
  formatCityAmount: (amount: number) => string;
  /** WP-D7: „X von Y erreicht" — reines Zählen von Flags, keine Geld-Aggregation. */
  goalsSummary: { achieved: number; total: number } | null;
  atmospherePreset: CityAtmospherePreset;

  sheet: CityContractSheet | null;
  closeSheet: () => void;
};

export function useCityPageModel(cityBreadcrumbLabel: string, locale: string): CityPageModel {
  // WP-5.2: `null` = der Vorgabe-Ausschnitt (alle geladenen Buchungen). Erst
  // ein Klick auf die Monatsleiste wählt einen konkreten Monat — die Seite
  // startet also nicht in einem Zustand, den niemand gewählt hat.
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  // WP-D5/D7: aktive Welt der Stadt (Ausgaben/Einnahmen/Ziele/Übersicht) —
  // gleiche Pipeline, anderer Adapter. Der Zustand liegt hier, weil ihn
  // `useCityModel` als erster braucht; die Übergänge darauf stehen in
  // `useCityWorld`.
  const [tab, setTab] = useState<CityModelTab>('expenses');

  const { model, requestState, refetch, overview, timeline } = useCityModel(
    tab,
    selectedMonth ?? undefined,
  );

  const nav = useCityNavigation(model, { city: cityBreadcrumbLabel });
  // README-Akzeptanzkriterium „Android-Hardware-Back": Drill-down zuerst eine
  // Ebene zurück, erst danach Standard-Navigation. Inert im Web.
  useCityBackNavigation(nav);

  const incomeDistrictIds = useMemo(() => new Set(overview?.incomeDistrictIds ?? []), [overview]);
  const tapHint = useCityTapHint();
  const dismissTapHint = tapHint.dismiss;
  const world = useCityWorld({ tab, setTab, nav, incomeDistrictIds, onInteract: dismissTapHint });
  // WP-D3: Der Hinweis verschwindet auch, wenn der Drill-down NICHT über einen
  // Canvas-Tap kam — die Listenansicht teilt denselben `nav`-State, und wer
  // schon eine Ebene tiefer steht, braucht „Tippe auf ein Viertel" nicht mehr.
  useEffect(() => {
    if (nav.level !== 'city') dismissTapHint();
  }, [nav.level, dismissTapHint]);

  const geometry = useCityGeometry(model, nav);
  const timelineCursor = useCityTimelineCursor({ timeline, selectedMonth, onSelectMonth: setSelectedMonth, locale });

  const valueFormat: 'currency' | 'percent' = model.valueKind === 'progress' ? 'percent' : 'currency';
  const formatCityAmount = useCallback(
    (amount: number) => (valueFormat === 'percent' ? formatPercent(amount, 0) : formatCurrency(amount)),
    [valueFormat],
  );

  const goalsSummary =
    tab === 'goals'
      ? { achieved: model.districts.filter((d) => d.achieved).length, total: model.districts.length }
      : null;

  const atmospherePreset = useMemo(
    () => deriveCityAtmospherePreset({ isOverview: tab === 'overview', overview, valueKind: model.valueKind }),
    [tab, overview, model.valueKind],
  );

  const sheet = buildCityContractSheet(
    selectCityContract(model, nav.activeDistrictId, nav.activeSubcategoryId, nav.selectedContractId),
    { world: tab === 'expenses' ? 'expenses' : tab === 'income' ? 'income' : 'other' },
  );

  return {
    model,
    overview,
    timeline,
    // Seit WP 7.6 liefert useCityModel den Zustand fertig gerangfolgt —
    // die Ableitung hier war die Uebergangsloesung aus WP 6.4.
    requestState,
    refetch,
    // Verhaltensgleich zu frueher (!isLoading && !isEmpty): Die Buehne haengt
    // an VORHANDENEN Distrikten, nicht am Fehlerzustand — ein Fehler MIT
    // stehenden Daten laesst sie stehen, ein Fehler ohne Daten nicht.
    canvasMounted: requestState !== 'loading' && model.districts.length > 0,
    nav,
    geometry,
    timelineCursor,
    tapHint,
    tab,
    setTab,
    hoveredBoxId: world.hoveredBoxId,
    setHoveredBox: world.setHoveredBox,
    handleTapBox: world.handleTapBox,
    valueFormat,
    formatCityAmount,
    goalsSummary,
    atmospherePreset,
    sheet,
    closeSheet: nav.actions.closeContract,
  };
}
