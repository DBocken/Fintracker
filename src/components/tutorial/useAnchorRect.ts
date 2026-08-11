import { useEffect, useState } from 'react';
import { anchorSelector } from '@/lib/tutorial-steps';

export interface AnchorRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Wartezeit, bis eine weiche Scrollbewegung steht. `scrollend` ist noch nicht
 * überall verfügbar; deshalb wird zusätzlich nachgemessen, statt sich darauf
 * zu verlassen.
 */
const SCROLL_SETTLE_MS = 400;

/** Wie oft nach dem Erscheinen eines Schrittes nach dem Anker gesucht wird. */
const ANCHOR_RETRIES = 20;
const ANCHOR_RETRY_MS = 50;

/**
 * Verfolgt die Bildschirmposition eines `data-tour-id`-Ankers — und **scrollt
 * ihn ins Bild**, bevor der Schritt erklärt wird.
 *
 * Das Scrollen ist nicht Komfort, sondern Voraussetzung: Eine Führung, die auf
 * etwas außerhalb des sichtbaren Bereichs zeigt, zeigt auf nichts. Vorher
 * konnte genau das passieren, sobald ein Anker weiter unten auf der Seite lag.
 *
 * `null` heißt: Anker (noch) nicht im DOM. Die Aufrufstelle erklärt dann
 * trotzdem, blockiert aber nie (`docs/tutorial-progressive-disclosure.md`).
 * Gesucht wird kurz wiederholt, weil ein Schritt oft direkt nach einer
 * Navigation oder dem Öffnen eines Dialogs beginnt und das Ziel dann noch
 * nicht steht.
 */
export function useAnchorRect(
  anchor: string | undefined,
  active: boolean,
  reduceMotion: boolean,
): AnchorRect | null {
  const [rect, setRect] = useState<AnchorRect | null>(null);

  useEffect(() => {
    if (!active || !anchor) {
      setRect(null);
      return;
    }

    // Erst lösen, dann suchen. Ein Rahmen, der beim Schrittwechsel stehen
    // bleibt, zeigt bis zu einer Sekunde lang auf das Element des VORIGEN
    // Schritts — nach einem Seitenwechsel also auf eine Stelle der alten
    // Seite. Lieber kurz kein Rahmen als ein falscher.
    setRect(null);

    let cancelled = false;
    const timers: number[] = [];

    const measure = () => {
      const el = document.querySelector(anchorSelector(anchor));
      if (!el) {
        setRect(null);
        return null;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      return el;
    };

    /**
     * Sucht den Anker, scrollt ihn mittig ins Bild und misst danach erneut.
     * Ohne die zweite Messung stünde das Loch dort, wo das Ziel *vor* dem
     * Scrollen war.
     */
    const findAndReveal = (attempt: number) => {
      if (cancelled) return;
      const el = document.querySelector(anchorSelector(anchor));
      if (!el) {
        if (attempt < ANCHOR_RETRIES) {
          timers.push(window.setTimeout(() => findAndReveal(attempt + 1), ANCHOR_RETRY_MS));
        } else {
          setRect(null);
        }
        return;
      }

      el.scrollIntoView({
        block: 'center',
        inline: 'nearest',
        behavior: reduceMotion ? 'auto' : 'smooth',
      });
      measure();
      timers.push(window.setTimeout(measure, reduceMotion ? 0 : SCROLL_SETTLE_MS));
    };

    findAndReveal(0);

    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      cancelled = true;
      for (const id of timers) window.clearTimeout(id);
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [anchor, active, reduceMotion]);

  return rect;
}
