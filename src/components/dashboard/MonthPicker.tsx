import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const MONTHS_SHORT = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

function monthLabel(key: string): string {
  if (!/^\d{4}-\d{2}$/.test(key)) return "Monat wählen…";
  return new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(
    new Date(`${key}-01T00:00:00`),
  );
}

interface MonthPickerProps {
  /** Ausgewählter Monat im Format `yyyy-MM`. */
  value: string;
  onChange: (value: string) => void;
  /** Monate mit Daten (yyyy-MM); nur diese sind wählbar. */
  availableMonths: string[];
  label?: string;
  id?: string;
}

/**
 * Kalenderähnliche Monatsauswahl (Audit P2-UX U4): ersetzt die manuellen
 * `<select>`-Dropdowns durch ein antippbares Monatsraster mit Jahresnavigation.
 * Monate ohne Buchungen sind deaktiviert.
 */
export function MonthPicker({ value, onChange, availableMonths, label, id }: MonthPickerProps) {
  const [open, setOpen] = useState(false);
  const available = useMemo(() => new Set(availableMonths), [availableMonths]);

  const years = useMemo(() => {
    const ys = new Set<number>();
    for (const m of availableMonths) ys.add(Number(m.slice(0, 4)));
    return Array.from(ys).sort((a, b) => a - b);
  }, [availableMonths]);

  const selectedYear = /^\d{4}-\d{2}$/.test(value) ? Number(value.slice(0, 4)) : years[years.length - 1] ?? new Date().getFullYear();
  const [viewYear, setViewYear] = useState<number>(selectedYear);

  const minYear = years[0] ?? viewYear;
  const maxYear = years[years.length - 1] ?? viewYear;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <span className="text-xs text-muted-foreground" id={id ? `${id}-label` : undefined}>
          {label}
        </span>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            aria-labelledby={id && label ? `${id}-label` : undefined}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            {monthLabel(value)}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="start">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              aria-label="Vorheriges Jahr"
              disabled={viewYear <= minYear}
              onClick={() => setViewYear((y) => y - 1)}
              className="rounded p-1 hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold tabular-nums">{viewYear}</span>
            <button
              type="button"
              aria-label="Nächstes Jahr"
              disabled={viewYear >= maxYear}
              onClick={() => setViewYear((y) => y + 1)}
              className="rounded p-1 hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {MONTHS_SHORT.map((m, idx) => {
              const key = `${viewYear}-${String(idx + 1).padStart(2, "0")}`;
              const isAvailable = available.has(key);
              const isSelected = key === value;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={!isAvailable}
                  aria-pressed={isSelected}
                  onClick={() => {
                    onChange(key);
                    setOpen(false);
                  }}
                  className={cn(
                    "min-h-[40px] rounded-md border text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : isAvailable
                        ? "border-transparent hover:bg-muted"
                        : "border-transparent text-muted-foreground/40",
                  )}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
