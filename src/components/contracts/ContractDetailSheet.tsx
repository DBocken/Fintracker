import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { showSuccess, showError } from "@/utils/toast";
import {
  upsertContractDecision,
  CONTRACT_STATUS_LABELS,
  type ContractStatus,
} from "@/services/contract-decision-service";
import type { ContractRow } from "./contract-types";

function euro(n: number) {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

const STATUS_ACTIONS: { status: ContractStatus; label: string; hint: string }[] = [
  { status: "active", label: "Als Vertrag bestätigen", hint: "Fließt in die aktuellen Fixkosten ein." },
  { status: "ended", label: "Vertrag beendet", hint: "Wird aus aktuellen Summen entfernt." },
  { status: "rejected", label: "Kein Vertrag", hint: "Dauerhaft ausschließen." },
  { status: "paused", label: "Pausiert", hint: "Vorübergehend nicht zählen." },
  { status: "candidate", label: "Wieder prüfen", hint: "Erneut als Kandidat behandeln." },
];

export function ContractDetailSheet({
  row,
  open,
  onOpenChange,
}: {
  row: ContractRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const decisionMutation = useMutation({
    mutationFn: ({ fingerprint, status }: { fingerprint: string; status: ContractStatus }) =>
      upsertContractDecision(fingerprint, {
        status,
        ended_at: status === "ended" ? new Date().toISOString().split("T")[0] : null,
      }),
    onSuccess: () => {
      showSuccess("Vertragsstatus aktualisiert");
      queryClient.invalidateQueries({ queryKey: ["contract-decisions"] });
      onOpenChange(false);
    },
    onError: () => showError("Status konnte nicht gespeichert werden"),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        {row && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                {row.payee}
                <Badge variant="outline">{CONTRACT_STATUS_LABELS[row.status]}</Badge>
              </SheetTitle>
              <SheetDescription>
                {row.categoryName} · {row.cycle}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Typischer Betrag</span>
                <span className="font-medium">{euro(row.amountTypical)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Letzter Betrag</span>
                <span className="font-medium">{euro(row.amountLast)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Erste Buchung</span>
                <span>{format(parseISO(row.firstDateISO), "dd.MM.yyyy")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Letzte Buchung</span>
                <span>{format(parseISO(row.lastDateISO), "dd.MM.yyyy")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nächste Fälligkeit</span>
                <span>{row.nextDateISO ? format(parseISO(row.nextDateISO), "dd.MM.yyyy") : "—"}</span>
              </div>
              {row.stale && (
                <p className="rounded-md bg-warning/15 p-2 text-xs text-warning">
                  Letzte Buchung liegt lange zurück – evtl. bereits beendet.
                </p>
              )}
              {!row.cycleKnown && (
                <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
                  Zyklus unklar – nicht in der Jahreshochrechnung enthalten.
                </p>
              )}
            </div>

            <div className="mt-6 space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Status setzen</p>
              {STATUS_ACTIONS.map((action) => (
                <Button
                  key={action.status}
                  variant={row.status === action.status ? "default" : "outline"}
                  className="h-auto w-full flex-col items-start py-2 text-left"
                  disabled={decisionMutation.isPending}
                  onClick={() =>
                    decisionMutation.mutate({ fingerprint: row.fingerprint, status: action.status })
                  }
                >
                  <span className="font-medium">{action.label}</span>
                  <span className="text-xs font-normal text-muted-foreground">{action.hint}</span>
                </Button>
              ))}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
