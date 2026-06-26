import { cn } from "@/lib/utils";
import type { BudgetStatus } from "@/types";
import BudgetTank from "./BudgetTank";

const STATUS_DOT: Record<BudgetStatus["health"], string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  over: "bg-red-500",
};

interface BudgetTileProps {
  status: BudgetStatus;
  onClick: () => void;
}

/**
 * Kompakte Kachel: nur Kategorie-Symbol + Tank. Klick öffnet die Detailansicht.
 * Bewusst textarm, damit viele Budgets auf eine Seite passen.
 */
export default function BudgetTile({ status, onClick }: BudgetTileProps) {
  const { budget, fillPercent, health, spent } = status;
  const pct = Math.round(fillPercent);

  return (
    <button
      type="button"
      onClick={onClick}
      title={budget.name}
      aria-label={`${budget.name}: ${pct}% ausgeschöpft, ${Math.round(spent)} von ${Math.round(budget.limit)} Euro. Details öffnen.`}
      className={cn(
        "group relative flex flex-col items-center gap-1 rounded-2xl border bg-card p-2 transition",
        "hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-md focus-visible:outline-none",
        "focus-visible:ring-2 focus-visible:ring-brand/50",
      )}
    >
      <span className="flex h-6 items-center gap-1 text-lg leading-none" aria-hidden>
        {budget.icon || "💧"}
        <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[health])} />
      </span>
      <BudgetTank fillPercent={fillPercent} health={health} size={56} />
    </button>
  );
}
