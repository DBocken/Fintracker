import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { Wallet, LineChart, CreditCard, HandCoins, Info, ChevronRight, Plus } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
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
import FinanceEmptyState from "@/components/common/FinanceEmptyState";
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
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
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

/** Kompakter Zusammensetzungsbalken: Anteile der Aktiva (Liquidität, Investitionen, Forderungen). */
function CompositionBar({ data }: { data: NetWorthBreakdown }) {
  const assets = data.cash + data.investments + data.receivables;
  if (assets <= 0) return null;
  const segments = [
    { key: "cash", value: data.cash, className: "bg-brand" },
    { key: "investments", value: data.investments, className: "bg-premium" },
    { key: "receivables", value: data.receivables, className: "bg-positive" },
  ].filter((s) => s.value > 0);

  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
      {segments.map((s) => (
        <div key={s.key} className={s.className} style={{ width: `${(s.value / assets) * 100}%` }} />
      ))}
    </div>
  );
}

export default function NetWorthPage() {
  const { t } = useI18n();
  const { data, isLoading } = useQuery({
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

      {isEmpty ? (
        <FinanceEmptyState />
      ) : isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : data ? (
        <div className="mx-auto max-w-2xl space-y-4">
          {/* Hauptzahl + kompakte Zusammensetzung */}
          <Card variant="premium">
            <CardContent className="space-y-3 p-5">
              <div>
                <div className="text-sm text-muted-foreground">Nettovermögen</div>
                <div className={`mt-1 text-4xl font-bold ${data.netWorth >= 0 ? "text-positive" : "text-warning"}`}>
                  {eur.format(data.netWorth)}
                </div>
              </div>
              <CompositionBar data={data} />
              <div className="text-xs text-muted-foreground">
                Liquidität + Investitionen + Forderungen − Schulden
              </div>
            </CardContent>
          </Card>

          {/* Antippbare Zeilen mit Detail-Sheets */}
          <div className="grid gap-2 sm:grid-cols-2">
            <NetWorthRow
              icon={<Wallet className="h-4 w-4" />}
              label="Liquidität"
              value={eur.format(data.cash)}
              description="Summe der Salden aller Konten."
            >
              <p className="text-muted-foreground">
                Wenn ein Konto mit der Bank verbunden ist, wird der zuletzt abgerufene Bank-Saldo verwendet –
                auch ohne synchronisierte Transaktionen. Ohne Bankanbindung wird der Saldo aus den lokal
                erfassten Transaktionen berechnet.
              </p>
              {data.accountSources.length > 0 ? (
                <ul className="space-y-2">
                  {data.accountSources.map((acc) => (
                    <SourceRow
                      key={acc.id}
                      title={acc.name}
                      subtitle={
                        acc.source === "live"
                          ? `Live-Saldo von der Bank${acc.lastSyncAt ? ` · ${dateFormat.format(new Date(acc.lastSyncAt))}` : ""}`
                          : "Berechnet aus Eröffnungssaldo + lokalen Transaktionen"
                      }
                      value={eur.format(acc.balance)}
                      badge={
                        <Badge variant={acc.source === "live" ? "default" : "secondary"}>
                          {acc.source === "live" ? "Bank-Saldo" : "Lokal"}
                        </Badge>
                      }
                    />
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">Keine Konten hinterlegt.</p>
              )}
              {hasLive && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Abweichungen zur Banking-App entstehen meist durch noch nicht abgerufene oder vorgemerkte
                    Buchungen.
                  </AlertDescription>
                </Alert>
              )}
              <Link to="/accounts" className="inline-flex items-center text-primary underline-offset-2 hover:underline">
                Konten verwalten
              </Link>
            </NetWorthRow>

            <NetWorthRow
              icon={<LineChart className="h-4 w-4" />}
              label="Investitionen"
              value={eur.format(data.investments)}
              description="Aktueller Marktwert aller Portfolio-Positionen."
            >
              <p className="text-muted-foreground">
                Summe des aktuellen Marktwerts aller Positionen je Portfolio (Stückzahl × letzter bekannter Kurs).
              </p>
              {data.portfolioSources.length > 0 ? (
                <ul className="space-y-2">
                  {data.portfolioSources.map((p) => (
                    <SourceRow
                      key={p.id}
                      title={p.name}
                      subtitle={`${p.positionsCount} ${p.positionsCount === 1 ? "Position" : "Positionen"}`}
                      value={eur.format(p.value)}
                    />
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">Keine Portfolios hinterlegt.</p>
              )}
              <Link to="/trading" className="inline-flex items-center text-primary underline-offset-2 hover:underline">
                Depot verwalten
              </Link>
            </NetWorthRow>

            <NetWorthRow
              icon={<HandCoins className="h-4 w-4" />}
              label="Forderungen"
              value={eur.format(data.receivables)}
              description="Verliehenes Geld, das dir noch zurückgezahlt wird."
            >
              <p className="text-muted-foreground">
                Geld, das du verliehen hast und das dir noch zurückgezahlt wird – zählt als Vermögen.
              </p>
              {data.receivableSources.length > 0 ? (
                <ul className="space-y-2">
                  {data.receivableSources.map((r) => (
                    <SourceRow key={r.id} title={r.name} value={eur.format(r.amount)} />
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">Keine offenen Forderungen hinterlegt.</p>
              )}
            </NetWorthRow>

            <NetWorthRow
              icon={<CreditCard className="h-4 w-4" />}
              label="Schulden"
              value={`−${eur.format(data.debts)}`}
              negative
              description="Offene Salden aller nicht abbezahlten Schulden."
            >
              <p className="text-muted-foreground">Summe der offenen Salden aller nicht abbezahlten Schulden.</p>
              {data.debtSources.length > 0 ? (
                <ul className="space-y-2">
                  {data.debtSources.map((d) => (
                    <SourceRow key={d.id} title={d.name} value={`−${eur.format(d.balance)}`} />
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">Keine offenen Schulden hinterlegt.</p>
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
