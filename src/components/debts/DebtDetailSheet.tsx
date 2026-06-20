import { Pencil, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { Debt, Transaction } from "@/types";
import {
  DEBT_TYPE_LABELS,
  DEBT_TYPE_ICONS,
  type DebtTransactionAssignment,
} from "@/services/debt-service";

const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/**
 * Detailansicht einer Schuld als Bottom-Sheet (Audit C-P1/F): bündelt
 * Bearbeiten/Löschen und die Zahlungszuordnung, die vorher inline auf der
 * Hauptseite überladen hat. Die Transaktions-Zuordnung ist hier auf genau
 * diese Schuld bezogen.
 */
export function DebtDetailSheet({
  debt,
  open,
  onOpenChange,
  debitTransactions,
  assignmentByTransactionId,
  onEdit,
  onDelete,
  onToggleAssignment,
  assignBusy,
}: {
  debt: Debt | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debitTransactions: Transaction[];
  assignmentByTransactionId: Map<string, DebtTransactionAssignment>;
  onEdit: (d: Debt) => void;
  onDelete: (d: Debt) => void;
  onToggleAssignment: (debtId: string, transaction: Transaction, checked: boolean) => void;
  assignBusy: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-2xl">
        {debt && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <span aria-hidden>{DEBT_TYPE_ICONS[debt.type]}</span>
                {debt.name}
              </SheetTitle>
              <SheetDescription>
                {DEBT_TYPE_LABELS[debt.type]} · {debt.interest_rate}% · Rate {eur.format(debt.min_payment)}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/50 p-3 text-sm">
              <span className="text-muted-foreground">Aktuelle Restschuld</span>
              <span className="font-semibold">{eur.format(debt.balance)}</span>
            </div>

            <div className="mt-3 flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => onEdit(debt)}>
                <Pencil className="mr-1.5 h-4 w-4" /> Bearbeiten
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-warning hover:text-warning"
                onClick={() => onDelete(debt)}
              >
                <Trash2 className="mr-1.5 h-4 w-4" /> Löschen
              </Button>
            </div>

            <div className="mt-5">
              <div className="mb-2 text-sm font-semibold">Zahlungen dieser Schuld zuordnen</div>
              <p className="mb-2 text-xs text-muted-foreground">
                Ordne wiederkehrende Lastschriften zu — so verfolgen wir deinen Tilgungsfortschritt automatisch.
              </p>
              {debitTransactions.length === 0 ? (
                <div className="rounded-lg border p-3 text-sm text-muted-foreground">Keine Zahlungen gefunden.</div>
              ) : (
                <div className="max-h-72 space-y-2 overflow-auto rounded-lg border p-2">
                  {debitTransactions.map((transaction) => {
                    const assigned = transaction.id ? assignmentByTransactionId.get(transaction.id) : undefined;
                    const assignedHere = assigned?.debt_id === debt.id;
                    return (
                      <label
                        key={transaction.id}
                        className={`flex items-start gap-3 rounded-md p-2 text-sm ${assigned && !assignedHere ? "opacity-60" : "hover:bg-muted/50"}`}
                      >
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4"
                          checked={assignedHere}
                          disabled={(!!assigned && !assignedHere) || assignBusy}
                          onChange={(e) => onToggleAssignment(debt.id, transaction, e.target.checked)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">
                            {transaction.payee || transaction.description || transaction.original_text}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {new Date(transaction.date).toLocaleDateString("de-DE")}
                          </span>
                        </span>
                        <span className="shrink-0 font-semibold">{eur.format(Math.abs(transaction.amount))}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
