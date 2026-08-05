import * as React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { MOTION_DURATIONS } from "@/lib/motion-tokens";

type Indicator = "arrow" | "expand" | "none";

interface InteractiveCardProps {
  /** Interne Navigation (react-router). Rendert die ganze Karte als Link. */
  to?: string;
  /** Externer Link. Rendert die ganze Karte als <a> (neuer Tab). */
  href?: string;
  /** Aktion (Popup/Sheet/Dialog/Akkordion öffnen). Rendert die Karte als Button. */
  onClick?: (e: React.MouseEvent) => void;
  /**
   * Bei Disclosure/Akkordion: gesetzter Zustand. Steuert `aria-expanded` und
   * dreht den Indikator. Wenn gesetzt, ist der Default-Indikator "expand".
   */
  expanded?: boolean;
  /** Welcher Affordanz-Indikator rechts erscheint. Default: "expand" wenn `expanded` gesetzt ist, sonst "arrow". */
  indicator?: Indicator;
  /** Verknüpftes Panel (für Disclosure): `aria-controls`. */
  "aria-controls"?: string;
  "aria-label"?: string;
  disabled?: boolean;
  className?: string;
  /** WP-3.2: Framer Motion layoutId für Shared-Element-Transitions. */
  layoutId?: string;
  children: React.ReactNode;
}

/**
 * Klickbare Karte — das app-weite Baustein-Primitive für die „Karten sind
 * Aktionen"-Regel (Usability-Audit): Eine Fläche, die wie eine Karte aussieht
 * (Rahmen, Hintergrund, Schatten), MUSS als Ganzes anklickbar sein und entweder
 * navigieren (`to`/`href`), ein Popup/Sheet öffnen oder auf-/zuklappen
 * (`onClick` + `expanded`). Reine Anzeige-Info ohne Follow-up gehört NICHT in
 * eine Karte, sondern in `InfoGroup`/`InfoStatStrip`.
 *
 * Garantien: ganze Fläche ist ein echtes <a>/<Link>/<button> (Tastatur +
 * Screenreader nativ), sichtbarer Fokusring, Hover-Feedback, Touch-Ziel ≥ 44px,
 * Affordanz-Indikator (Chevron). Bewegung ist `prefers-reduced-motion`-konform
 * (nur `motion-safe`-Transforms; CSS-Transitions werden global neutralisiert).
 */
export default function InteractiveCard({
  to,
  href,
  onClick,
  expanded,
  indicator,
  "aria-controls": ariaControls,
  "aria-label": ariaLabel,
  disabled,
  className,
  layoutId,
  children,
}: InteractiveCardProps) {
  const which: Indicator = indicator ?? (expanded !== undefined ? "expand" : "arrow");

  const baseClass = cn(
    // Karten-Chrome identisch zu .ds-section, damit klickbare Karten wie Abschnitte wirken
    "ds-section group relative flex w-full items-center gap-3 text-left",
    "min-h-[44px] cursor-pointer transition-[background-color,box-shadow]",
    // WP-3.5: Material-Tokens für konsistente Interaktionszustände
    "hover:bg-[var(--surface-hover)] hover:shadow-[var(--shadow-key)]",
    "active:bg-[var(--surface-press)] active:shadow-[var(--shadow-contact)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:bg-[var(--surface-focus)]",
    "motion-safe:duration-[var(--motion-duration-fast)] motion-safe:ease-[var(--motion-easing-precision)]",
    disabled && "pointer-events-none cursor-default opacity-60",
    className,
  );

  const indicatorEl =
    which === "expand" ? (
      <ChevronDown
        className={cn(
          "h-5 w-5 shrink-0 text-muted-foreground motion-safe:transition-transform",
          expanded && "rotate-180",
        )}
        aria-hidden="true"
      />
    ) : which === "arrow" ? (
      <ChevronRight
        className="h-5 w-5 shrink-0 text-muted-foreground motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    ) : null;

  const inner = (
    <>
      <div className="min-w-0 flex-1">{children}</div>
      {indicatorEl}
    </>
  );

  // WP-3.2: Bei layoutId wird der Inhalt in eine motion.div mit
  // Layout-Animation gewrappt, damit Framer Motion den Übergang zur
  // Detailansicht animieren kann.
  const content = layoutId ? (
    <motion.div
      layoutId={layoutId}
      transition={{ duration: MOTION_DURATIONS.slow / 1000, ease: [0.22, 1, 0.36, 1] }}
    >
      {inner}
    </motion.div>
  ) : (
    inner
  );

  if (to && !disabled) {
    return (
      <Link to={to} aria-label={ariaLabel} className={baseClass}>
        {content}
      </Link>
    );
  }

  if (href && !disabled) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={ariaLabel}
        className={baseClass}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-expanded={expanded}
      aria-controls={ariaControls}
      className={baseClass}
    >
      {content}
    </button>
  );
}
