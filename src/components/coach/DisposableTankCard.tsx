import { useMemo } from "react";
import { format } from "date-fns";
import { useForecast } from "@/hooks/useForecast";
import { getNextIncomeCharge } from "@/lib/upcoming-charges";
import { computeDisposableUntilPayday } from "@/lib/disposable-budget";
import BudgetTank from "@/components/budgets/BudgetTank";
import InteractiveCard from "@/components/common/InteractiveCard";
import { InfoGroup } from "@/components/common/InfoGroup";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, cn } from "@/lib/utils";
import { useGentleMode } from "@/components/providers/GentleModeProvider";

const ISO = "yyyy-MM-dd";

/** Sichtfenster für den nächsten Geldeingang: gut zwei Monate, falls gerade erst gezahlt wurde. */
const INCOME_LOOKAHEAD_DAYS = 62;

function daysLabel(days: number): string {
  if (days <= 0) return "heute";
  if (days === 1) return "morgen";
  return `in ${days} Tagen`;
}

interface Props {
  /** Bezugszeitpunkt (Default jetzt) – injizierbar für deterministische Tests. */
  now?: Date;
}

/**
 * Feature 2 – „Wie viel bleibt bis zum nächsten Gehalt?".
 *
 * Virtueller Budget-Tank (kein gespeichertes Budget): Guthaben − Pflicht-
 * Abbuchungen bis zum nächsten Geldeingang. Klickbare Karte (Karten-Regel):
 * die ganze Fläche führt zur Liquiditäts-Detailansicht. Der Tank nutzt dasselbe
 * datengetriebene Aufbau-Bild wie die übrigen Budgets ({@link BudgetTank}).
 */
export default function DisposableTankCard({ now = new Date() }: Props) {
  const { input, isLoading } = useForecast();
  const { enabled: gentle } = useGentleMode();
  const fromISO = format(now, ISO);

  const data = useMemo(() => {
    if (!input) return null;
    const flows = input.recurringFlows ?? [];
    const nextIncome = getNextIncomeCharge(flows, { fromISO, horizonDays: INCOME_LOOKAHEAD_DAYS });
    if (!nextIncome) return null;
    const disposable = computeDisposableUntilPayday({
      accounts: input.accounts,
      recurringFlows: flows,
      fromISO,
      paydayISO: nextIncome.dateISO,
      daysUntilPayday: nextIncome.daysUntil,
    });
    return disposable;
  }, [input, fromISO]);

  if (isLoading) return <Skeleton className="h-28 w-full rounded-2xl" />;

  // Ohne erkannten regelmäßigen Eingang lässt sich „bis zum Gehalt" nicht
  // bestimmen → ruhiger Hinweis statt einer leeren Karte (Karten-Regel).
  if (!data) {
    return (
      <InfoGroup title="Verfügbar bis Gehalt" description="Noch kein regelmäßiger Geldeingang erkannt.">
        <p className="text-sm text-muted-foreground">
          Sobald wir dein Gehalt erkennen, zeigen wir hier, wie viel bis zum nächsten Eingang frei bleibt.
        </p>
      </InfoGroup>
    );
  }

  const money = (n: number) => (gentle ? "•••" : formatCurrency(n));
  const over = data.health === "over";

  return (
    <InteractiveCard
      to="/liquidity"
      aria-label={`Verfügbar bis Gehalt: ${gentle ? "verborgen" : formatCurrency(data.disposable)}. Liquidität öffnen.`}
    >
      <div className="flex items-center gap-4">
        <BudgetTank
          fillPercent={data.fillPercent}
          health={data.health}
          size={56}
          animate
          warnThreshold={data.warnThreshold}
        />
        <div className="min-w-0 flex-1">
          <div className="text-sm text-muted-foreground">Verfügbar bis Gehalt</div>
          <div
            className={cn(
              "text-2xl font-semibold tabular-nums",
              over ? "text-warning" : "text-foreground",
            )}
          >
            {money(data.disposable)}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {daysLabel(data.daysUntilPayday)} bis zum Eingang · {money(data.obligations)} fix gehen noch ab
          </p>
          {over && (
            <p className="mt-1 text-xs text-warning">
              Achtung: Die Fixkosten übersteigen dein Guthaben vor dem Gehalt.
            </p>
          )}
        </div>
      </div>
    </InteractiveCard>
  );
}
