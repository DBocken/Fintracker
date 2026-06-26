import { Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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

interface BudgetCardProps {
  status: BudgetStatus;
  onEdit: () => void;
  onDelete: () => void;
}

export default function BudgetCard({ status, onEdit, onDelete }: BudgetCardProps) {
  const { budget, spent, remaining, fillPercent, health } = status;
  const badge = HEALTH_BADGE[health];

  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col items-center gap-3 p-5">
        <div className="flex w-full items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {budget.icon && <span aria-hidden>{budget.icon}</span>}
              <span className="truncate font-medium">{budget.name}</span>
            </div>
            <Badge variant="outline" className={cn("mt-1 text-[10px]", badge.className)}>
              {badge.label}
            </Badge>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} aria-label="Bearbeiten">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDelete} aria-label="Löschen">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <BudgetTank fillPercent={fillPercent} health={health} size={120} />

        <div className="w-full text-center">
          <div className="text-lg font-semibold tabular-nums">
            {eur.format(spent)}
            <span className="text-sm font-normal text-muted-foreground"> / {eur.format(budget.limit)}</span>
          </div>
          <div
            className={cn(
              "mt-0.5 text-sm tabular-nums",
              remaining < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground",
            )}
          >
            {remaining >= 0
              ? `noch ${eur.format(remaining)} übrig`
              : `${eur.format(Math.abs(remaining))} über Budget`}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
