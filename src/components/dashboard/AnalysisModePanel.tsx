import { useMemo, useState } from "react";
import { Lock, TrendingUp, TrendingDown, CalendarRange } from "lucide-react";
import type { Category, Transaction } from "@/types";
import { computeTypicalMonth, computeTrend } from "@/lib/analysis-modes";
import { getDashboardDateRange } from "./filter-utils";
import type { DashboardRange } from "./filter-constants";
import { cn } from "@/lib/utils";

const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

type AnalysisMode = "zeitraum" | "typical" | "trend";

const MODES: { key: AnalysisMode; label: string }[] = [
  { key: "zeitraum", label: "Zeitraum" },
  { key: "typical", label: "Typischer Monat" },
  { key: "trend", label: "Tendenz" },
];

interface Props {
  /** Vollständige (nicht zeitraum-gefilterte) Buchungen für Durchschnitt/Vergleich. */
  allTransactions: Transaction[];
  categories: Category[];
  range: DashboardRange;
  customDays: number;
}

/**
 * Analysemodus (Audit P0-5): bringt die bisher nur im premium-gegateten
 * Analyse-Dashboard erreichbare Durchschnitts-/Vergleichslogik ins aktive
 * Dashboard. Getrennt von Konto-/Kategoriefiltern. „Monate vergleichen" bleibt
 * sichtbar gesperrt (Premium); Berechnung via lib/analysis-modes.
 */
export default function AnalysisModePanel({ allTransactions, categories, range, customDays }: Props) {
  const [mode, setMode] = useState<AnalysisMode>("zeitraum");

  const categoryName = useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, c.name]));
    return (id: string | null) => (id ? map.get(id) ?? "Unbekannt" : "Unkategorisiert");
  }, [categories]);

  const typical = useMemo(() => computeTypicalMonth(allTransactions), [allTransactions]);
  const trend = useMemo(() => {
    if (range === "Gesamt") return null;
    return computeTrend(allTransactions, getDashboardDateRange(range, customDays));
  }, [allTransactions, range, customDays]);

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-1 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <CalendarRange className="h-4 w-4" />
          Analysemodus
        </div>
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMode(m.key)}
            aria-pressed={mode === m.key}
            className={cn(
              "min-h-[36px] rounded-full border px-3 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              mode === m.key ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground",
            )}
          >
            {m.label}
          </button>
        ))}
        <button
          type="button"
          disabled
          title="Premium-Funktion – für Alpha-Tester freigeschaltet"
          className="inline-flex min-h-[36px] cursor-not-allowed items-center gap-1 rounded-full border border-dashed px-3 py-1 text-xs text-muted-foreground opacity-70"
        >
          <Lock className="h-3 w-3" />
          Monate vergleichen
        </button>
      </div>

      {mode === "zeitraum" && (
        <p className="mt-3 text-xs text-muted-foreground">
          Kennzahlen und Diagramme folgen dem gewählten Zeitraum-Filter. Wechsle auf „Typischer Monat" für
          gemittelte Werte oder „Tendenz" für den Vergleich mit dem Vorzeitraum.
        </p>
      )}

      {mode === "typical" && (
        <div className="mt-3">
          {typical.monthsCounted === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Monatsdaten für einen Durchschnitt.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Ø Einnahmen" value={eur.format(typical.income)} className="text-positive" />
                <Stat label="Ø Ausgaben" value={eur.format(typical.expenses)} className="text-warning" />
                <Stat label="Ø Saldo" value={eur.format(typical.net)} className={typical.net >= 0 ? "text-positive" : "text-warning"} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {typical.partial
                  ? "Nur der laufende, unvollständige Monat liegt vor – Werte sind vorläufig."
                  : `Durchschnitt über ${typical.monthsCounted} abgeschlossene ${typical.monthsCounted === 1 ? "Monat" : "Monate"} (laufender Monat ausgeschlossen).`}
              </p>
            </>
          )}
        </div>
      )}

      {mode === "trend" && (
        <div className="mt-3">
          {!trend ? (
            <p className="text-sm text-muted-foreground">
              Wähle einen konkreten Zeitraum (nicht „Gesamt"), um ihn mit dem Vorzeitraum zu vergleichen.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-2">
                {trend.expensesChangePct != null && trend.expensesChangePct > 0 ? (
                  <TrendingUp className="h-5 w-5 text-warning" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-positive" />
                )}
                <div className="text-sm">
                  Ausgaben{" "}
                  <span className="font-semibold">
                    {trend.expensesChangePct == null
                      ? eur.format(trend.current.expenses)
                      : `${trend.expensesChangePct > 0 ? "+" : ""}${trend.expensesChangePct.toFixed(0)} %`}
                  </span>{" "}
                  ggü. Vorzeitraum ({eur.format(trend.previous.expenses)} → {eur.format(trend.current.expenses)})
                </div>
              </div>
              {trend.topCauses.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {trend.topCauses.map((c) => (
                    <li key={c.categoryId ?? "none"} className="flex justify-between gap-2">
                      <span>{categoryName(c.categoryId)}</span>
                      <span className={c.delta > 0 ? "text-warning" : "text-positive"}>
                        {c.delta > 0 ? "+" : ""}
                        {eur.format(c.delta)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("text-lg font-bold", className)}>{value}</div>
    </div>
  );
}
