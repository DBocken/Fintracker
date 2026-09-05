import { useEffect, useMemo, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, XAxis } from "recharts";
import { ChartFigure } from "@/features/shared/presentation/ChartFigure";
import DetailSchritt from "@/features/shared/presentation/DetailSchritt";
import { useDetailParam } from "@/features/shared/presentation/useDetailParam";
import { SpendingSunburstChart } from "../shared/SpendingSunburstChart";
import { resolveSwipeTarget } from "@/features/shared/domain/swipe-navigation";
import { buildTransactionsHref } from "@/features/shared/domain/dashboard-filtering";
import { chartRamp } from "@/lib/chart-colors";
import { useMoneyFormat } from "@/hooks/useMoneyFormat";
import { useI18n } from "@/i18n/useI18n";
import { useSeriesSummary } from "@/hooks/useSeriesSummary";
import { cn } from "@/lib/utils";
import type { AusgabenklasseFilter } from "@/features/shared/domain/dashboard-filters";
import type { FinanceOverviewViewModel } from "../../application/finance-overview-view-model";

/**
 * Die Ansichten der Auswertungen — fünf statt der bisherigen sechs.
 *
 * **Die Landschaft ist weg, weil sie schon da war.** `CoachFokussiert` rendert
 * dieselbe `FinancialLandscape` in derselben Variante, auf derselben Dichte,
 * und `/coach` steht in der Bodennavigation. Eine sechste Registerkarte für
 * eine Ansicht, die einen Tipp entfernt bereits existiert, ist kein Feature,
 * sondern ein zweiter Weg zum selben Ort. §4 verlangt Parität — die ist
 * erfüllt, die Ansicht existiert auf dem Telefon.
 *
 * **Der Fluss bleibt**, und zwar hier: `/premium` ist stufenpflichtig, das
 * einfache Sankey ist ausdrücklich kostenlos. Ihn aus der fokussierten Dichte
 * zu streichen hiesse, dem Telefon eine kostenlose Funktion zu nehmen, die der
 * breite Bildschirm behält — genau die Amputation, die §4 verbietet. Er hat
 * stattdessen eine eigene Bauform bekommen (`FlussAnsicht`).
 */
const ANSICHTEN = [
  { key: "verlauf", labelKey: "common.storyHistory" },
  { key: "fluss", labelKey: "common.storyFlow" },
  { key: "kategorien", labelKey: "common.categoriesLabel" },
  { key: "ausgaben", labelKey: "common.storyExpenses" },
  { key: "konten", labelKey: "common.storyAccounts" },
] as const;

type Ansicht = (typeof ANSICHTEN)[number]["key"];

const istAnsicht = (wert: string | null): wert is Ansicht =>
  ANSICHTEN.some((a) => a.key === wert);

/** So viele Posten passen im Fluss auf einen Bildschirm; der Rest wird SUMMIERT, nicht abgeschnitten. */
const FLUSS_POSTEN = 6;

const DETAIL_UEBRIGE = "uebrige";

/**
 * Wohin die Einnahmen fliessen — der Fluss ohne Sankey.
 *
 * Das Sankey braucht Breite: Es setzt eine Mindestbreite und lässt waagerecht
 * scrollen, und seine Knotenbeschriftungen liegen auf 360 px übereinander. Die
 * Aussage dahinter braucht sie nicht. Sie liest sich von oben nach unten —
 * rein, wohin, was bleibt — und jeder Posten ist so breit, wie er am Einkommen
 * zehrt. Dieselbe Frage, in einer Form, die ein Telefon tragen kann.
 *
 * **Abgeschnitten wird nichts.** Was nicht auf den Bildschirm passt, wird zu
 * EINER Zeile summiert und liegt im Detailschritt vollständig vor — eine
 * gekappte Liste sähe aus wie ein Bestand (dieselbe Lehre wie bei
 * `check:transaction-limits`).
 */
function FlussAnsicht({ model }: { model: FinanceOverviewViewModel }) {
  const { t } = useI18n();
  const money = useMoneyFormat();
  const { oeffnen } = useDetailParam(DETAIL_UEBRIGE);

  const posten = useMemo(
    () => [...model.sankeyData.mainCategories].sort((a, b) => b.amount - a.amount),
    [model.sankeyData.mainCategories],
  );
  const sichtbar = posten.slice(0, FLUSS_POSTEN);
  const uebrige = posten.slice(FLUSS_POSTEN);
  const uebrigeSumme = uebrige.reduce((summe, p) => summe + p.amount, 0);

  // Beide Zahlen aus DERSELBEN Rechnung (`computeFlowTotals`), nicht aus zwei.
  // `sankeyData.totalIncome` waere hier naheliegend gewesen und ist eine
  // zweite Quelle: Sie zaehlt Einkommens-Korrekturen anders und ergaebe ein
  // „Bleibt", das dem Saldo auf der Uebersicht um ein paar Euro widerspricht.
  // Zwei Wahrheiten auf zwei Flaechen sind schlimmer als eine Nachkommastelle.
  const einnahmen = model.stats.income;
  const bleibt = model.stats.balance;
  // Bezugsgrösse der Balken sind die EINNAHMEN: Ein Balken sagt dann „so viel
  // von dem, was reinkam". Gegen den grössten Posten normiert hiesse er „so
  // viel wie der grösste" — eine andere und deutlich schwächere Aussage.
  const bezug = einnahmen > 0 ? einnahmen : posten[0]?.amount || 1;

  const zeile = (id: string, name: string, betrag: number) => (
    <Link
      key={id}
      to={buildTransactionsHref({ category: id })}
      className="flex min-h-11 flex-col justify-center gap-1 py-1"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-sm">{name}</span>
        <span className="shrink-0 text-sm font-medium tabular-nums">{money.format(betrag)}</span>
      </div>
      {/* Der Balken ist die Aussage, nicht Schmuck: Er zeigt den Anteil am
          Eingegangenen. Deshalb steht er UNTER der Zeile über die volle Breite
          und nicht als Kästchen daneben. */}
      <div className="h-1 w-full rounded-full bg-muted" aria-hidden="true">
        <div
          className="h-full rounded-full bg-brand"
          style={{ width: `${Math.min(100, (betrag / bezug) * 100)}%` }}
        />
      </div>
    </Link>
  );

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("auswertungen.fokussiert.incomeLabel")}
        </div>
        <div className="text-3xl font-semibold tabular-nums">{money.format(einnahmen)}</div>
      </div>

      <div className="flex flex-col">{sichtbar.map((p) => zeile(p.id, p.name, p.amount))}</div>

      {uebrige.length > 0 && (
        <button
          type="button"
          onClick={oeffnen}
          className="flex min-h-11 items-baseline justify-between gap-3 text-sm text-primary"
        >
          <span>
            {t("auswertungen.fokussiert.othersLabel").replace("{count}", String(uebrige.length))}
          </span>
          <span className="shrink-0 tabular-nums">{money.format(uebrigeSumme)}</span>
        </button>
      )}

      <div className="border-t border-border/60 pt-3">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("auswertungen.fokussiert.remainsLabel")}
        </div>
        <div
          className={cn(
            "text-3xl font-semibold tabular-nums",
            bleibt < 0 ? "text-warning" : "text-positive",
          )}
        >
          {money.format(bleibt)}
        </div>
      </div>

      <DetailSchritt wert={DETAIL_UEBRIGE} titel={t("auswertungen.fokussiert.othersTitle")}>
        <div className="flex flex-col">{uebrige.map((p) => zeile(p.id, p.name, p.amount))}</div>
      </DetailSchritt>
    </div>
  );
}

/**
 * Die Aufschlüsselung als Sunburst — ohne die Karte, in der sie bisher steckte.
 *
 * `SpendingBreakdownCard` bringt Kartenrahmen, Kopfzeile, Prozent-Schalter und
 * die Desktop-Legende mit; auf 360 px trägt davon allein die Grafik. Sie wird
 * hier direkt gerendert, mit derselben Farbzuordnung wie die breite Dichte,
 * damit dieselbe Kategorie nicht zweimal verschieden aussieht.
 */
function KategorienAnsicht({ model }: { model: FinanceOverviewViewModel }) {
  const navigate = useNavigate();
  const { sunburst, sunburstTree } = model.stats;

  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    const ramp = chartRamp(sunburst.inner.length);
    sunburst.inner.forEach((item, idx) => map.set(item.id, ramp[idx]));
    return map;
  }, [sunburst.inner]);

  return (
    <div className="mx-auto w-full max-w-[340px]">
      <SpendingSunburstChart
        tree={sunburstTree}
        colorMap={colorMap}
        showPercent={false}
        onNavigateKlasse={(superId: string) =>
          navigate(buildTransactionsHref({ ausgabenklasse: superId as AusgabenklasseFilter }))
        }
        onNavigateCategory={(categoryId: string) =>
          navigate(buildTransactionsHref({ category: categoryId }))
        }
      />
    </div>
  );
}

/**
 * Kopfzeile einer Zeitreihen-Ansicht: Beschriftung und die eine Zahl.
 *
 * **Ein Diagramm ohne Beschriftung ist keine Aussage, sondern eine Form.** Am
 * Geraet aufgenommen zeigte die Verlaufs-Ansicht ein blaues Dreieck und die
 * Ausgaben-Ansicht drei tuerkise Balken — ohne Achse, ohne Zahl, ohne Titel:
 * `ChartFigure` traegt seine `caption` ausschliesslich in der Tabelle fuer
 * Hilfstechnik. Regel 9a („eine Visualisierung IST eine Aussage") setzt voraus,
 * dass man sie lesen kann.
 */
function AnsichtsKopf({
  label,
  wert,
  hinweis,
}: {
  label: string;
  wert: string;
  /** Worauf sich die Zahl bezieht — ohne das ist „Ausgaben je Monat: 1.711 €" mehrdeutig. */
  hinweis?: string;
}) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold tabular-nums">{wert}</span>
        {hinweis && <span className="text-sm text-muted-foreground">{hinweis}</span>}
      </div>
    </div>
  );
}

/**
 * Gemeinsame Achsen-Eigenschaften der beiden Zeitreihen.
 *
 * `preserveStartEnd` statt aller Beschriftungen: Bei zwölf Monaten auf 360 px
 * stehen sonst zwölf Datumsangaben uebereinander, und dann ist keine mehr
 * lesbar. Anfang und Ende genuegen, um die Achse zu verankern.
 */
const ZEITACHSE = {
  dataKey: "date",
  stroke: "hsl(var(--muted-foreground))",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
  interval: "preserveStartEnd",
  minTickGap: 24,
} as const;

/**
 * Auswertungen in der fokussierten Dichte — eine Ansicht je Bildschirm.
 *
 * **Kein Rahmen, nirgends.** Die Vorgängerfassung (`DashboardMobileStory`)
 * stapelte kartenumwickelte Bausteine — allein `AdvancedBalanceChart` und
 * `SankeyChart` bringen elf `<Card>` mit —, dazu eine Registerleiste aus sechs
 * umrandeten Kacheln, einen `min-h-[60vh]`-Behälter und zwei berandete
 * Verweis-Chips auf `/coach` und `/milestones`, die beide schon in der
 * Bodennavigation stehen. Auf 360 px musste man dadurch scrollen, um EINE
 * Aussage zu sehen.
 *
 * Jetzt trägt jede Ansicht genau eine Visualisierung — Regel 9a: sie IST die
 * eine Aussage —, die Registerleiste ist eine Zeile Text ohne Kästen, und die
 * Wischgeste bleibt samt `?view=` als Adresse.
 *
 * **Blättern legt keinen Verlaufseintrag an.** Sonst braucht die Zurücktaste
 * fünf Anschläge, um aus der Fläche zu kommen. Der Detailschritt (Regel 9b)
 * legt einen an, das Blättern nicht — das ist die Unterscheidung zwischen
 * „woanders hin" und „dasselbe anders angesehen".
 */
export default function AuswertungenFokussiert({
  model,
}: {
  model: FinanceOverviewViewModel;
}) {
  const { t } = useI18n();
  const money = useMoneyFormat();
  const reiheZusammenfassen = useSeriesSummary();
  const [params, setParams] = useSearchParams();

  const angefragt = params.get("view");
  const aktuell: Ansicht = istAnsicht(angefragt) ? angefragt : "verlauf";
  const index = ANSICHTEN.findIndex((a) => a.key === aktuell);

  const setzeAnsicht = (key: Ansicht) => {
    const naechste = new URLSearchParams(params);
    naechste.set("view", key);
    // Ein offener Detailschritt gehoert zu der Ansicht, die ihn geoeffnet hat.
    naechste.delete("detail");
    setParams(naechste, { replace: true });
  };

  const start = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const beruehrung = e.touches[0];
    start.current = beruehrung ? { x: beruehrung.clientX, y: beruehrung.clientY } : null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const beginn = start.current;
    const beruehrung = e.changedTouches[0];
    start.current = null;
    if (!beginn || !beruehrung) return;
    const ziel = resolveSwipeTarget(
      index,
      beruehrung.clientX - beginn.x,
      beruehrung.clientY - beginn.y,
      ANSICHTEN.length,
    );
    if (ziel !== index) setzeAnsicht(ANSICHTEN[ziel].key);
  };

  /**
   * Am Geraet gemessen: Fuenf Beschriftungen sind auf 360 px rund 50 px zu
   * breit — „Konten" stand ausserhalb des Bildschirms und war ohne Wischen an
   * der Leiste nicht auffindbar. Zweizeilig umbrechen kostet 44 px Hoehe und
   * damit den einen Bildschirm; die Leiste laeuft deshalb waagerecht und
   * zieht den aktiven Reiter zu sich. Waagerecht ist hier kein Widerspruch
   * zu „kein Scrollen": Gemeint ist die FLAECHE, nicht jedes Bedienelement
   * darauf — und wer wischt, sieht die Leiste mitlaufen.
   */
  const aktiverReiter = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    aktiverReiter.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [aktuell]);

  /** Aufgelaufener Saldo über die Zeit — die Frage „wohin bewegt es sich". */
  const verlauf = useMemo(() => {
    let summe = 0;
    return model.stats.series.map((p) => {
      summe += p.income - p.expenses;
      return { date: p.date, saldo: summe };
    });
  }, [model.stats.series]);

  const ausgaben = useMemo(
    () => model.stats.series.map((p) => ({ date: p.date, expenses: p.expenses })),
    [model.stats.series],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Registerleiste ohne Kästen: Der aktive Eintrag ist farbig und
          unterstrichen, die übrigen sind stiller Text. Sechs umrandete Kacheln
          mit Icon waren sechs Rahmen für eine einzige Entscheidung.

          Die Leiste laeuft bis unter den Rand (`-mx-4 px-4`) statt am Rand
          abzuschneiden: Ein Wort, das halb sichtbar ist, sagt „hier geht es
          weiter"; eines, das am Rand endet, sagt „hier ist Schluss". */}
      <div
        className="-mx-4 flex items-center gap-1 overflow-x-auto px-3"
        role="tablist"
        aria-label={t("mobileDashboard.diagramView")}
      >
        {ANSICHTEN.map((a) => {
          const aktiv = a.key === aktuell;
          return (
            <button
              key={a.key}
              ref={aktiv ? aktiverReiter : undefined}
              type="button"
              role="tab"
              aria-selected={aktiv}
              onClick={() => setzeAnsicht(a.key)}
              className={cn(
                "min-h-11 shrink-0 whitespace-nowrap px-2 text-sm transition-colors",
                aktiv
                  ? "font-medium text-primary underline decoration-2 underline-offset-8"
                  : "text-muted-foreground",
              )}
            >
              {t(a.labelKey)}
            </button>
          );
        })}
      </div>

      {/* Genau eine Ansicht, und nur sie ist gemountet — Regel 6: was nicht
          gezeigt wird, rechnet auch nicht. */}
      <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} className="touch-pan-y">
        {aktuell === "verlauf" && (
          <div className="flex flex-col gap-2">
            <AnsichtsKopf
              label={t("auswertungen.fokussiert.balanceCaption")}
              wert={money.format(verlauf[verlauf.length - 1]?.saldo ?? 0)}
              hinweis={verlauf[verlauf.length - 1]?.date}
            />
            <ChartFigure
              form="zeitreihe"
              caption={t("auswertungen.fokussiert.balanceCaption")}
              summary={reiheZusammenfassen({
                title: t("auswertungen.fokussiert.balanceCaption"),
                values: verlauf.map((p) => p.saldo),
                formatValue: (v) => money.format(v),
                labelAt: (i) => verlauf[i]?.date ?? "",
              })}
              columns={[
                { key: "date", label: t("income.monthColumn"), format: (r) => String(r.date) },
                {
                  key: "saldo",
                  label: t("transactionStats.balance"),
                  numeric: true,
                  format: (r) => money.format(Number(r.saldo) || 0),
                },
              ]}
              rows={verlauf}
              rowKey={(r) => r.date}
            >
              <ResponsiveContainer width="100%" height="100%" minHeight={140}>
                <AreaChart data={verlauf} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                  <XAxis {...ZEITACHSE} />
                  <Area
                    dataKey="saldo"
                    type="monotone"
                    className="fill-brand/30 stroke-brand"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartFigure>
          </div>
        )}

        {aktuell === "fluss" && <FlussAnsicht model={model} />}

        {aktuell === "kategorien" && <KategorienAnsicht model={model} />}

        {aktuell === "ausgaben" && (
          <div className="flex flex-col gap-2">
            <AnsichtsKopf
              label={t("auswertungen.fokussiert.expensesCaption")}
              wert={money.format(ausgaben[ausgaben.length - 1]?.expenses ?? 0)}
              hinweis={ausgaben[ausgaben.length - 1]?.date}
            />
            <ChartFigure
              form="zeitreihe"
              caption={t("auswertungen.fokussiert.expensesCaption")}
              summary={reiheZusammenfassen({
                title: t("auswertungen.fokussiert.expensesCaption"),
                values: ausgaben.map((p) => p.expenses),
                formatValue: (v) => money.format(v),
                labelAt: (i) => ausgaben[i]?.date ?? "",
              })}
              columns={[
                { key: "date", label: t("income.monthColumn"), format: (r) => String(r.date) },
                {
                  key: "expenses",
                  label: t("transactionStats.expenses"),
                  numeric: true,
                  format: (r) => money.format(Number(r.expenses) || 0),
                },
              ]}
              rows={ausgaben}
              rowKey={(r) => r.date}
            >
              <ResponsiveContainer width="100%" height="100%" minHeight={140}>
                <BarChart data={ausgaben} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                  <XAxis {...ZEITACHSE} />
                  <Bar dataKey="expenses" className="fill-brand" radius={2} />
                </BarChart>
              </ResponsiveContainer>
            </ChartFigure>
          </div>
        )}

        {aktuell === "konten" && (
          <dl className="divide-y divide-border/60">
            {model.accounts.map((konto) => {
              const saldo = model.balances.byAccount[konto.id]?.amount ?? 0;
              return (
                <div key={konto.id} className="flex items-baseline justify-between gap-3 py-3">
                  <dt className="truncate text-sm">{konto.name}</dt>
                  <dd
                    className={cn(
                      "shrink-0 text-base font-medium tabular-nums",
                      saldo < 0 && "text-warning",
                    )}
                  >
                    {money.format(saldo)}
                  </dd>
                </div>
              );
            })}
          </dl>
        )}
      </div>
    </div>
  );
}
