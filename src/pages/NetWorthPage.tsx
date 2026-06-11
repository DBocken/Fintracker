import { useQuery } from "@tanstack/react-query";
import { Wallet, LineChart, CreditCard } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getNetWorthBreakdown } from "@/services/net-worth-service";

const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export default function NetWorthPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["net-worth"],
    queryFn: getNetWorthBreakdown,
  });

  return (
    <div>
      <PageHeader
        title="Nettovermögen"
        description="Konten und Investitionen abzüglich deiner Schulden – dein wahres Vermögen."
      />

      {isLoading ? (
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
                className={`mt-1 text-4xl font-bold ${data.netWorth >= 0 ? "text-emerald-500" : "text-red-500"}`}
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
        </div>
      ) : null}
    </div>
  );
}
