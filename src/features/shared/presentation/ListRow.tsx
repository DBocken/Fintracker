import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type ValueTone = "default" | "positive" | "warning" | "muted";

interface ListRowProps {
  /** Führende Kachel: Emoji oder Icon-Node. Weglassen, um die Kachel auszublenden. */
  icon?: ReactNode;
  /** Tönt die Icon-Kachel (z. B. Kategorie-Farbe als Hex-String). */
  iconColor?: string;
  title: ReactNode;
  /** Inhalt direkt nach dem Titel (Badges, Vertrags-Icon …). */
  titleSuffix?: ReactNode;
  subtitle?: ReactNode;
  /** Rechtsbündiger Hauptwert (z. B. Betrag). */
  value?: ReactNode;
  valueTone?: ValueTone;
  /** Zusatz unter dem Wert (z. B. Uhrzeit, Fälligkeit). */
  valueHint?: ReactNode;
  /** Macht die Zeile antippbar (rendert als Button) und zeigt standardmäßig den Chevron. */
  onClick?: () => void;
  /** Chevron erzwingen/ausblenden (Default: sichtbar, wenn onClick gesetzt ist). */
  chevron?: boolean;
  /** Führendes Element vor der Icon-Kachel (z. B. Checkbox) – außerhalb des Buttons. */
  leading?: ReactNode;
  /** Nachgestelltes Element ganz rechts (z. B. Aktionsmenü) – außerhalb des Buttons. */
  trailing?: ReactNode;
  className?: string;
}

const valueToneClass: Record<ValueTone, string> = {
  default: "text-foreground",
  positive: "text-positive",
  warning: "text-warning",
  muted: "text-muted-foreground",
};

/**
 * Kompakte Listenzeile nach Vorbild der Buchungsliste: führende Icon-Kachel,
 * Titel + Untertitel, rechtsbündiger Wert, optionaler Chevron. Wiederverwendbar
 * für Konten, Verträge (mobil), Vermögensquellen usw. – damit Listen über alle
 * Screens identisch und dicht-aber-ruhig aussehen. Touch-Ziel ≥ 44px.
 */
export default function ListRow({
  icon,
  iconColor,
  title,
  titleSuffix,
  subtitle,
  value,
  valueTone = "default",
  valueHint,
  onClick,
  chevron,
  leading,
  trailing,
  className,
}: ListRowProps) {
  const interactive = !!onClick;
  const showChevron = chevron ?? interactive;

  const content = (
    <>
      {icon !== undefined && (
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-lg"
          style={iconColor ? { backgroundColor: `${iconColor}22` } : undefined}
        >
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <span className="truncate">{title}</span>
          {titleSuffix}
        </div>
        {subtitle && <div className="truncate text-xs text-muted-foreground">{subtitle}</div>}
      </div>
      {value !== undefined && (
        <div className="shrink-0 text-right">
          <div className={cn("text-sm font-semibold tabular-nums", valueToneClass[valueTone])}>{value}</div>
          {valueHint && <div className="text-xs text-muted-foreground">{valueHint}</div>}
        </div>
      )}
      {showChevron && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
    </>
  );

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {leading}
      {interactive ? (
        <button type="button" onClick={onClick} className="flex min-h-[44px] min-w-0 flex-1 items-center gap-3 text-left">
          {content}
        </button>
      ) : (
        <div className="flex min-h-[44px] min-w-0 flex-1 items-center gap-3">{content}</div>
      )}
      {trailing}
    </div>
  );
}
