/**
 * Atmosphären-Preset der Stadt (WP-4.3, herausgelöst in WP 6.4).
 *
 * Die Stadt zeigt subtil ihre „Stimmung" aus den Zahlen, die sie ohnehin
 * visualisiert — ausschließlich in der Übersicht, weil nur dort BEIDE Seiten
 * (Einnahmen und Ausgaben) auf einer Platte stehen. Eine einseitige Welt
 * (nur Ausgaben, nur Einnahmen) oder die Ziele-Welt (Brüche statt Euros)
 * trägt keine Stimmung — sie bleibt neutral.
 *
 * Liegt in `application/` und nicht in `domain/`: `deriveAtmosphere` ist eine
 * reine Funktion, wohnt aber in `src/hooks/useAtmosphereState.ts`, und eine
 * Feature-`domain` darf nicht nach `src/hooks/` greifen (`check:layers`,
 * Regel `feature-domain-rein`). Die Ableitung hier bleibt trotzdem rein und
 * ohne React testbar.
 */

import { deriveAtmosphere } from '@/hooks/useAtmosphereState';
import type { CityOverviewInfo } from '../domain/city-overview-adapter';

export type CityAtmospherePreset = 'stable' | 'neutral' | 'risk';

export function deriveCityAtmospherePreset(input: {
  isOverview: boolean;
  overview?: CityOverviewInfo;
  valueKind?: 'currency' | 'progress';
}): CityAtmospherePreset {
  if (!input.isOverview || !input.overview) return 'neutral';

  const state = deriveAtmosphere({
    monthlyIncome: input.overview.incomeTotal,
    monthlyExpenses: input.overview.expensesTotal,
    hasData: true,
    // Die Übersicht führt keine Budget-Überschreitungen mit.
    budgetOvercount: 0,
  });
  if (state.temperature === 'warm') return 'stable';
  if (state.temperature === 'cool') return 'risk';
  return 'neutral';
}
