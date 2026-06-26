import { useEffect, useRef } from "react";
// Light-Player ohne Expression-/eval-Pfad – CSP-konform (script-src 'self').
import lottie, { type AnimationItem } from "lottie-web/build/player/lottie_light";
import type { BudgetHealth } from "@/types";
import { buildTankAnimation } from "./tank-animation";

/** Statusfarben der Flüssigkeit (Lottie-RGB, 0..1). */
const HEALTH_RGB: Record<BudgetHealth, [number, number, number]> = {
  ok: [0.13, 0.55, 0.78], // ruhiges Blau
  warn: [0.93, 0.6, 0.04], // Bernstein
  over: [0.86, 0.22, 0.22], // Rot
};

interface BudgetTankProps {
  /** Füllstand in Prozent (0..100). Wird auf den gleichen Lottie-Frame gemappt. */
  fillPercent: number;
  health: BudgetHealth;
  /** Breite in px; die Höhe folgt dem Seitenverhältnis 220:280. */
  size?: number;
  className?: string;
}

/**
 * Budget-„Tank": eine Lottie-Animation, deren Flüssigkeit auf den dem Füllstand
 * entsprechenden Frame eingefroren wird (Frame N = N % gefüllt). Statusabhängig
 * eingefärbt.
 */
export default function BudgetTank({ fillPercent, health, size = 120, className }: BudgetTankProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);

  const frame = Math.max(0, Math.min(100, Number.isFinite(fillPercent) ? fillPercent : 0));

  // (Neu-)Laden, wenn sich die Statusfarbe ändert – die Farbe ist in den
  // Animationsdaten gebacken.
  useEffect(() => {
    if (!containerRef.current) return;
    animRef.current?.destroy();
    const anim = lottie.loadAnimation({
      container: containerRef.current,
      renderer: "svg",
      loop: false,
      autoplay: false,
      animationData: buildTankAnimation(HEALTH_RGB[health]),
    });
    animRef.current = anim;
    anim.addEventListener("DOMLoaded", () => anim.goToAndStop(frame, true));
    return () => {
      anim.destroy();
      animRef.current = null;
    };
    // `frame` wird absichtlich im zweiten Effekt behandelt, nicht hier.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [health]);

  // Bei reiner Füllstandsänderung nur neu positionieren (kein Reload).
  useEffect(() => {
    animRef.current?.goToAndStop(frame, true);
  }, [frame]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: size, height: size * (280 / 220) }}
      aria-hidden
    />
  );
}
