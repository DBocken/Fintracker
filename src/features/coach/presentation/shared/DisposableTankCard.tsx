import { useMemo } from "react";
import { format } from "date-fns";
import { useForecast } from "@/hooks/useForecast";
import { getNextIncomeCharge } from "@/lib/upcoming-charges";
import { computeDisposableUntilPayday } from "@/lib/disposable-budget";
import BudgetTank from "@/features/shared/presentation/BudgetTank";
import InteractiveCard from "@/features/shared/presentation/InteractiveCard";
import { LoadingSwap } from '@/features/shared/presentation/LoadingSwap';
import { InfoGroup } from "@/features/shared/presentation/InfoGroup";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, cn } from "@/lib/utils";
import { useMoneyFormat } from "@/hooks/useMoneyFormat";
import { useI18n } from "@/i18n/useI18n";
import { formatCoachDaysUntil } from "@/i18n/format";

const ISO = "yyyy-MM-dd";

/** Sichtfenster für den nächsten Geldeingang: gut zwei Monate, falls gerade erst gezahlt wurde. */
const INCOME_LOOKAHEAD_DAYS = 62;

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
  const { format: money, isMasked } = useMoneyFormat();
  const { t } = useI18n();
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

  // WP-8.2: Der Ladezustand laeuft ueber die Choreografie aus WP-7.3 statt
  // ueber einen fruehen Return — kein Skeleton unter 150 ms (das waere ein
  // Blinzeln), ein gezeigtes bleibt mindestens 300 ms stehen.
  if (isLoading) {
    return (
      <LoadingSwap
        loading
        skeleton={<Skeleton variant="shimmer" className="h-28 w-full rounded-2xl" />}
      >
        {null}
      </LoadingSwap>
    );
  }

  // Ohne erkannten regelmäßigen Eingang lässt sich „bis zum Gehalt" nicht
  // bestimmen → ruhiger Hinweis statt einer leeren Karte (Karten-Regel).
  if (!data) {
    return (
      <InfoGroup title={t('coach.availableUntilPayday')} description={t('coach.noRecurringIncomeDetected')}>
        <p className="text-sm text-muted-foreground">
          {t('coach.incomeDetectionInfo')}
        </p>
      </InfoGroup>
    );
  }

  const over = data.health === "over";

  return (
    <InteractiveCard
      to="/liquidity"
      aria-label={`${t('coach.availableUntilPayday')}: ${
        isMasked() ? t('gentleMode.hiddenValue') : formatCurrency(data.disposable)
      }. ${t('coach.openLiquidity')}.`}
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
          <div className="text-sm text-muted-foreground">{t('coach.availableUntilPayday')}</div>
          <div
            className={cn(
              "text-2xl font-semibold tabular-nums",
              over ? "text-warning" : "text-foreground",
            )}
          >
            {money(data.disposable)}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatCoachDaysUntil(data.daysUntilPayday, t)} · {money(data.obligations)} {t('coach.fixedCostsRemaining')}
          </p>
          {over && (
            <p className="mt-1 text-xs text-warning">
              {t('coach.fixedCostsNotice')}
            </p>
          )}
        </div>
      </div>
    </InteractiveCard>
  );
}
