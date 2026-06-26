import { useId } from "react";
import type { BudgetHealth } from "@/types";

/** Verlaufsfarben der Flüssigkeit je Status (oben → unten). */
const HEALTH_GRADIENT: Record<BudgetHealth, { top: string; bottom: string; surface: string }> = {
  ok: { top: "#38bdf8", bottom: "#0369a1", surface: "#7dd3fc" },
  warn: { top: "#fbbf24", bottom: "#b45309", surface: "#fcd34d" },
  over: { top: "#f87171", bottom: "#b91c1c", surface: "#fca5a5" },
};

// Tank-Geometrie im viewBox 0 0 100 130.
const INNER_X = 14;
const INNER_TOP = 16;
const INNER_BOTTOM = 120;
const INNER_W = 72;
const INNER_H = INNER_BOTTOM - INNER_TOP; // 104

/**
 * Baut einen geschlossenen Wellen-Pfad an der Flüssigkeits-Oberfläche.
 * Der Pfad ist doppelt so breit wie der Tank (144) und enthält eine ganze
 * Zahl Wellen, damit das horizontale Verschieben um 72 nahtlos loopt.
 */
function wavePath(surfaceY: number, amp: number, phaseDown: boolean): string {
  const segW = 18; // halbe Wellenlänge
  const segs = 8; // → 144 breit, 4 volle Wellen (2 je 72 → nahtloser Loop)
  let d = `M ${INNER_X} ${surfaceY}`;
  let up = !phaseDown;
  for (let i = 0; i < segs; i++) {
    const x0 = INNER_X + i * segW;
    const cx = x0 + segW / 2;
    const cy = surfaceY + (up ? -amp : amp);
    const ex = x0 + segW;
    d += ` Q ${cx} ${cy} ${ex} ${surfaceY}`;
    up = !up;
  }
  // Bis zum Tankboden schließen.
  d += ` L ${INNER_X + 144} ${INNER_BOTTOM} L ${INNER_X} ${INNER_BOTTOM} Z`;
  return d;
}

interface BudgetTankProps {
  /** Füllstand in Prozent (0..100). */
  fillPercent: number;
  health: BudgetHealth;
  /** Breite in px; Höhe folgt dem Seitenverhältnis 100:130. */
  size?: number;
  className?: string;
}

/**
 * Budget-„Tank" als animiertes SVG: Glas mit Deckel, Flüssigkeits-Verlauf,
 * lebendiger Oberflächen-Welle, Glanzlicht und Skala-Strichen. Der Füllstand
 * ist exakt datengetrieben (Höhe der Flüssigkeit = Prozentwert). Statusfarbe
 * über `health`. Die Wellenbewegung respektiert `prefers-reduced-motion`
 * (globale Policy in index.css).
 */
export default function BudgetTank({ fillPercent, health, size = 120, className }: BudgetTankProps) {
  const uid = useId().replace(/:/g, "");
  const fill = Math.max(0, Math.min(100, Number.isFinite(fillPercent) ? fillPercent : 0)) / 100;
  const colors = HEALTH_GRADIENT[health];

  // Oberkante der Flüssigkeit; bei sehr kleinem Füllstand etwas Sockel lassen.
  const surfaceY = INNER_TOP + (1 - fill) * INNER_H;
  const hasLiquid = fill > 0.001;

  const gradId = `tank-grad-${uid}`;
  const clipId = `tank-clip-${uid}`;
  const glossId = `tank-gloss-${uid}`;

  return (
    <svg
      viewBox="0 0 100 130"
      width={size}
      height={size * 1.3}
      className={className}
      role="img"
      aria-hidden
      data-fill={Math.round(fill * 100)}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colors.top} />
          <stop offset="100%" stopColor={colors.bottom} />
        </linearGradient>
        <linearGradient id={glossId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="35%" stopColor="#ffffff" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={clipId}>
          <rect x={INNER_X} y={INNER_TOP} width={INNER_W} height={INNER_H} rx="12" />
        </clipPath>
      </defs>

      {/* Deckel */}
      <rect x="38" y="2" width="24" height="11" rx="4" className="fill-foreground/70" />
      <rect x="44" y="0" width="12" height="6" rx="2" className="fill-foreground/70" />

      {/* Leerer Tank-Hintergrund */}
      <rect
        x={INNER_X}
        y={INNER_TOP}
        width={INNER_W}
        height={INNER_H}
        rx="12"
        className="fill-muted/40"
      />

      {/* Flüssigkeit + Wellen, auf den Innenraum geclippt */}
      {hasLiquid && (
        <g clipPath={`url(#${clipId})`}>
          <rect
            x={INNER_X}
            y={surfaceY}
            width={INNER_W}
            height={INNER_BOTTOM - surfaceY + 2}
            fill={`url(#${gradId})`}
          />
          {/* Zwei Wellen unterschiedlicher Geschwindigkeit für Tiefe */}
          <g
            style={{ animation: "budget-wave 2.6s linear infinite", willChange: "transform" }}
          >
            <path d={wavePath(surfaceY, 2.4, false)} fill={`url(#${gradId})`} opacity={0.55} />
          </g>
          <g
            style={{ animation: "budget-wave 1.7s linear infinite", willChange: "transform" }}
          >
            <path d={wavePath(surfaceY, 1.6, true)} fill={colors.surface} opacity={0.7} />
          </g>
        </g>
      )}

      {/* Skala-Striche (25/50/75 %) */}
      {[0.25, 0.5, 0.75].map((t) => (
        <line
          key={t}
          x1={INNER_X + 3}
          x2={INNER_X + 9}
          y1={INNER_TOP + (1 - t) * INNER_H}
          y2={INNER_TOP + (1 - t) * INNER_H}
          className="stroke-foreground/25"
          strokeWidth="1"
          strokeLinecap="round"
        />
      ))}

      {/* Glanzlicht über dem Glas */}
      <rect
        x={INNER_X + 2}
        y={INNER_TOP + 2}
        width={INNER_W * 0.4}
        height={INNER_H - 4}
        rx="8"
        fill={`url(#${glossId})`}
        clipPath={`url(#${clipId})`}
      />

      {/* Glas-Umriss */}
      <rect
        x={INNER_X}
        y={INNER_TOP}
        width={INNER_W}
        height={INNER_H}
        rx="12"
        fill="none"
        className="stroke-foreground/40"
        strokeWidth="2.5"
      />
    </svg>
  );
}
