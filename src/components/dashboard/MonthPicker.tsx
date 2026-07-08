import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/useI18n";
import type { Locale } from "@/i18n/translations";

// Intl unterstützt kein "tlh" (Klingonisch) als Kalender-Locale — auf Englisch
// zurückfallen, statt einen Formatierungsfehler zu riskieren.
function intlLocale(locale: Locale): string {
  return locale === "de" ? "de-DE" : "en-US";
}

function monthLabel(key: string, t: (key: string, fallback?: string) => string, locale: Locale): string {
  if (!/^\d{4}-\d{2}$/.test(key)) return t("dashboard.selectMonth", "Monat wählen…");
  return new Intl.DateTimeFormat(intlLocale(locale), { month: "long", year: "numeric" }).format(
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
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const available = useMemo(() => new Set(availableMonths), [availableMonths]);

  const monthsShort = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(intlLocale(locale), { month: "short" });
    // 2024 ist beliebig gewählt (nur zur Formatierung der 12 Monatsnamen).
    return Array.from({ length: 12 }, (_, m) => fmt.format(new Date(2024, m, 1)));
  }, [locale]);

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
            {monthLabel(value, t, locale)}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="start">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              aria-label={t("dashboard.prevYear")}
              disabled={viewYear <= minYear}
              onClick={() => setViewYear((y) => y - 1)}
              className="rounded p-1 hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold tabular-nums">{viewYear}</span>
            <button
              type="button"
              aria-label={t("dashboard.nextYear")}
              disabled={viewYear >= maxYear}
              onClick={() => setViewYear((y) => y + 1)}
              className="rounded p-1 hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {monthsShort.map((m, idx) => {
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
