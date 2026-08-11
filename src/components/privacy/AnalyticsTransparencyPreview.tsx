import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, ServerOff, LoaderCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import FinanceErrorState from "@/features/shared/presentation/FinanceErrorState";
import { useI18n } from "@/i18n/useI18n";
import { useMoneyFormat } from "@/hooks/useMoneyFormat";
import { buildAnalyticsPackage } from "@/services/analytics-aggregation-service";

const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const GROUP_LABELS: Record<string, string> = {
  lebensmittel: "Lebensmittel",
  wohnen: "Wohnen",
  mobilitaet: "Mobilität",
  gesundheit_absicherung: "Gesundheit & Absicherung",
  freizeit: "Freizeit",
  einkommen: "Einkommen",
  sonstiges: "Sonstiges",
};

/**
 * Transparenz-Vorschau (Issue #41 / Privacy): zeigt KONKRET, was eine
 * anonymisierte, aggregierte Statistik maximal enthielte — k-anonym
 * (Gruppen < N Buchungen werden unterdrückt), ohne Rohdaten/Texte. Wird
 * ausschließlich lokal erzeugt; aktuell verlässt nichts davon das Gerät
 * (der Upload ist im analytics-aggregation-service bewusst deaktiviert).
 */
export default function AnalyticsTransparencyPreview() {
  const { t } = useI18n();
  const money = useMoneyFormat();
  const [revealed, setRevealed] = useState(false);
  // WP-9.6: Scheitert die Vorschau, bliebe sie leer — und das liest sich als
  // „es wuerde nichts gesendet". Auf einem Datenschutz-Screen ist das keine
  // fehlende Anzeige, sondern eine unbelegte Zusage.
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["analytics-preview"],
    queryFn: buildAnalyticsPackage,
    enabled: revealed,
    staleTime: 60_000,
  });

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg border border-positive/30 bg-positive/5 p-3 text-xs">
        <ServerOff className="mt-0.5 h-4 w-4 shrink-0 text-positive" aria-hidden="true" />
        <span>
          {/* Der Satz stand hier im Klartext, obwohl `analytics.noDataLeavesDevice`
              ihn in allen vier Sprachen schon enthielt — die beiden Platzhalter
              werden hervorgehoben, damit die Betonung erhalten bleibt. */}
          {t("analytics.noDataLeavesDevice")
            .split(/(\{nothing\}|\{maximal\})/)
            .map((teil, i) =>
              teil === "{nothing}" || teil === "{maximal}" ? (
                <span key={i} className="font-medium">
                  {t(teil === "{nothing}" ? "analytics.nothingLabel" : "analytics.maximalLabel")}
                </span>
              ) : (
                teil
              ),
            )}
        </span>
      </div>

      {!revealed ? (
        <Button variant="outline" size="sm" onClick={() => setRevealed(true)}>
          <Eye className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {t("analytics.showPreview")}
        </Button>
      ) : isError ? (
        <FinanceErrorState variant="data" onRetry={() => void refetch()} />
      ) : isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          {t("analytics.aggregating")}
        </div>
      ) : data ? (
        <div className="space-y-3">
          <p className="text-sm">
            <span className="font-medium">{data.records.length}</span> {t("analytics.aggregatedRecords")} ·{" "}
            <span className="font-medium">{data.suppressed_records}</span> {t("analytics.suppressed").replace("{count}", String(data.protections.minimum_local_events))}
          </p>

          <ul className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
            {[
              t("analytics.noRawData"),
              t("analytics.directIdentiersRemoved"),
              t("analytics.exactTextRemoved"),
              t("analytics.kAnonymity").replace("{count}", String(data.protections.minimum_local_events)),
            ].map((p) => (
              <li key={p} className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 shrink-0 text-positive" aria-hidden="true" />
                {p}
              </li>
            ))}
          </ul>

          {data.records.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("analytics.noGroupsWithEnoughRecords")}
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium">{t("analytics.groupColumn")}</th>
                    <th className="px-2 py-1.5 text-left font-medium">{t("analytics.monthColumn")}</th>
                    <th className="px-2 py-1.5 text-right font-medium">{t("analytics.avgPerMonthColumn")}</th>
                    <th className="px-2 py-1.5 text-right font-medium">{t("analytics.transactionsColumn")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.records.slice(0, 8).map((r, i) => (
                    <tr key={`${r.period}-${r.dimensions.category_group}-${i}`} className="border-t">
                      <td className="px-2 py-1.5">
                        {GROUP_LABELS[r.dimensions.category_group] ?? r.dimensions.category_group}
                      </td>
                      <td className="px-2 py-1.5 tabular-nums">{r.period}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {money.mask(eur.format(r.measures.expense_average))}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {r.measures.transaction_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
