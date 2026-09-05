/**
 * DissolveTransition — die Auflösung des Abgewählten.
 *
 * Was abgewählt wurde, zerfällt in **genau seine eigenen Bildpunkte**: Ein
 * gedachter Wind treibt sie nach links, danach steigen sie auf. Die Rechnung
 * dazu steht rein und ohne Canvas in `@/lib/dissolve-particles`, die
 * Abtastung in `./dissolve-raster`; hier liegt nur, was beides zusammenführt —
 * Messen, Zeichnen, Zeitnehmen.
 *
 * **Das Element verschwindet sofort, es blendet nicht aus.** Sobald die
 * Abtastung steht, tragen die Partikel das Bild vollständig — vor ihrem
 * Zerfall stehen sie still und voll sichtbar an ihrem Platz. Ein gleichzeitig
 * ausblendendes Element wäre ein zweites, halb durchsichtiges Abbild daneben;
 * die Fläche soll erodieren, nicht verblassen.
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
  type DissolvePoint,
} from '@/lib/dissolve-particles';
import { MOTION_DURATIONS, MOTION_EASINGS } from '@/lib/motion-tokens';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { DISSOLVE_SAMPLE_STRIDE, samplePoints } from './dissolve-raster';

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

/** Nimmt das Element aus dem Bild und aus jeder Bedienung. */
function verstecke(el: HTMLElement, sofort: boolean): void {
  if (sofort) {
    el.style.visibility = 'hidden';
  } else {
    el.style.transition = `opacity ${MOTION_DURATIONS.fast}ms ${MOTION_EASINGS.build}`;
    el.style.opacity = '0';
  }
  el.style.pointerEvents = 'none';
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

    if (reduce) {
      for (const el of elemente) verstecke(el, false);
      const timer = window.setTimeout(() => completeRef.current(), MOTION_DURATIONS.fast);
      return () => window.clearTimeout(timer);
    }

    // Erst abtasten, dann verstecken — in dieser Reihenfolge, sonst hat die
    // Abtastung nichts mehr zu lesen.
    const punkte: DissolvePoint[] = elemente.flatMap((el) => samplePoints(el));
    for (const el of elemente) verstecke(el, punkte.length > 0);

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d') ?? null;
    const partikel: DissolveParticle[] = seedParticles(punkte, createRandom(Date.now() & 0xffff));

    if (canvas && ctx) {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      ctx.scale(dpr, dpr);
    }

    let frame = 0;
    const start = performance.now();

    const schritt = (jetzt: number) => {
      const t = jetzt - start;
      if (ctx) {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        for (const p of partikel) {
          const probe = advanceParticle(p, t);
          if (probe.alpha <= 0) continue;
          ctx.globalAlpha = probe.alpha;
          ctx.fillStyle = p.color;
          ctx.fillRect(probe.x, probe.y, DISSOLVE_SAMPLE_STRIDE, DISSOLVE_SAMPLE_STRIDE);
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
