import { useEffect, useState } from 'react';
import { anchorSelector } from '@/lib/tutorial-steps';

export interface AnchorRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Verfolgt die Bildschirmposition eines `data-tour-id`-Ankers.
 *
 * `null` heißt: Anker (noch) nicht im DOM. Die Aufrufstelle **überspringt**
 * den Schritt dann — ein fehlender Anker darf nie blockieren
 * (`docs/tutorial-progressive-disclosure.md`). Genau dieser Fall tritt nach
 * jedem Refactor auf, der einen Marker verliert, und nach jeder Navigation,
 * bevor die Zielseite gerendert hat.
 *
 * Neu gemessen wird bei Scrollen und Größenänderung, weil die Position aus
 * `getBoundingClientRect()` viewport-relativ ist und das Loch sonst
 * stehenbliebe, während die Seite darunter wegläuft.
 */
export function useAnchorRect(anchor: string | undefined, active: boolean): AnchorRect | null {
  const [rect, setRect] = useState<AnchorRect | null>(null);

  useEffect(() => {
    if (!active || !anchor) {
      setRect(null);
      return;
    }

    let frame = 0;
    const measure = () => {
      const el = document.querySelector(anchorSelector(anchor));
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    // Erste Messung im nächsten Frame: direkt nach einer Navigation steht das
    // Ziel noch nicht, und eine sofortige Messung ergäbe „Anker fehlt".
    frame = requestAnimationFrame(measure);

    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [anchor, active]);

  return rect;
}
