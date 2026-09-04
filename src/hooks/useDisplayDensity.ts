import { useSyncExternalStore } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  COMPACT_MEDIA_QUERY,
  resolveDensity,
  type DisplayDensity,
} from '@/features/shared/domain/display-density';

/**
 * Die aktuelle Darstellungsdichte — **kompakt** oder **fokussiert**.
 *
 * Umsetzung von `docs/architecture/darstellungsdichte.md`, Regel 4 und 7.
 *
 * **Warum `useSyncExternalStore` und nicht `useEffect` + `useState`.** Regel 7
 * verlangt, dass die Entscheidung VOR dem ersten Anstrich feststeht. Der
 * übliche Weg (`useState(false)`, im Effekt korrigieren) zeigt erst die
 * falsche Fassung und baut sie danach um — auf einem Telefon also einen
 * kurzen Blick auf die kompakte Ansicht. Genau das ist bei `useMediaQuery`
 * der Fall, und deshalb baut dieser Hook nicht darauf auf: Sein
 * `getSnapshot` läuft synchron beim ersten Render.
 *
 * Zweiter Unterschied zu `useMediaQuery`: Die Breite ist hier nicht die
 * einzige Frage. Läuft die App über Capacitor, ist sie **immer** fokussiert —
 * auch auf einem Tablet im Querformat.
 *
 * `useIsMobile` (639 px) und `useIsWideDesktop` (1024 px) bleiben bestehen,
 * beantworten aber ausdrücklich eine ANDERE Frage: Layout INNERHALB einer
 * Dichte. Sie dürfen nie über die Dichte entscheiden.
 */
export function useDisplayDensity(): DisplayDensity {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const mql = window.matchMedia(COMPACT_MEDIA_QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function getSnapshot(): DisplayDensity {
  return resolveDensity({
    isNativeApp: Capacitor.isNativePlatform(),
    // `innerWidth` statt `matchMedia(...).matches`: Die Regel ist als
    // Zahlenvergleich formuliert und begründet (Ersatz-Viewport ~980), und
    // sie soll an genau EINER Stelle stehen — in `resolveDensity`. Wer hier
    // stattdessen `matches` durchreichte, hätte die Schwelle ein zweites Mal
    // im Code, nur als Zeichenkette. Für die Benachrichtigung ist die Media
    // Query trotzdem der richtige Weg (siehe `subscribe`): Sie feuert bei
    // jeder Überschreitung, ein `resize`-Listener bei jedem Pixel.
    viewportWidthPx: typeof window === 'undefined' ? null : window.innerWidth,
  });
}

/**
 * Ohne `window` (SSR, Tests) gilt fokussiert — die sichere Richtung: Die
 * fokussierte Fassung ist auf jedem Bildschirm bedienbar, nur weniger dicht.
 */
function getServerSnapshot(): DisplayDensity {
  return 'fokussiert';
}
