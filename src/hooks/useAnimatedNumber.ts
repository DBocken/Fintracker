import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "./useReducedMotion";

/** Kubisches Auslaufen (easeOutCubic) – schneller Start, sanftes Ende. */
function easeOutCubic(p: number): number {
  return 1 - Math.pow(1 - p, 3);
}

interface AnimatedNumberOptions {
  /** Dauer der Tween-Animation in ms (Default 1300, wie der Budget-Tank). */
  durationMs?: number;
  /** Animation aktiv? Bei false (oder reduced-motion) sofort der Zielwert. */
  enabled?: boolean;
}

/**
 * Zählt von der zuletzt gezeigten Zahl weich auf `target` hoch/runter
 * (rAF + easeOutCubic) – dieselbe Tween-Mechanik wie das Einfüllen des
 * Budget-Tanks. Respektiert `prefers-reduced-motion`: dann springt der Wert
 * ohne Animation direkt auf das Ziel.
 *
 * Gibt den aktuell anzuzeigenden (gerundeten Verlaufs-)Wert zurück.
 */
export function useAnimatedNumber(
  target: number,
  { durationMs = 1300, enabled = true }: AnimatedNumberOptions = {},
): number {
  const reduce = useReducedMotion();
  const safeTarget = Number.isFinite(target) ? target : 0;
  const animate = enabled && !reduce;

  const [value, setValue] = useState(animate ? 0 : safeTarget);
  // Startwert der laufenden Tween-Phase (zuletzt sichtbarer Wert).
  const fromRef = useRef(animate ? 0 : safeTarget);

  useEffect(() => {
    if (!animate) {
      fromRef.current = safeTarget;
      setValue(safeTarget);
      return;
    }
    const from = fromRef.current;
    const delta = safeTarget - from;
    if (delta === 0) return;

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      const current = from + delta * easeOutCubic(p);
      setValue(current);
      fromRef.current = current;
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = safeTarget;
        setValue(safeTarget);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animate, safeTarget, durationMs]);

  return value;
}
