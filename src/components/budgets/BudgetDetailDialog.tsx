import { Pencil, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BudgetStatus } from "@/types";
import BudgetTank from "./BudgetTank";

const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const HEALTH_BADGE: Record<BudgetStatus["health"], { label: string; className: string }> = {
  ok: { label: "Im Plan", className: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400" },
  warn: { label: "Knapp", className: "border-amber-500/40 text-amber-600 dark:text-amber-400" },
  over: { label: "Überzogen", className: "border-red-500/40 text-red-600 dark:text-red-400" },
};

interface BudgetDetailDialogProps {
  status: BudgetStatus | null;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * Detailansicht eines Budgets: große Tank-Variante mit allen Kennzahlen
 * (Kategorie, Ausgaben/Limit, Prozent, Rest) und Aktionen.
 */
export default function BudgetDetailDialog({
  status,
  onOpenChange,
  onEdit,
  onDelete,
}: BudgetDetailDialogProps) {
  if (!status) return null;
  const { budget, spent, remaining, fillPercent, health } = status;
  const badge = HEALTH_BADGE[health];
  const pct = Math.round(fillPercent);

  return (
    <Dialog open={!!status} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span aria-hidden>{budget.icon || "💧"}</span>
            {budget.name}
          </DialogTitle>
          <DialogDescription>Monatsbudget · Stand für diesen Monat</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          <BudgetTank fillPercent={fillPercent} health={health} size={150} />

          <Badge variant="outline" className={cn("text-xs", badge.className)}>
            {badge.label} · {pct}%
          </Badge>

          <div className="w-full space-y-2 rounded-xl border bg-muted/20 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Ausgegeben</span>
              <span className="font-semibold tabular-nums">{eur.format(spent)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Limit</span>
              <span className="font-semibold tabular-nums">{eur.format(budget.limit)}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-2">
              <span className="text-muted-foreground">{remaining >= 0 ? "Noch offen" : "Über Budget"}</span>
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  remaining < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400",
                )}
              >
                {eur.format(Math.abs(remaining))}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
          <Button variant="outline" size="sm" onClick={onDelete} className="text-red-600 dark:text-red-400">
            <Trash2 className="mr-1.5 h-4 w-4" /> Löschen
          </Button>
          <Button size="sm" onClick={onEdit}>
            <Pencil className="mr-1.5 h-4 w-4" /> Bearbeiten
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
