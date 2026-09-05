import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis } from "recharts";
import { ChartFigure } from "@/features/shared/presentation/ChartFigure";
import DetailSchritt from "@/features/shared/presentation/DetailSchritt";
import { useDetailParam } from "@/features/shared/presentation/useDetailParam";
import { useMoneyFormat } from "@/hooks/useMoneyFormat";
import { useI18n } from "@/i18n/useI18n";
import { buildTransactionsHref } from "@/features/shared/domain/dashboard-filtering";
import type { FinanceOverviewViewModel } from "../../application/finance-overview-view-model";

/** Benennt den Abschnitt, nicht die Fläche: `?detail=uebersicht`. */
const DETAIL_WERT = "uebersicht";

/**
 * Die Übersicht in der fokussierten Dichte.
 *
 * **Drei Aussagen, ein Bildschirm, keine Boxen** (ADR Regel 9).
 *
 * Die kompakte Fassung trug auf 360 px gemessen 3,33 Bildschirmlängen und rund
 * fünfzehn Aussagen. Was hier bewusst NICHT mehr steht, und warum:
 *
 * - **Der Kontostand.** Er ist die erste und grösste Zahl auf `/coach`. Ihn
 *   hier zu wiederholen macht ihn nicht wichtiger, sondern die Fläche
 *   beliebig — und er stand sogar ZWEIMAL da: einmal als Hero, einmal in der
 *   Kennzahlenreihe darunter.
 * - **Der Verweis auf die Finanzstadt** und **der Verweis auf den Coach.**
 *   Beide Ziele stehen in der Bodennavigation. Eine ganze Karte für einen
 *   zweiten Weg zum selben Ort sagt nichts und kostet einen halben Bildschirm.
 * - **Suchfeld und Filterknopf.** Sie standen VOR der ersten Zahl —
 *   Konfiguration vor Aussage, genau verkehrt herum (Regel 3). Gefiltert wird
 *   dort, wo die Liste ist: auf `/transactions`, wohin die erste Aussage führt.
 * - **Die sechs Diagramme.** Sie waren das Beste der Fläche und lagen unter
 *   dem Schlechtesten begraben. Sie haben jetzt eine eigene Fläche, auf der
 *   man zwischen ihnen wischt: `/auswertungen`.
 *
 * Was bleibt, ist die Frage, die diese Fläche als einzige beantwortet:
 * **Wohin ist das Geld gegangen?**
 *
 * **Jede der drei Aussagen ist zugleich der Weg zu ihrer Vertiefung** (Regel
 * 10: eine Karte ist eine Aktion — hier braucht es dafür nicht einmal eine
 * Karte). Die Summe führt zu den Buchungen, der grösste Posten zur
 * Kategorien-Ansicht, der Verlauf zur Verlaufs-Ansicht.
 */
export default function DashboardFokussiert({ model }: { model: FinanceOverviewViewModel }) {
  const { t } = useI18n();
  const money = useMoneyFormat();
  const { oeffnen } = useDetailParam(DETAIL_WERT);

  /**
   * Der grösste Posten kommt aus dem ÄUSSEREN Ring der Aufschlüsselung —
   * derselben Menge, aus der die Finanzstadt ihre Viertel baut. Eine zweite
   * Rechnung daneben hätte zwei Wahrheiten erzeugt.
   */
  const groesster = useMemo(() => {
    const posten = [...model.stats.sunburst.outer].sort((a, b) => b.value - a.value)[0];
    if (!posten || model.stats.sunburst.total <= 0) return null;
    return {
      name: posten.name,
      betrag: posten.value,
      anteil: Math.round((posten.value / model.stats.sunburst.total) * 100),
    };
  }, [model.stats.sunburst]);

  const verlauf = useMemo(
    () => model.stats.series.map((p) => ({ date: p.date, expenses: p.expenses })),
    [model.stats.series],
  );

  const buchungenHref = buildTransactionsHref(model.filters.values);

  return (
    <div className="flex flex-col gap-4">
      {/* ── Aussage 1: wofür das Geld weg ist ───────────────────────────
          Die grösste Zahl der Fläche, und der ganze Block führt zu den
          Buchungen — wer die Zahl anzweifelt, will die Liste dahinter. */}
      <section>
        <Link to={buchungenHref} className="block">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("dashboard.fokussiert.spentLabel")}
          </div>
          <div className="mt-1 text-5xl font-semibold tracking-tight tabular-nums">
            {money.format(model.stats.expenses)}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-sm text-primary">
            {t("dashboard.fokussiert.transactionsAction")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </div>
        </Link>
      </section>

      {/* ── Aussage 2: der grösste Posten ────────────────────────────────
          Getrennt durch eine Haarlinie, nicht durch einen Rahmen: Hier liegt
          nichts nebeneinander, hier ordnet die Reihenfolge. */}
      <section className="border-t border-border/60 pt-4">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("dashboard.fokussiert.biggestLabel")}
        </div>
        {groesster ? (
          <Link to="/auswertungen?view=kategorien" className="block">
            <div className="mt-1 flex items-baseline justify-between gap-3">
              <span className="truncate text-lg font-medium">{groesster.name}</span>
              <span className="shrink-0 text-3xl font-semibold tabular-nums">
                {money.format(groesster.betrag)}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("dashboard.fokussiert.biggestShare").replace("{share}", String(groesster.anteil))}
            </p>
          </Link>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            {t("dashboard.fokussiert.noExpenses")}
          </p>
        )}
      </section>

      {/* ── Aussage 3: der Verlauf ───────────────────────────────────────
          Eine Visualisierung IST die eine Aussage (Regel 9a) — deshalb steht
          keine Zahl daneben.

          `form="verdichtung"` und nicht `zeitreihe`: Auf der Übersicht soll der
          Verlauf die RICHTUNG zeigen, nicht die Zahlen; die Vollansicht liegt
          einen Tipp weiter auf /auswertungen. 3:1 statt 16:9 spart die 22 px,
          die zum einen Bildschirm fehlten.

          Der erste Versuch war ein `max-h` mit `overflow-hidden` um die ganze
          Figur — und der schnitt die Tabellen-Umschaltung darunter mit ab, also
          ausgerechnet die barrierefreie Alternative zum Diagramm (WP-6.10). Die
          Höhe gehört an die FORM, nicht an einen Deckel um alles. */}
      {verlauf.length > 1 && (
        <section className="border-t border-border/60 pt-4">
          <Link to="/auswertungen?view=verlauf" className="block">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("dashboard.fokussiert.trendLabel")}
            </div>
            <div className="mt-2">
              <ChartFigure
                form="verdichtung"
                caption={t("dashboard.fokussiert.trendLabel")}
                columns={[
                  { key: "date", label: t("income.monthColumn"), format: (r) => String(r.date) },
                  {
                    key: "expenses",
                    label: t("transactionStats.expenses"),
                    numeric: true,
                    format: (r) => money.format(Number(r.expenses) || 0),
                  },
                ]}
                rows={verlauf}
                rowKey={(r, i) => `${r.date}-${i}`}
              >
                <ResponsiveContainer width="100%" height="100%" minHeight={110}>
                  <BarChart data={verlauf} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                    <XAxis dataKey="date" hide />
                    <Bar dataKey="expenses" className="fill-brand" radius={2} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartFigure>
            </div>
          </Link>
        </section>
      )}

      {/* Der Weg nach unten — Rahmen, keine vierte Aussage. */}
      <button
        type="button"
        onClick={oeffnen}
        className="flex min-h-11 items-center gap-1.5 self-start text-sm text-primary"
      >
        {t("dashboard.fokussiert.more")}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </button>

      {/* Alles Übrige, einen Schritt tiefer und adressierbar. Hier DARF
          gescrollt werden — Regel 9 richtet sich an die Fläche, die man beim
          Öffnen sieht, nicht an einen bewusst geöffneten Detail. */}
      <DetailSchritt wert={DETAIL_WERT} titel={t("dashboard.fokussiert.detailTitle")}>
        <dl className="divide-y divide-border/60">
          {[
            { label: t("transactionStats.income"), wert: money.format(model.stats.income) },
            { label: t("transactionStats.balance"), wert: money.format(model.stats.balance) },
            {
              label: t("transactionStats.transactions"),
              wert: `${model.stats.count} ${t("transactionStats.of")} ${model.transactions.all.length}`,
            },
          ].map((zeile) => (
            <div key={zeile.label} className="flex items-baseline justify-between gap-3 py-3">
              <dt className="text-sm text-muted-foreground">{zeile.label}</dt>
              <dd className="text-base font-medium tabular-nums">{zeile.wert}</dd>
            </div>
          ))}
        </dl>

        <Link
          to="/auswertungen"
          className="flex min-h-11 items-center gap-1.5 text-sm text-primary"
        >
          {t("nav.items.auswertungen")}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </DetailSchritt>
    </div>
  );
}
