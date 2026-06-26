import { useEffect, useId, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { smoothstep, hexToRgb, lerpRgb, rgbStr, type RgbTuple } from "@/lib/color-mix";
import type { BudgetHealth } from "@/types";

type Rgb = { top: string; bottom: string; surface: string };

/** Verlaufsfarben der Flüssigkeit je Status (oben → unten). */
const HEALTH_GRADIENT: Record<BudgetHealth, Rgb> = {
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

const FILL_ANIM_MS = 1300;

// Paletten einmalig nach numerischem RGB auflösen.
const PALETTE: Record<BudgetHealth, { top: RgbTuple; bottom: RgbTuple; surface: RgbTuple }> = {
  ok: { top: hexToRgb("#38bdf8"), bottom: hexToRgb("#0369a1"), surface: hexToRgb("#7dd3fc") },
  warn: { top: hexToRgb("#fbbf24"), bottom: hexToRgb("#b45309"), surface: hexToRgb("#fcd34d") },
  over: { top: hexToRgb("#f87171"), bottom: hexToRgb("#b91c1c"), surface: hexToRgb("#fca5a5") },
};

/**
 * Farbe für einen gegebenen (Live-)Füllstand: blendet beim Überschreiten der
 * Warnschwelle weich von Blau nach Bernstein und – falls das Budget überzogen
 * ist – nahe der Vollmarke weiter nach Rot. Die Interpolation läuft komplett in
 * numerischem RGB; erst am Ende wird in CSS-Strings gewandelt.
 */
export function colorForFill(fillPercent: number, warn: number, over: boolean): Rgb {
  const tWarn = smoothstep(warn - 6, warn + 6, fillPercent);
  let top = lerpRgb(PALETTE.ok.top, PALETTE.warn.top, tWarn);
  let bottom = lerpRgb(PALETTE.ok.bottom, PALETTE.warn.bottom, tWarn);
  let surface = lerpRgb(PALETTE.ok.surface, PALETTE.warn.surface, tWarn);
  if (over) {
    const tOver = smoothstep(94, 100, fillPercent);
    top = lerpRgb(top, PALETTE.over.top, tOver);
    bottom = lerpRgb(bottom, PALETTE.over.bottom, tOver);
    surface = lerpRgb(surface, PALETTE.over.surface, tOver);
  }
  return { top: rgbStr(top), bottom: rgbStr(bottom), surface: rgbStr(surface) };
}

/** Baut einen geschlossenen Wellen-Pfad an der Flüssigkeits-Oberfläche. */
function wavePath(surfaceY: number, amp: number, phaseDown: boolean): string {
  const segW = 18;
  const segs = 8;
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
  d += ` L ${INNER_X + 144} ${INNER_BOTTOM} L ${INNER_X} ${INNER_BOTTOM} Z`;
  return d;
}

interface BudgetTankProps {
  /** Ziel-Füllstand in Prozent (0..100). */
  fillPercent: number;
  health: BudgetHealth;
  /** Breite in px; Höhe folgt dem Seitenverhältnis 100:130. */
  size?: number;
  className?: string;
  /**
   * Beim Mounten von 0 hochfüllen und die Farbe beim Überschreiten der
   * Warnschwelle weich umblenden. Für die Detailansicht; das Raster bleibt
   * statisch.
   */
  animate?: boolean;
  /** Warnschwelle in Prozent (Default 80) – steuert den Farbumschlag. */
  warnThreshold?: number;
}

/**
 * Budget-„Tank" als animiertes SVG: Glas mit Deckel, Flüssigkeits-Verlauf,
 * lebendiger Oberflächen-Welle, Glanzlicht und Skala-Strichen. Der Füllstand
 * ist exakt datengetrieben. Mit `animate` läuft die Flüssigkeit beim Öffnen von
 * unten hoch und wechselt dabei weich die Farbe an den Schwellen.
 */
export default function BudgetTank({
  fillPercent,
  health,
  size = 120,
  className,
  animate = false,
  warnThreshold = 80,
}: BudgetTankProps) {
  const uid = useId().replace(/:/g, "");
  const reduce = useReducedMotion();
  const target = Math.max(0, Math.min(100, Number.isFinite(fillPercent) ? fillPercent : 0));

  const [displayed, setDisplayed] = useState(animate && !reduce ? 0 : target);

  // Einfüll-Animation: von 0 auf den Zielwert (easeOut), pro Mount einmal.
  useEffect(() => {
    if (!animate || reduce) {
      setDisplayed(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / FILL_ANIM_MS);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplayed(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animate, target, reduce]);

  const fill = displayed / 100;
  // Beim Animieren folgt die Farbe dem Live-Füllstand, sonst dem festen Status.
  const colors = animate
    ? colorForFill(displayed, warnThreshold, health === "over")
    : HEALTH_GRADIENT[health];

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
      data-fill={Math.round(target)}
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
      <rect x={INNER_X} y={INNER_TOP} width={INNER_W} height={INNER_H} rx="12" className="fill-muted/40" />

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
          <g style={{ animation: "budget-wave 2.6s linear infinite", willChange: "transform" }}>
            <path d={wavePath(surfaceY, 2.4, false)} fill={`url(#${gradId})`} opacity={0.55} />
          </g>
          <g style={{ animation: "budget-wave 1.7s linear infinite", willChange: "transform" }}>
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
