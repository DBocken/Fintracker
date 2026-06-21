/**
 * Reduced-Motion-Policy (Audit C-P2/G).
 *
 * Framer-Motion liefert bereits `useReducedMotion`, das die System-
 * Einstellung `prefers-reduced-motion` reaktiv ausliest. Dieser Wrapper
 * zentralisiert den Zugriff und bietet `useMotionSafe()` an, das fertige
 * Motion-Props zurückgibt, die im reduzierten Modus jede Bewegung
 * neutralisieren (kein initialer Versatz, keine Dauer).
 */
import { useReducedMotion as useFramerReducedMotion } from "framer-motion";
import type { Target, Transition } from "framer-motion";

/** True, wenn der Nutzer reduzierte Bewegung bevorzugt. */
export function useReducedMotion(): boolean {
  return useFramerReducedMotion() ?? false;
}

type MotionProps = {
  initial?: Target | false;
  animate?: Target;
  transition?: Transition;
};

/**
 * Reicht die gewünschten Motion-Props durch — außer wenn reduzierte
 * Bewegung aktiv ist: dann wird direkt der Zielzustand ohne Animation
 * gerendert (`initial = animate`, `transition.duration = 0`).
 */
export function useMotionSafe(props: MotionProps): MotionProps {
  const reduce = useReducedMotion();
  if (!reduce) return props;
  return {
    initial: props.animate ?? false,
    animate: props.animate,
    transition: { duration: 0 },
  };
}
