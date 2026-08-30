/**
 * DissolveTransition — die Auflösung des Abgewählten.
 *
 * Was abgewählt wurde, zerfällt zu Asche: Ein gedachter Wind treibt sie nach
 * links, danach steigt sie auf. Die Rechnung dazu steht rein und ohne Canvas
 * in `@/lib/dissolve-particles`; hier liegt nur, was ohne Browser nicht geht —
 * Messen, Zeichnen, Zeitnehmen.
 *
 * Die Komponente übernimmt **beides**: sie zeichnet die Partikel UND blendet
 * die Zielelemente aus. Bewusst an einer Stelle — läge das Ausblenden bei der
 * Aufrufstelle, müssten sich zwei Dateien über dieselbe Dauer einig sein, und
 * genau solche Absprachen driften.
 *
 * Bei `prefers-reduced-motion` entsteht **kein** Canvas und keine
 * rAF-Schleife: Der Fluss darf ohne Bewegung nicht langsamer sein, deshalb
 * nur ein kurzes Ausblenden und sofort weiter.
 */

import { useEffect, useRef, type RefObject } from 'react';
import {
  DISSOLVE_DURATION_MS,
  advanceParticle,
  createRandom,
  seedParticles,
  type DissolveParticle,
  type DissolveRect,
} from '@/lib/dissolve-particles';
import { MOTION_DURATIONS, MOTION_EASINGS } from '@/lib/motion-tokens';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export interface DissolveTransitionProps {
  /**
   * Läuft die Auflösung? Der Wechsel `false → true` startet sie **genau
   * einmal**; ein Re-Render währenddessen setzt sie nicht zurück.
   */
  active: boolean;
  /** Die Elemente, die zerfallen sollen. Leere Referenzen werden übersprungen. */
  targets: readonly RefObject<HTMLElement | null>[];
  /** Läuft nach Abschluss — auch bei reduzierter Bewegung. */
  onComplete: () => void;
}

/** Vordergrundfarbe des Elements, als Farbe der Asche. */
function elementFarbe(element: HTMLElement): string {
  try {
    return window.getComputedStyle(element).color || 'currentColor';
  } catch {
    return 'currentColor';
  }
}

export default function DissolveTransition({
  active,
  targets,
  onComplete,
}: DissolveTransitionProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduce = useReducedMotion();
  // Der Abschluss-Callback wechselt bei jedem Render die Identität; als
  // Abhängigkeit würde er die Animation neu starten.
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  const targetsRef = useRef(targets);
  targetsRef.current = targets;
  /** Läuft schon? Schützt gegen einen zweiten Start durch Re-Render. */
  const laeuftRef = useRef(false);

  useEffect(() => {
    if (!active || laeuftRef.current) return;
    laeuftRef.current = true;

    const elemente = targetsRef.current
      .map((ref) => ref.current)
      .filter((el): el is HTMLElement => el !== null);

    // Ausblenden gehört in beide Fälle — nur die Dauer unterscheidet sich.
    const fadeMs = reduce ? MOTION_DURATIONS.fast : DISSOLVE_DURATION_MS * 0.75;
    for (const el of elemente) {
      el.style.transition = `opacity ${fadeMs}ms ${MOTION_EASINGS.build}, filter ${fadeMs}ms ${MOTION_EASINGS.build}, transform ${fadeMs}ms ${MOTION_EASINGS.build}`;
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
      if (!reduce) {
        el.style.filter = 'blur(6px)';
        el.style.transform = 'translateX(-12px)';
      }
    }

    if (reduce) {
      const timer = window.setTimeout(() => completeRef.current(), MOTION_DURATIONS.fast);
      return () => window.clearTimeout(timer);
    }

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d') ?? null;

    const rects: DissolveRect[] = elemente.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };
    });
    const farben = elemente.map(elementFarbe);
    const partikel: DissolveParticle[] = seedParticles(rects, createRandom(Date.now() & 0xffff));

    let frame = 0;
    const start = performance.now();

    if (canvas && ctx) {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      ctx.scale(dpr, dpr);
    }

    const schritt = (jetzt: number) => {
      const t = jetzt - start;
      if (ctx && canvas) {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        for (const p of partikel) {
          const probe = advanceParticle(p, t);
          if (probe.alpha <= 0) continue;
          ctx.globalAlpha = probe.alpha;
          ctx.fillStyle = farben[p.quelle] ?? 'currentColor';
          ctx.fillRect(probe.x, probe.y, p.groesse, p.groesse);
        }
        ctx.globalAlpha = 1;
      }
      if (t >= DISSOLVE_DURATION_MS) {
        completeRef.current();
        return;
      }
      frame = window.requestAnimationFrame(schritt);
    };
    frame = window.requestAnimationFrame(schritt);

    return () => window.cancelAnimationFrame(frame);
  }, [active, reduce]);

  // Ohne laufende Auflösung und bei reduzierter Bewegung gibt es nichts zu
  // zeichnen — dann existiert auch kein Canvas.
  if (!active || reduce) return null;

  return (
    <canvas
      ref={canvasRef}
      data-testid="dissolve-canvas"
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 h-full w-full"
    />
  );
}
