import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

interface AnimatedCheckProps {
  /** Kantenlänge in px. */
  size?: number;
  className?: string;
}

// Ungefähre Länge des Haken-Pfads (für den Draw-on via stroke-dasharray).
const CHECK_LEN = 24;

/**
 * Erfolgs-Haken als handgebautes SVG: der Haken wird beim Mount „gezeichnet"
 * (stroke-dasharray-Draw-on), gleicher Anspruch wie die Tank-Animation. Erbt
 * die Farbe via `currentColor`. Bei `prefers-reduced-motion` sofort der fertig
 * gezeichnete Haken ohne Bewegung.
 */
export default function AnimatedCheck({ size = 20, className }: AnimatedCheckProps) {
  const reduce = useReducedMotion();

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      role="img"
      aria-hidden
      className={cn("text-positive", className)}
      data-animated={!reduce}
    >
      <circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" strokeWidth="2" opacity={0.25} />
      <path
        d="M7 12.5l3.2 3.2L17 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={
          reduce
            ? undefined
            : {
                strokeDasharray: CHECK_LEN,
                strokeDashoffset: CHECK_LEN,
                animation: "check-draw 420ms ease-out 60ms forwards",
              }
        }
      />
    </svg>
  );
}
