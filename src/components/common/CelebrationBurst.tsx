import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

interface CelebrationBurstProps {
  /** Kantenlänge in px (quadratisch). */
  size?: number;
  className?: string;
  /** Anzahl der Strahlen (Default 12). */
  rays?: number;
}

/**
 * Erfolgs-Funke als handgebautes SVG (gleicher Stil wie der Budget-Tank):
 * ein einmaliger Strahlen-Burst, der beim Mount aus der Mitte aufblitzt und
 * sanft ausläuft. Erbt die Farbe via `currentColor`. Respektiert
 * `prefers-reduced-motion` – dann ein ruhender Stern ohne Bewegung.
 */
export default function CelebrationBurst({ size = 32, className, rays = 12 }: CelebrationBurstProps) {
  const reduce = useReducedMotion();
  const spokes = Array.from({ length: rays });

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-hidden
      className={cn("text-positive", className)}
      data-animated={!reduce}
    >
      <g
        style={
          reduce
            ? undefined
            : { animation: "celebration-burst 900ms cubic-bezier(0.22,1,0.36,1) both", transformOrigin: "50% 50%" }
        }
      >
        {spokes.map((_, i) => {
          const angle = (i / spokes.length) * Math.PI * 2;
          const inner = 16;
          const outer = i % 2 === 0 ? 40 : 32;
          return (
            <line
              key={i}
              x1={50 + Math.cos(angle) * inner}
              y1={50 + Math.sin(angle) * inner}
              x2={50 + Math.cos(angle) * outer}
              y2={50 + Math.sin(angle) * outer}
              stroke="currentColor"
              strokeWidth={i % 2 === 0 ? 5 : 3}
              strokeLinecap="round"
              opacity={i % 2 === 0 ? 1 : 0.65}
            />
          );
        })}
        <circle cx="50" cy="50" r="9" fill="currentColor" />
      </g>
    </svg>
  );
}
