import { CheckCircle2, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Debt } from "@/types";
import {
  DEBT_TYPE_LABELS,
  DEBT_TYPE_ICONS,
  EXISTENTIAL_PRIORITY_EXPLANATION,
} from "@/services/debt-service";

const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/**
 * Mobile-first Schuldenkarte (Audit C-P1/F): nur drei Kerninfos —
 * Restschuld, nächste sinnvolle Aktion, Fortschritt. Details (Bearbeiten,
 * Löschen, Zahlungszuordnung) leben im DebtDetailSheet, nicht inline.
 */
export function DebtCard({
  debt,
  onTogglePaid,
  onOpenDetails,
}: {
  debt: Debt;
  onTogglePaid: (d: Debt) => void;
  onOpenDetails: (d: Debt) => void;
}) {
  const original = debt.original_amount ?? 0;
  const paid = original > 0 ? Math.max(0, original - debt.balance) : 0;
  const pct = original > 0 ? Math.min(100, Math.round((paid / original) * 100)) : debt.is_paid_off ? 100 : 0;

  return (
    <div className="group relative rounded-xl border bg-card p-4 shadow-sm transition-colors transition-shadow hover:bg-muted/40 hover:shadow-md focus-within:ring-2 focus-within:ring-ring">
      {/* Ganze Karte öffnet die Details (Usability-Audit „Karten sind
          Aktionen"). Vollflächiger Button liegt hinter dem Inhalt; die
          sekundäre Aktion „Bezahlt markieren" liegt darüber. */}
      <button
        type="button"
        className="absolute inset-0 z-0 cursor-pointer rounded-xl focus-visible:outline-none"
        aria-label={`Details zu ${debt.name}`}
        onClick={() => onOpenDetails(debt)}
      />

      <div className="pointer-events-none relative">
        <div className="flex items-start gap-3">
          <span className="text-xl" aria-hidden>{DEBT_TYPE_ICONS[debt.type]}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">{debt.name}</span>
              {debt.priority === "existenzsichernd" && (
                <Badge variant="secondary" className="shrink-0 bg-brand/15 text-brand" title={EXISTENTIAL_PRIORITY_EXPLANATION}>
                  🏠
                </Badge>
              )}
              {debt.is_paid_off && <Badge className="shrink-0 bg-positive/20 text-positive">Bezahlt</Badge>}
            </div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              {DEBT_TYPE_LABELS[debt.type]} · Rate {eur.format(debt.min_payment)}
              {debt.due_day ? ` · fällig am ${debt.due_day}.` : ""}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 text-right">
            <div>
              <div className="text-lg font-bold">{eur.format(debt.balance)}</div>
              <div className="text-[11px] text-muted-foreground">Restschuld</div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden />
          </div>
        </div>

        {/* Fortschritt */}
        {original > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Getilgt</span>
              <span>{pct}%</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-positive transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Nächste sinnvolle Aktion – liegt über dem Karten-Button */}
      <div className="relative z-10 mt-3 flex items-center gap-2">
        <Button
          variant={debt.is_paid_off ? "secondary" : "outline"}
          size="sm"
          className="pointer-events-auto h-11 flex-1"
          onClick={() => onTogglePaid(debt)}
        >
          <CheckCircle2 className="mr-1.5 h-4 w-4" />
          {debt.is_paid_off ? "Rückgängig" : "Bezahlt markieren"}
        </Button>
      </div>
    </div>
  );
}
