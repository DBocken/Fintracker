/**
 * Misst die reale Canvas-Fläche für die Label-Reprojektion (NDC →
 * Bildschirm-Pixel, `CityLabels`) — herausgelöst aus `CityPage.tsx` in WP 6.4.
 *
 * Bewusst über einen EIGENEN Container-Ref statt über `scene.domElement`:
 * bleibt so auch funktionsfähig, wenn WebGL nicht verfügbar ist
 * (`webglUnavailable`-Fallback in `CityCanvas.tsx`) — die Fläche existiert so
 * oder so.
 *
 * `active` (= Canvas gemountet) ist Pflicht-Dependency: der Container-Div
 * existiert erst, sobald Laden-/Leer-Zustand vorbei sind. Ohne diese Dep liefe
 * der Effekt nur beim allerersten (leeren) Render, `el` wäre `null`, und der
 * `ResizeObserver` würde nie nachträglich angehängt.
 */

import { useEffect, useState, type RefObject } from 'react';

export type CityCanvasSize = { width: number; height: number };

export function useCityCanvasSize(args: {
  containerRef: RefObject<HTMLElement | null>;
  active: boolean;
  /**
   * EINEN Frame anfordern, sobald die Fläche bekannt ist / sich ändert:
   * `CityLabels.reproject` läuft ausschließlich über `onFrame` (Perf-Vorgabe),
   * und `onFrame` feuert nur in tatsächlich gerenderten Frames. Ohne diesen
   * Anstoß bliebe die Reprojektion aus, wenn der einzige bisherige Frame noch
   * mit `{0,0}` lief und die Kamera danach still steht — insbesondere unter
   * `prefers-reduced-motion`, wo der Eröffnungs-Intent nur einen Sofort-Schnitt
   * auslöst.
   */
  requestFrame: () => void;
}): CityCanvasSize {
  const { containerRef, active, requestFrame } = args;
  const [size, setSize] = useState<CityCanvasSize>({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };
    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    if (size.width > 0 && size.height > 0) requestFrame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  return size;
}
