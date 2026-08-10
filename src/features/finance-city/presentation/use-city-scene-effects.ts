/**
 * Die zwei Zustände, die die Seite imperativ in die Szene schreibt
 * (herausgelöst aus `CityPage.tsx` in WP 6.4):
 *
 * - **Hover-Highlight** (WP-D3): EIN gemeinsamer Zustand für Canvas-Raycast
 *   und Label-Hover, gespiegelt als Szenen-Highlight.
 * - **Atmosphäre-Preset** (WP-4.3): subtile Lichtmodulation aus den Zahlen,
 *   die die Stadt ohnehin zeigt.
 *
 * Beide ändern nur Material bzw. Lichtintensität — der Render-on-Demand-Loop
 * schläft dabei womöglich, deshalb wird nach jedem Schreiben explizit ein
 * Frame angefordert.
 */

import { useEffect, type MutableRefObject } from 'react';
import type { CityAtmospherePreset } from '../application/city-atmosphere';
import type { CitySceneHandle } from './city-scene';

export function useCitySceneEffects(args: {
  sceneRef: MutableRefObject<CitySceneHandle | null>;
  requestFrame: () => void;
  highlightId: string | null;
  atmosphere: CityAtmospherePreset;
}): void {
  const { sceneRef, requestFrame, highlightId, atmosphere } = args;

  useEffect(() => {
    sceneRef.current?.setHighlight(highlightId);
    requestFrame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightId]);

  useEffect(() => {
    sceneRef.current?.setAtmospherePreset(atmosphere);
    requestFrame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atmosphere]);
}
