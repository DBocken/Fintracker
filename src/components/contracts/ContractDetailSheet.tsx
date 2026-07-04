import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { showSuccess, showError } from "@/utils/toast";
import { useI18n } from "@/i18n/useI18n";
import {
  upsertContractDecision,
  getContractStatusLabels,
  type ContractStatus,
} from "@/services/contract-decision-service";
import type { ContractRow } from "./contract-types";

function euro(n: number) {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function getStatusActions(t: (key: string) => string): { status: ContractStatus; label: string; hint: string }[] {
  return [
    { status: "active", label: t("contracts.statusConfirmActive"), hint: t("contracts.statusConfirmActiveHint") },
    { status: "ended", label: t("contracts.statusEnded"), hint: t("contracts.statusEndedHint") },
    { status: "rejected", label: t("contracts.statusRejected"), hint: t("contracts.statusRejectedHint") },
    { status: "paused", label: t("contracts.statusPaused"), hint: t("contracts.statusPausedHint") },
    { status: "candidate", label: t("contracts.statusCandidate"), hint: t("contracts.statusCandidateHint") },
  ];
}

export function ContractDetailSheet({
  row,
  open,
  onOpenChange,
}: {
  row: ContractRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const decisionMutation = useMutation({
    mutationFn: ({ fingerprint, status }: { fingerprint: string; status: ContractStatus }) =>
      upsertContractDecision(fingerprint, {
        status,
        ended_at: status === "ended" ? new Date().toISOString().split("T")[0] : null,
      }),
    onSuccess: () => {
      showSuccess(t("contracts.statusUpdateSuccess"));
      queryClient.invalidateQueries({ queryKey: ["contract-decisions"] });
      onOpenChange(false);
    },
    onError: () => showError(t("contracts.statusUpdateError")),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        {row && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                {row.payee}
                <Badge variant="outline">{getContractStatusLabels()[row.status]}</Badge>
              </SheetTitle>
              <SheetDescription>
                {row.categoryName} · {row.cycle}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("contracts.typicalAmount")}</span>
                <span className="font-medium">{euro(row.amountTypical)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("contracts.lastAmount")}</span>
                <span className="font-medium">{euro(row.amountLast)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("contracts.firstDate")}</span>
                <span>{format(parseISO(row.firstDateISO), "dd.MM.yyyy")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("contracts.lastDate")}</span>
                <span>{format(parseISO(row.lastDateISO), "dd.MM.yyyy")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("contracts.nextDue")}</span>
                <span>{row.nextDateISO ? format(parseISO(row.nextDateISO), "dd.MM.yyyy") : "—"}</span>
              </div>
              {row.stale && (
                <p className="rounded-md bg-warning/15 p-2 text-xs text-warning">
                  {t("contracts.staleWarning")}
                </p>
              )}
              {!row.cycleKnown && (
                <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
                  {t("contracts.unknownCycleInfo")}
                </p>
              )}
            </div>

            <div className="mt-6 space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">{t("contracts.setStatus")}</p>
              {getStatusActions(t).map((action) => (
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
