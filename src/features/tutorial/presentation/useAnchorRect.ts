import { useEffect, useState } from 'react';
import { anchorSelector } from '../domain/tutorial-steps';

export interface AnchorRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Wartezeit, bis eine weiche Scrollbewegung steht. `scrollend` ist noch nicht
 * überall verfügbar; deshalb wird zusätzlich nachgemessen.
 */
const SCROLL_SETTLE_MS = 400;

/** Takt, in dem geprüft wird, ob der Anker (noch) da ist und wo er liegt. */
const WATCH_MS = 250;

/**
 * Verfolgt einen `data-tour-id`-Anker: scrollt ihn ins Bild und **beobachtet
 * ihn weiter**, solange der Schritt läuft.
 *
 * Das Weiterbeobachten ist der Unterschied zwischen „einmal gemessen" und
 * „weiß, was auf dem Bildschirm passiert". Schließt der Nutzer die
 * Detailansicht, verschwindet der Anker — vorher lief die Führung stumpf
 * weiter und zeigte auf nichts. Jetzt meldet der Hook `null`, und die
 * Aufrufstelle kann den Bereich wieder öffnen.
 *
 * `null` heißt damit zweierlei: noch nicht da, oder nicht mehr da. Für die
 * Führung ist das dasselbe — sie braucht ihn.
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

    let revealedFor: Element | null = null;
    const timers: number[] = [];

    /**
     * Misst und — beim ersten Auftauchen eines Elements — scrollt es mittig
     * ins Bild. Der Scroll passiert bewusst nur einmal je Element: Sonst risse
     * er dem Nutzer bei jedem Takt die Seite unter den Fingern weg.
     */
    const measure = () => {
      const el = document.querySelector(anchorSelector(anchor));
      if (!el) {
        revealedFor = null;
        setRect(null);
        return;
      }

      if (revealedFor !== el) {
        revealedFor = el;
        el.scrollIntoView({
          block: 'center',
          inline: 'nearest',
          behavior: reduceMotion ? 'auto' : 'smooth',
        });
        // Nach der Scrollbewegung erneut messen — sonst stünde das Loch dort,
        // wo das Ziel vorher war.
        timers.push(window.setTimeout(measure, reduceMotion ? 0 : SCROLL_SETTLE_MS));
      }

      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    measure();
    const watch = window.setInterval(measure, WATCH_MS);
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.clearInterval(watch);
      for (const id of timers) window.clearTimeout(id);
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [anchor, active, reduceMotion]);

  return rect;
}
