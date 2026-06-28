import { useQuery } from "@tanstack/react-query";
import { ShieldAlert, ShieldCheck, TrendingUp } from "lucide-react";
import type { BudgetStatus } from "@/types";
import { resolveRolloverConfig } from "@/lib/budget-rollover";
import { projectMonthlyInvestment } from "@/lib/budget-sweep";
import { getBudgetSweepPlan } from "@/services/budget-sweep-service";
import { renderGirocodeDataUrl } from "@/services/girocode-service";
import { cn } from "@/lib/utils";

const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/** Rendert einen EPC-QR-Code (GiroCode) lokal als Bild. */
function GiroImage({ payload }: { payload: string }) {
  const { data } = useQuery({ queryKey: ["girocode", payload], queryFn: () => renderGirocodeDataUrl(payload) });
  if (!data) return null;
  return (
    <img
      src={data}
      alt="GiroCode – in der Banking-App scannen"
      className="h-40 w-40 rounded-lg bg-white p-2"
      width={160}
      height={160}
    />
  );
}

/**
 * Zeigt den „Überschuss anlegen"-Plan eines Budgets: das Prognose-Gate (wie viel
 * sicher abführbar ist) plus GiroCode fürs Tagesgeld bzw. ETF-Projektion. Rendert
 * nichts, wenn das Budget keinen Sweep konfiguriert hat oder nichts angespart ist.
 */
export default function SweepCard({ status }: { status: BudgetStatus }) {
  const action = resolveRolloverConfig(status.budget).surplusAction;
  const applicable = (action === "sweep_savings" || action === "sweep_invest") && (status.swept ?? 0) >= 1;

  const { data: plan } = useQuery({
    queryKey: ["budget-sweep", status.budget.id, status.swept],
    queryFn: () => getBudgetSweepPlan(status),
    enabled: applicable,
  });

  if (!applicable || !plan) return null;
  const { gate } = plan;

  return (
    <div className="w-full space-y-3 rounded-xl bg-muted/20 p-4 text-sm">
      <div className="flex items-center gap-2 font-medium">
        {gate.safe ? (
          <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        )}
        Überschuss anlegen
      </div>

      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Angespart</span>
        <span className="font-semibold tabular-nums">{eur.format(plan.desiredAmount)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Sicher abführbar</span>
        <span
          className={cn(
            "font-semibold tabular-nums",
            gate.safe ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400",
          )}
        >
          {eur.format(gate.safeAmount)}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{gate.reason}</p>

      {plan.action === "sweep_savings" && plan.giroPayload && plan.giroDisplay && (
        <div className="flex flex-col items-center gap-2 border-t pt-3">
          <GiroImage payload={plan.giroPayload} />
          <p className="text-center text-xs text-muted-foreground">
            {eur.format(plan.giroDisplay.amount)} an <span className="font-medium">{plan.giroDisplay.name}</span>
            <br />
            Scanne den Code in deiner Banking-App. Wir lösen keine Zahlung aus.
          </p>
        </div>
      )}

      {plan.action === "sweep_savings" && !plan.giroPayload && gate.safeAmount >= 1 && (
        <p className="border-t pt-3 text-xs text-muted-foreground">
          Hinterlege ein Tagesgeld-Konto mit IBAN im Budget, dann erzeugen wir hier einen GiroCode zum Scannen.
        </p>
      )}

      {plan.action === "sweep_invest" && gate.safeAmount >= 1 && (
        <div className="space-y-1 border-t pt-3">
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <TrendingUp className="h-3.5 w-3.5 text-brand" /> ETF-Sparplan-Idee
          </div>
          <p className="text-xs text-muted-foreground">
            Aus {eur.format(gate.safeAmount)}/Monat werden in 10 Jahren bei 5 % p. a. ca.{" "}
            <span className="font-semibold text-foreground">
              {eur.format(projectMonthlyInvestment(gate.safeAmount, 10, 5))}
            </span>
            . Keine Anlageberatung – nur eine Beispielrechnung.
          </p>
        </div>
      )}
    </div>
  );
}
