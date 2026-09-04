import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import CoachStatusGrid from "../shared/CoachStatusGrid";
import FoundationLadder from "../shared/FoundationLadder";
import UpcomingChargesList from "../shared/UpcomingChargesList";
import CategorySuggestionsInbox from "../shared/CategorySuggestionsInbox";
import HealthScoreCard from "../shared/HealthScoreCard";
import CoachFeedCard from "../shared/CoachFeedCard";
import FinancialLandscape from "@/features/shared/presentation/FinancialLandscape";
import MilestonesStrip from "@/features/shared/presentation/MilestonesStrip";
import { useMoneyFormat } from "@/hooks/useMoneyFormat";
import { useI18n } from "@/i18n/useI18n";
import { formatCoachDaysUntil } from "@/i18n/format";
import { cn } from "@/lib/utils";
import type { CoachViewModel } from "../../application/coach-overview-view-model";

/** Adressierbarer Detailschritt. Die Route bleibt `/coach` (ADR Regel 5). */
const DETAIL_PARAM = "lage";

/**
 * Coach in der **fokussierten** Dichte.
 *
 * Gebaut nach `docs/architecture/darstellungsdichte.md` Regel 9: ein
 * Bildschirm, höchstens drei Aussagen, keine Boxen.
 *
 * **Was die Vorgängerfassung falsch machte.** Sie hatte dieselben Inhalte wie
 * der Desktop, nur umsortiert: Karten, vier Register, Scrollen. Das ist ein
 * aufgeräumter Desktop, kein fokussierter Bildschirm — genau der Fehler, den
 * AGENTS.md §4 den häufigsten nennt.
 *
 * **Die drei Aussagen und warum genau diese:**
 *
 * 1. **Der nächste Schritt.** Wofür es diese Fläche gibt — der `coach-service`
 *    sortiert die Empfehlungen, die erste ist die Aussage.
 * 2. **Was bis zum Gehalt frei ist.** Die einzige Zahl, die eine Entscheidung
 *    von heute trägt. Ein Kontostand beantwortet nicht, was davon schon
 *    vergeben ist.
 * 3. **Die Finanzgesundheit.** Der Einstieg in alles Übrige — und der Ort, an
 *    dem der Detailschritt hängt.
 *
 * Nicht mitgezählt sind App-Leiste, Bodennavigation und der Detail-Verweis:
 * Sie sind Rahmen, nicht Inhalt.
 *
 * **Keine Boxen.** Getrennt wird über Weißraum und eine Haarlinie. Ein Rahmen
 * ordnet, was nebeneinander liegt; hier liegt nichts nebeneinander, hier
 * ordnet die Reihenfolge. Und ein Rahmen verspräche nach Prinzip 8 eine
 * Aktion, die er nicht einlöst.
 *
 * **Nichts ist amputiert** (ADR Regel 2 und 5). Statusraster, Landschaft,
 * Teilwerte, Fundament, Meilensteine, Roadmap und die weiteren Empfehlungen
 * liegen einen Schritt tiefer unter `?lage=offen` — adressierbar, unter
 * derselben Route, mit der Zurück-Taste erreichbar.
 */
export default function CoachFokussiert({ model }: { model: CoachViewModel }) {
  const { t } = useI18n();
  const money = useMoneyFormat();
  const [params, setParams] = useSearchParams();

  const detailOffen = params.get(DETAIL_PARAM) === "offen";
  const setDetail = (offen: boolean) => {
    const next = new URLSearchParams(params);
    if (offen) next.set(DETAIL_PARAM, "offen");
    else next.delete(DETAIL_PARAM);
    setParams(next, { replace: true });
  };

  const { coach, health, milestones, milestonesLoading, disposable, disposableLoading, focus, followUps, loading } = model;

  return (
    <div className="flex flex-col gap-6 py-2">
      {/* Der Seitenname steht im Inhalt, nicht in der App-Leiste: Dort blieb
          neben Menü, Suche, Schild, Glocke und Konto die Breite von zwei
          Zeichen — auf dem Gerät stand da „Today for …". Hier hat er Platz. */}
      <h1 className="text-2xl font-semibold tracking-tight">{t("coach.title")}</h1>

      {/* ── Aussage 1: der nächste Schritt ────────────────────────────── */}
      <section>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("coach.focusedNextStep")}
        </p>
        {loading ? (
          <Skeleton variant="shimmer" className="mt-2 h-24 w-full rounded-lg" />
        ) : focus ? (
          <>
            <h2 className="mt-2 text-xl font-semibold leading-snug">{focus.title}</h2>
            <p className="mt-1 text-sm leading-snug text-muted-foreground">{focus.message}</p>
            {focus.ctaTo && (
              <Link
                to={focus.ctaTo}
                className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary"
              >
                {focus.ctaLabel ?? t("coach.viewAll")}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            )}
          </>
        ) : (
          <>
            <h2 className="mt-2 text-xl font-semibold leading-snug text-positive">{t("coach.allGood")}</h2>
            <p className="mt-1 text-sm leading-snug text-muted-foreground">{t("coach.noRecommendations")}</p>
          </>
        )}
      </section>

      {/* Bleibt unsichtbar, wenn nichts offen ist — deshalb keine vierte
          Aussage, sondern eine Aufgabe, die wirklich ansteht. */}
      <CategorySuggestionsInbox />

      {/* ── Aussage 2: was bis zum Gehalt frei ist ─────────────────────── */}
      <section className="border-t border-border/60 pt-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("coach.availableUntilPayday")}
        </p>
        {disposableLoading ? (
          <Skeleton variant="shimmer" className="mt-2 h-12 w-40 rounded-lg" />
        ) : disposable ? (
          <>
            <p
              className={cn(
                "mt-1 text-4xl font-semibold tabular-nums",
                disposable.health === "over" ? "text-warning" : "text-foreground",
              )}
            >
              {money.format(disposable.disposable)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatCoachDaysUntil(disposable.daysUntilPayday, t)} ·{" "}
              {money.format(disposable.obligations)} {t("coach.fixedCostsRemaining")}
            </p>
          </>
        ) : (
          // `null` heisst „nicht bestimmbar", nicht „null Euro" — deshalb ein
          // Satz statt einer 0, die eine falsche Auskunft wäre.
          <p className="mt-1 text-sm text-muted-foreground">{t("coach.noRecurringIncomeDetected")}</p>
        )}
      </section>

      {/* ── Aussage 3: die Finanzgesundheit, und der Weg ins Detail ────── */}
      <section className="border-t border-border/60 pt-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("health.financialHealthScore")}
        </p>
        {health ? (
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {t("coach.scoreOutOf").replace("{score}", String(health.score))}
          </p>
        ) : (
          <Skeleton variant="shimmer" className="mt-2 h-8 w-32 rounded-lg" />
        )}
        <button
          type="button"
          onClick={() => setDetail(true)}
          className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary"
        >
          {t("coach.focusedMore")}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </section>

      {/* Detailschritt: alles Übrige, einen Schritt tiefer und adressierbar.
          Hier DARF gescrollt werden — Regel 9 richtet sich an die Fläche, die
          man beim Öffnen sieht, nicht an einen bewusst geöffneten Detail. */}
      <Sheet open={detailOffen} onOpenChange={setDetail}>
        <SheetContent
          side="bottom"
          className="max-h-[90dvh] overflow-y-auto pb-[max(1.5rem,env(safe-area-inset-bottom))]"
          aria-describedby={undefined}
        >
          <SheetHeader className="text-left">
            <SheetTitle>{t("coach.focusedDetailTitle")}</SheetTitle>
          </SheetHeader>

          <div className="mt-4 flex flex-col gap-6">
            {health ? <CoachStatusGrid health={health} /> : null}

            <div className="mx-auto w-full max-w-xs">
              <FinancialLandscape health={health} variant="hero-compact" />
            </div>

            {coach && health ? <HealthScoreCard health={health} /> : null}

            <UpcomingChargesList />

            <FoundationLadder />

            {milestonesLoading ? (
              <Skeleton variant="shimmer" className="h-24 w-full rounded-lg" />
            ) : milestones ? (
              <MilestonesStrip milestones={milestones} variant="compact" />
            ) : null}

            {followUps.map((card, i) => (
              <CoachFeedCard key={card.id} card={card} index={i} />
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
