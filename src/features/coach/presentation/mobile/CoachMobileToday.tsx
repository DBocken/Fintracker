import { useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Activity, CalendarClock, Trophy, LayoutGrid, CheckCircle2 } from "lucide-react";
import CoachFeedCard from "../shared/CoachFeedCard";
import CoachStatusGrid from "../shared/CoachStatusGrid";
import FoundationLadder from "../shared/FoundationLadder";
import DisposableTankCard from "../shared/DisposableTankCard";
import UpcomingChargesList from "../shared/UpcomingChargesList";
import CategorySuggestionsInbox from "../shared/CategorySuggestionsInbox";
import HealthScoreCard from "../shared/HealthScoreCard";
import FinancialLandscape from "@/features/shared/presentation/FinancialLandscape";
import MilestonesStrip from "@/features/shared/presentation/MilestonesStrip";
import InteractiveCard from "@/features/shared/presentation/InteractiveCard";
import { Skeleton } from "@/components/ui/skeleton";
import { resolveSwipeTarget } from "@/features/shared/domain/swipe-navigation";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useHaptics } from "@/hooks/useHaptics";
import { useMoneyFormat } from "@/hooks/useMoneyFormat";
import { useI18n } from "@/i18n/useI18n";
import { cn } from "@/lib/utils";
import type { CoachViewModel } from "../../application/coach-overview-view-model";

type CoachView = "status" | "geld" | "ziele" | "mehr";

/**
 * Reihenfolge und Symbol der Register — **ohne** Text. Eine Modul-Konstante
 * mit aufgelöstem `t()` friert die Sprache beim Import ein und ignoriert jeden
 * späteren Wechsel (AGENTS.md §6, erzwungen von `check:i18n-module-consts`).
 */
const VIEWS: { key: CoachView; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "status", icon: Activity },
  { key: "geld", icon: CalendarClock },
  { key: "ziele", icon: Trophy },
  { key: "mehr", icon: LayoutGrid },
];

/**
 * Beschriftungen mit **literalen** Keys, aufgelöst beim Rendern.
 *
 * Die naheliegende Bauform wäre ein `labelKey`-Feld in `VIEWS`, das die
 * Schleife an die Übersetzungsfunktion durchreicht — so macht es die
 * Dashboard-Story. Sie ist hier trotzdem falsch: `call-site-keys.test.ts`
 * führt eine Ratsche auf dynamisch gebaute Keys, weil ein Key aus einer
 * Variablen von keiner statischen Prüfung mehr erreicht wird — ein Tippfehler
 * rendert dann den rohen Punkt-String. Angehoben wurde die Ratsche bisher nur
 * für Keys, die **durchgereicht** werden müssen (Registereinträge, deren Text
 * erst der Aufrufer kennt); vier feste Register gehören nicht dazu. Wo ein
 * Literal geht, wird kein Fleck aufgemacht.
 *
 * Nebenbefund: Diese Ratsche liest den ROHEN Quelltext und blendet Kommentare
 * nicht aus — die erste Fassung dieses Absatzes hat sie selbst ausgelöst,
 * indem sie die verbotene Bauform zitierte. `check:i18n`,
 * `check:query-errors` und `check:external-endpoints` blenden Kommentare
 * ausdrücklich aus; hier fehlt das. Deshalb steht die Bauform oben in Worten
 * statt als Code.
 */
function useViewLabels(): Record<CoachView, string> {
  const { t } = useI18n();
  return {
    status: t("coach.mobileViewStatus"),
    geld: t("coach.mobileViewMoney"),
    ziele: t("coach.mobileViewGoals"),
    mehr: t("coach.mobileViewMore"),
  };
}

const isCoachView = (value: string | null): value is CoachView =>
  VIEWS.some((view) => view.key === value);

/**
 * Mobile Coach-Fläche („Heute").
 *
 * **Warum eine eigene Präsentation und nicht der Desktop-Baum in schmal.**
 * Die Desktop-Fassung zeigt zehn Abschnitte gleichzeitig — auf dem grossen
 * Bildschirm ist das ihr Vorteil, auf dem Telefon werden daraus zehn
 * Bildschirmlängen Scrollen ohne Rangfolge. Genau das ist der häufigste
 * Fehler nach AGENTS.md §4: Mobil als kleinerer Desktop. Hier trägt die
 * Fläche stattdessen **eine** Hauptaussage (Prinzip 3) — den priorisierten
 * nächsten Schritt — und staffelt alles Übrige in vier adressierbare
 * Ansichten (progressive Offenlegung).
 *
 * **Nichts ist amputiert** (§4 „Anpassen, nicht amputieren"): Jeder Abschnitt
 * der Desktop-Fassung hat hier seinen Ort, nur anders gestaffelt. Die
 * Ansicht steht in der URL (`?view=`), ist also verlinkbar und
 * zurück-navigierbar — eingeklappt, nicht entfernt.
 *
 * **Daumenzone.** Kopfbereich ist reines Ablesen; alles Antippbare — Register,
 * Fokuskarte samt Aktion, Punkt-Indikator — liegt unterhalb der Mitte, wo der
 * Daumen bei einhändiger Bedienung hinkommt. Die Registerleiste steht bewusst
 * NICHT ganz oben, obwohl das dem Desktop-Reflex entspräche.
 */
export default function CoachMobileToday({ model }: { model: CoachViewModel }) {
  const { t } = useI18n();
  const money = useMoneyFormat();
  const labels = useViewLabels();
  const haptic = useHaptics();
  const reduce = useReducedMotion();
  const { coach, health, milestones, milestonesLoading, focus, followUps, hasDebt, loading } = model;

  const [params, setParams] = useSearchParams();
  const requested = params.get("view");
  const current: CoachView = isCoachView(requested) ? requested : "status";
  const index = Math.max(0, VIEWS.findIndex((v) => v.key === current));

  const setView = (key: CoachView) => {
    haptic("select");
    const next = new URLSearchParams(params);
    next.set("view", key);
    // `replace`: Ein Register-Wechsel ist keine Station im Verlauf — sonst
    // führt die Zurück-Taste durch jede angesehene Ansicht statt aus der
    // Fläche heraus.
    setParams(next, { replace: true });
  };

  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    const touch = e.changedTouches[0];
    touchStart.current = null;
    if (!start || !touch) return;
    const nextIdx = resolveSwipeTarget(index, touch.clientX - start.x, touch.clientY - start.y, VIEWS.length);
    if (nextIdx !== index) setView(VIEWS[nextIdx].key);
  };

  return (
    <div className="space-y-4">
      {/* KEIN eigener Seitenkopf. Auf dem Gerät nachgesehen stand der Titel
          zweimal übereinander — einmal in der App-Leiste, einmal hier — und
          die Beschreibung darunter brach mitten im Satz ab. Zusammen rund 90
          Pixel des ersten Bildschirms für eine Information, die eine Zeile
          höher vollständig steht.

          Auch der Score ist bewusst weg, obwohl er als hochzählende Zahl
          hübsch war: Prinzip 3 verlangt EINE Hauptaussage je Ansicht, und die
          ist hier der nächste Schritt. Eine zweite Zahl daneben ist eine
          zweite Aussage — zumal das Statusraster direkt darunter ohnehin vier
          Zahlen zeigt und der Score im Register „Status" mit Teilwerten und
          Erklärung steht, also dort, wo man ihn deuten kann.

          Damit beginnt die Fläche mit dem, worum es geht. */}

      {/* Hauptaussage: der eine nächste Schritt. Alles andere ist Kontext. */}
      {loading ? (
        <Skeleton variant="shimmer" className="h-32 w-full rounded-2xl" />
      ) : focus ? (
        <CoachFeedCard card={focus} index={0} featured />
      ) : (
        <div className="flex items-start gap-3 rounded-2xl border border-positive/20 bg-positive/5 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-positive" />
          <div className="min-w-0">
            <div className="font-semibold">{t("coach.allGood")}</div>
            <p className="mt-1 text-sm text-muted-foreground">{t("coach.noRecommendations")}</p>
          </div>
        </div>
      )}

      {/* Bleibt unsichtbar, wenn nichts offen ist — deshalb keine Konkurrenz
          zur Hauptaussage, sondern eine Aufgabe, die wirklich ansteht. */}
      <CategorySuggestionsInbox />

      {/* Registerleiste: vier vollständig sichtbare Ziele, kein horizontales
          Scrollen. `min-h-[44px]` neben der optischen Grösse — die Tap-Fläche
          ist grösser als das Icon (§4, Tippziele). */}
      <div className="grid grid-cols-4 gap-1" role="tablist" aria-label={t("coach.mobileViewsLabel")}>
        {VIEWS.map((v) => {
          const Icon = v.icon;
          const active = v.key === current;
          return (
            <button
              key={v.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setView(v.key)}
              className={cn(
                "flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-lg border px-1 py-1.5 text-xs leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "border-primary bg-primary/10 text-primary" : "border-transparent text-muted-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="truncate">{labels[v.key]}</span>
            </button>
          );
        })}
      </div>

      {/* Aktive Ansicht — je eine Aussage, erst beim Anzeigen gerendert.
          `touch-pan-y`: senkrechtes Scrollen bleibt Sache des Browsers, nur
          die waagerechte Geste wertet die Fläche selbst aus. */}
      <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} className="min-h-[50vh] touch-pan-y space-y-4">
        {current === "status" && (
          <>
            {health ? <CoachStatusGrid health={health} /> : <Skeleton variant="shimmer" className="h-44 w-full rounded-2xl" />}
            <div className="mx-auto w-full max-w-xs">
              <FinancialLandscape health={health} variant="hero-compact" />
            </div>
            {coach && health ? <HealthScoreCard health={health} /> : null}
          </>
        )}

        {current === "geld" && (
          <>
            <DisposableTankCard />
            <UpcomingChargesList />
          </>
        )}

        {current === "ziele" && (
          <>
            <FoundationLadder />
            {milestonesLoading ? (
              <Skeleton variant="shimmer" className="h-24 w-full rounded-2xl" />
            ) : milestones ? (
              <MilestonesStrip milestones={milestones} variant="compact" />
            ) : null}
          </>
        )}

        {current === "mehr" && (
          <>
            <InteractiveCard to="/milestones" aria-label={t("coach.roadmapStatusAction")}>
              <div className="text-sm text-muted-foreground">{t("coach.roadmapStatus")}</div>
              <div className="mt-2 text-lg font-semibold">{coach?.stage.title}</div>
              <p className="mt-2 text-sm text-muted-foreground">{coach?.stage.description}</p>
            </InteractiveCard>

            {coach && hasDebt ? (
              <InteractiveCard to="/debts" aria-label={t("coach.debtContextAction")}>
                <div className="text-sm text-muted-foreground">{t("coach.debtContext")}</div>
                <div className="mt-2 text-lg font-semibold">
                  {money.mask(coach.debtSummary.totalDebt.toFixed(0))} {t("coach.openDebt")}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("coach.minimumPayment")}: {money.mask(coach.debtSummary.minimumMonthlyBurden.toFixed(0))} {t("coach.perMonth")}
                </p>
              </InteractiveCard>
            ) : (
              <InteractiveCard
                to="/net-worth"
                aria-label={t("coach.viewNetWorth")}
                className="border-positive/20 bg-positive/5"
              >
                <div className="text-sm text-muted-foreground">{t("coach.debtContext")}</div>
                <div className="mt-2 text-lg font-semibold">{t("coach.debtFree")}</div>
                <p className="mt-2 text-sm text-muted-foreground">{t("coach.debtFreeDescription")}</p>
              </InteractiveCard>
            )}

            {followUps.map((card, i) => (
              <CoachFeedCard key={card.id} card={card} index={i + 1} />
            ))}

            <InteractiveCard to="/dashboard" aria-label={t("coach.viewAllExpenses")}>
              <div className="text-sm text-muted-foreground">{t("coach.detailsAndCharts")}</div>
              <p className="mt-2 text-sm">{t("coach.dashboardSupport")}</p>
            </InteractiveCard>
          </>
        )}
      </div>

      {/* Punkt-Indikator: zeigt, dass es weitere Ansichten gibt — ohne ihn ist
          die Wisch-Geste unentdeckbar. */}
      <div className="flex justify-center gap-1.5" aria-hidden>
        {VIEWS.map((v, i) => (
          <span
            key={v.key}
            className={cn(
              "h-1.5 rounded-full",
              !reduce && "transition-all",
              i === index ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30",
            )}
          />
        ))}
      </div>
    </div>
  );
}
