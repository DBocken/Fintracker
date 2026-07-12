import { useI18n } from '@/i18n/useI18n';
import { AdvancedBalanceChart } from '@/components/AdvancedBalanceChart';
import { SpendingBreakdownCard, ExpensesOverTimeCard } from '@/components/dashboard/TransactionCharts';
import { AccountCards } from '@/components/accounts/AccountCards';
import { SankeyChart } from '@/components/premium-dashboard/SankeyChart';
import { cn } from '@/lib/utils';
import type { FinanceOverviewViewModel } from '../../application/finance-overview-view-model';

interface Props {
  model: FinanceOverviewViewModel;
  className?: string;
}

/**
 * Desktop: bisheriges Raster + Cashflow (ehem. Dashboard.tsx 477–503). Beide
 * Präsentationen (Desktop/Mobile) konsumieren dasselbe ViewModel — keine
 * eigenen Queries.
 */
export function DashboardDesktopView({ model, className }: Props) {
  const { t } = useI18n();

  return (
    <div className={cn('space-y-6', className)}>
      <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <AdvancedBalanceChart
            endBalanceFromAccounts={model.balances.total}
            transactions={model.transactions.all}
            isLoading={model.loading}
          />
        </div>
        <div className="xl:col-span-4">
          <SpendingBreakdownCard sunburst={model.stats.sunburst} tree={model.stats.sunburstTree} />
        </div>
        <div className="xl:col-span-7">
          <ExpensesOverTimeCard series={model.stats.series} />
        </div>
        <div className="xl:col-span-5">
          <AccountCards
            accounts={model.accounts}
            balances={model.balances.byAccount}
            totalBalance={model.balances.total}
            isLoading={model.loading}
          />
        </div>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">{t("dashboard.cashflowTitle")}</h2>
          <p className="text-xs text-muted-foreground">
            {t("dashboard.cashflowDescription")}
          </p>
        </div>
        <SankeyChart data={model.sankeyData} enableDrilldown={false} />
      </section>
    </div>
  );
}

export default DashboardDesktopView;
