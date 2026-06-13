import { useQuery } from "@tanstack/react-query";
import { Wallet, LineChart, CreditCard } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getNetWorthBreakdown } from "@/services/net-worth-service";
import FinanceEmptyState from "@/components/common/FinanceEmptyState";

const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" });

export default function NetWorthPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["net-worth"],
    queryFn: getNetWorthBreakdown,
  });

  // Leerer Zustand (Issue #39): ohne jede Position kein „0 €"-Vermögen
  // anzeigen, sondern eine konkrete nächste Aktion.
  const isEmpty =
    !isLoading && data != null && data.cash === 0 && data.investments === 0 && data.debts === 0;

  return (
    <div>
      <PageHeader
        title="Nettovermögen"
        description="Konten und Investitionen abzüglich deiner Schulden – dein wahres Vermögen."
      />

      {isEmpty ? (
        <FinanceEmptyState />
      ) : isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : data ? (
        <div className="space-y-6">
          <Card variant="premium">
            <CardContent className="p-6">
              <div className="text-sm text-muted-foreground">Nettovermögen</div>
              <div
                className={`mt-1 text-4xl font-bold ${data.netWorth >= 0 ? "text-positive" : "text-warning"}`}
              >
                {eur.format(data.netWorth)}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Liquidität + Investitionen − Schulden
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Wallet className="h-4 w-4" />
                  Liquidität
                </div>
                <div className="mt-1 text-2xl font-bold">{eur.format(data.cash)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <LineChart className="h-4 w-4" />
                  Investitionen
                </div>
                <div className="mt-1 text-2xl font-bold">{eur.format(data.investments)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CreditCard className="h-4 w-4" />
                  Schulden
                </div>
                <div className="mt-1 text-2xl font-bold">−{eur.format(data.debts)}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Datenquellen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Wallet className="h-4 w-4" />
                  Liquidität – {eur.format(data.cash)}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Summe der Salden aller Konten. Wenn ein Konto mit der Bank verbunden ist, wird der
                  zuletzt von der Bank abgerufene Saldo verwendet – auch wenn noch keine
                  Transaktionen synchronisiert wurden. Ohne Bankanbindung wird der Saldo aus der
                  Summe der lokal erfassten Transaktionen berechnet.
                </p>
                {data.accountSources.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {data.accountSources.map((acc) => (
                      <li
                        key={acc.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm"
                      >
                        <div>
                          <div className="font-medium">{acc.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {acc.source === "live"
                              ? `Live-Saldo von der Bank${acc.lastSyncAt ? ` · zuletzt aktualisiert am ${dateFormat.format(new Date(acc.lastSyncAt))}` : ""}`
                              : "Berechnet aus lokalen Transaktionen (keine Bankanbindung)"}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={acc.source === "live" ? "default" : "secondary"}>
                            {acc.source === "live" ? "Bank-Saldo" : "Lokal"}
                          </Badge>
                          <span className="font-semibold">{eur.format(acc.balance)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">Keine Konten hinterlegt.</p>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <LineChart className="h-4 w-4" />
                  Investitionen – {eur.format(data.investments)}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Summe des aktuellen Marktwerts aller Positionen je Portfolio (Stückzahl ×
                  letzter bekannter Kurs).
                </p>
                {data.portfolioSources.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {data.portfolioSources.map((p) => (
                      <li
                        key={p.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm"
                      >
                        <div>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {p.positionsCount} {p.positionsCount === 1 ? "Position" : "Positionen"}
                          </div>
                        </div>
                        <span className="font-semibold">{eur.format(p.value)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">Keine Portfolios hinterlegt.</p>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CreditCard className="h-4 w-4" />
                  Schulden – −{eur.format(data.debts)}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Summe der offenen Salden aller nicht abbezahlten Schulden.
                </p>
                {data.debtSources.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {data.debtSources.map((d) => (
                      <li
                        key={d.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm"
                      >
                        <div className="font-medium">{d.name}</div>
                        <span className="font-semibold">−{eur.format(d.balance)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">Keine offenen Schulden hinterlegt.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
