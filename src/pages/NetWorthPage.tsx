import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { Wallet, LineChart, CreditCard, HandCoins, Info, ChevronRight, Plus } from "lucide-react";
import AssetVolume from "@/components/networth/AssetVolume";
import PageHeader from "@/features/shared/presentation/PageHeader";
import StatHero from "@/features/shared/presentation/StatHero";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getNetWorthBreakdown, type NetWorthBreakdown } from "@/services/net-worth-service";
import FinanceEmptyState from "@/features/shared/presentation/FinanceEmptyState";
import FinanceErrorState from "@/features/shared/presentation/FinanceErrorState";
import { UnconvertedCurrencyNotice } from "@/features/shared/presentation/UnconvertedCurrencyNotice";
import { useI18n } from "@/i18n/useI18n";

const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" });

/**
 * Eine antippbare Vermögenszeile: zeigt Icon, Label und Betrag und öffnet ein
 * Bottom-Sheet (mobil) / Panel mit Erklärung, enthaltenen Positionen,
 * Berechnungsgrundlage und Bearbeitungsaktion. Die ganze Zeile ist Touch-Ziel
 * (≥44 px) und per Tastatur erreichbar.
 */
function NetWorthRow({
  icon,
  label,
  value,
  negative,
  description,
  children,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  negative?: boolean;
  description: string;
  children: ReactNode;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="flex min-h-[44px] w-full items-center gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            {icon}
          </span>
          <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              {label}
              <Info className="h-3.5 w-3.5 opacity-60" aria-hidden />
            </span>
            <span className={`text-lg font-bold ${negative ? "text-warning" : ""}`}>{value}</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {icon}
            {label}
          </SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3 text-sm">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

function SourceRow({ title, subtitle, value, badge }: { title: string; subtitle?: ReactNode; value: string; badge?: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
      <div className="min-w-0">
        <div className="font-medium">{title}</div>
        {subtitle ? <div className="text-xs text-muted-foreground">{subtitle}</div> : null}
      </div>
      <div className="flex items-center gap-2">
        {badge}
        <span className="font-semibold">{value}</span>
      </div>
    </li>
  );
}

/**
 * WP-6.4: Zusammensetzung der Aktiva als Volumen statt als 2,5-px-Balken.
 *
 * Der Balken zeigte Anteile korrekt, aber keine Groessenordnung — ein
 * Vermoegen aus 2.000 Euro und eines aus 200.000 Euro sahen identisch aus,
 * solange die Aufteilung dieselbe war. Jeder Posten ist jetzt ein Kreis,
 * dessen FLAECHE proportional zum Betrag ist.
 */
function CompositionVolume({ data }: { data: NetWorthBreakdown }) {
  const { t } = useI18n();
  return (
    <AssetVolume
      items={[
        {
          key: "cash",
          value: data.cash,
          label: t("netWorth.liquidity"),
          colorClass: "bg-brand",
          formattedValue: eur.format(data.cash),
        },
        {
          key: "investments",
          value: data.investments,
          label: t("netWorth.investments"),
          colorClass: "bg-premium",
          formattedValue: eur.format(data.investments),
        },
        {
          key: "receivables",
          value: data.receivables,
          label: t("netWorth.receivables"),
          colorClass: "bg-positive",
          formattedValue: eur.format(data.receivables),
        },
      ]}
    />
  );
}

export default function NetWorthPage() {
  const { t } = useI18n();
  // WP-9.6: Ohne `isError` wuerde ein Lesefehler hier als „noch keine Daten"
  // erscheinen — auf einem Vermoegens-Screen die denkbar beunruhigendste
  // Falschauskunft.
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["net-worth"],
    queryFn: getNetWorthBreakdown,
  });

  // Leerer Zustand (Issue #39): ohne jede Position kein „0 €"-Vermögen anzeigen.
  const isEmpty =
    !isLoading &&
    data != null &&
    data.cash === 0 &&
    data.investments === 0 &&
    data.debts === 0 &&
    data.receivables === 0;

  // Kontextuelle Hauptaktion: das Naheliegendste zuerst.
  const primaryAction = data
    ? data.portfolioSources.length === 0
      ? { to: "/trading", label: t("netWorth.addPortfolio") }
      : data.accountSources.length === 0
        ? { to: "/accounts", label: t("netWorth.addAccount") }
        : { to: "/accounts", label: t("netWorth.addAccount") }
    : null;

  const hasLive = data?.accountSources.some((acc) => acc.source === "live") ?? false;

  return (
    <div>
      <PageHeader
        title={t("netWorth.title")}
        description={t("netWorth.description")}
      />

      {isError ? (
        // VOR dem Leerzustand geprueft (WP-9.2).
        <FinanceErrorState onRetry={() => void refetch()} />
      ) : isEmpty ? (
        <FinanceEmptyState />
      ) : isLoading ? (
        <div className="space-y-3">
          <Skeleton variant="shimmer" className="h-32 w-full" />
          <Skeleton variant="shimmer" className="h-24 w-full" />
        </div>
      ) : data ? (
        <div className="mx-auto max-w-2xl space-y-4">
          {/* Hauptzahl + kompakte Zusammensetzung */}
          <StatHero
            label={t("netWorth.netWorth")}
            value={eur.format(data.netWorth)}
            tone={data.netWorth >= 0 ? "positive" : "warning"}
            caption={t("netWorth.composition")}
          >
            <CompositionVolume data={data} />
          </StatHero>

          {/* VE-1: Die Hauptzahl darüber ist ein Euro-Betrag. Was nicht in Euro
              notiert, steckt nicht darin — direkt darunter gesagt, nicht in
              einem Sheet versteckt. */}
          <UnconvertedCurrencyNotice
            description={t("currency.unconverted.netWorthDescription")}
            items={data.unconvertedInvestments.map((holding) => ({
              key: holding.id,
              label: holding.name,
              hint:
                holding.positionsCount === 1
                  ? t("currency.unconverted.singlePosition")
                  : t("currency.unconverted.positionsCount").replace("{count}", String(holding.positionsCount)),
              currency: holding.currency,
              value: holding.value,
            }))}
          />

          {/* Antippbare Zeilen mit Detail-Sheets */}
          <div className="grid gap-3 sm:grid-cols-2">
            <NetWorthRow
              icon={<Wallet className="h-4 w-4" />}
              label={t("netWorth.liquidity")}
              value={eur.format(data.cash)}
              description={t("netWorth.liquidityDesc")}
            >
              <p className="text-muted-foreground">
                {t("netWorth.liquidityDetailedDescription")}
              </p>
              {data.accountSources.length > 0 ? (
                <ul className="space-y-2">
                  {data.accountSources.map((acc) => (
                    <SourceRow
                      key={acc.id}
                      title={acc.name}
                      subtitle={
                        acc.source === "live"
                          ? `${t("netWorth.liveSyncAt")}${acc.lastSyncAt ? ` · ${dateFormat.format(new Date(acc.lastSyncAt))}` : ""}`
                          : t("netWorth.calculatedFrom")
                      }
                      value={eur.format(acc.balance)}
                      badge={
                        <Badge variant={acc.source === "live" ? "default" : "secondary"}>
                          {acc.source === "live" ? t("netWorth.liveBadge") : t("netWorth.localBadge")}
                        </Badge>
                      }
                    />
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">{t("netWorth.noAccounts")}</p>
              )}
              {hasLive && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    {t("netWorth.discrepancyWarning")}
                  </AlertDescription>
                </Alert>
              )}
              <Link to="/accounts" className="inline-flex items-center text-primary underline-offset-2 hover:underline">
                {t("netWorth.manageAccounts")}
              </Link>
            </NetWorthRow>

            <NetWorthRow
              icon={<LineChart className="h-4 w-4" />}
              label={t("netWorth.investments")}
              value={eur.format(data.investments)}
              description={t("netWorth.portfolioDesc")}
            >
              <p className="text-muted-foreground">
                {t("netWorth.portfolioDetailedDescription")}
              </p>
              {data.portfolioSources.length > 0 ? (
                <ul className="space-y-2">
                  {data.portfolioSources.map((p) => (
                    <SourceRow
                      key={p.id}
                      title={p.name}
                      subtitle={`${p.positionsCount} ${p.positionsCount === 1 ? t("netWorth.positions") : t("netWorth.multiPositions")}`}
                      value={eur.format(p.value)}
                    />
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">{t("netWorth.noPortfolios")}</p>
              )}
              <Link to="/trading" className="inline-flex items-center text-primary underline-offset-2 hover:underline">
                {t("netWorth.managePortfolio")}
              </Link>
            </NetWorthRow>

            <NetWorthRow
              icon={<HandCoins className="h-4 w-4" />}
              label={t("netWorth.receivables")}
              value={eur.format(data.receivables)}
              description={t("netWorth.receivablesDesc")}
            >
              <p className="text-muted-foreground">
                {t("netWorth.receivablesDetailedDescription")}
              </p>
              {data.receivableSources.length > 0 ? (
                <ul className="space-y-2">
                  {data.receivableSources.map((r) => (
                    <SourceRow key={r.id} title={r.name} value={eur.format(r.amount)} />
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">{t("netWorth.noReceivables")}</p>
              )}
            </NetWorthRow>

            <NetWorthRow
              icon={<CreditCard className="h-4 w-4" />}
              label={t("netWorth.debts")}
              value={`−${eur.format(data.debts)}`}
              negative
              description={t("netWorth.debtsDesc")}
            >
              <p className="text-muted-foreground">{t("netWorth.debtsDesc")}</p>
              {data.debtSources.length > 0 ? (
                <ul className="space-y-2">
                  {data.debtSources.map((d) => (
                    <SourceRow key={d.id} title={d.name} value={`−${eur.format(d.balance)}`} />
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">{t("netWorth.noDebts")}</p>
              )}
            </NetWorthRow>
          </div>

          {/* Kontextuelle Hauptaktion */}
          {primaryAction && (
            <Link
              to={primaryAction.to}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="h-4 w-4" />
              {primaryAction.label}
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}
