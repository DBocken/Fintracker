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

/**
 * Adressierbarer Detailschritt. Die Route bleibt `/coach` (ADR Regel 5); der
 * Parameter heisst app-weit `detail`, sein Wert benennt den Abschnitt
 * (ADR Regel 9b). Vorher stand hier `lage=offen` — ein eigener Name je
 * Fläche, und zwölf Entwürfe hatten prompt acht verschiedene.
 */
const DETAIL_PARAM = "detail";
const DETAIL_WERT = "lage";

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
 * **Die drei Aussagen, in dieser Reihenfolge:**
 *
 * 1. **Der Kontostand.** Die grösste Zahl der Fläche und die erste. Danach
 *    wird beim Öffnen als Erstes gesucht, und jede Einordnung darunter setzt
 *    sie voraus. Der ganze Block führt zu den Buchungen — wer den Saldo
 *    antippt, will wissen, woraus er entstanden ist.
 * 2. **Was davon bis zum Gehalt frei ist.** Sie ordnet den Saldo ein: Ein
 *    Kontostand beantwortet nicht, was davon schon vergeben ist. Bewusst
 *    kleiner gesetzt — die zweite Zahl, nicht die erste.
 * 3. **Der Coach, in wenigen Zeilen.** Nur der EINE nächste Schritt und der
 *    Sprung dorthin, nicht die Begründung und nicht die Rangfolge.
 *
 * Der Finanz-Score stand hier zwischenzeitlich als dritte Aussage und ist in
 * den Detailschritt gewandert: Er ist eine Einordnung über Monate, keine
 * Entscheidung von heute — und er stand vor den beiden Zahlen, nach denen
 * wirklich gesucht wird.
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
 * liegen einen Schritt tiefer unter `?detail=lage` — adressierbar, unter
 * derselben Route, mit der Zurück-Taste erreichbar.
 */
export default function CoachFokussiert({ model }: { model: CoachViewModel }) {
  const { t } = useI18n();
  const money = useMoneyFormat();
  const [params, setParams] = useSearchParams();

  const detailOffen = params.get(DETAIL_PARAM) === DETAIL_WERT;
  const setDetail = (offen: boolean) => {
    const next = new URLSearchParams(params);
    if (offen) next.set(DETAIL_PARAM, DETAIL_WERT);
    else next.delete(DETAIL_PARAM);
    // Öffnen legt einen Verlaufseintrag an, Schliessen ersetzt ihn
    // (ADR Regel 9b). Vorher stand hier `replace: true` in BEIDEN Richtungen,
    // und der Kommentar behauptete, die Zurücktaste schliesse den
    // Detailschritt — sie tat es nicht: Ohne Verlaufseintrag springt sie auf
    // die vorige Route. Auf einem Telefon ist das der häufigste Handgriff
    // überhaupt, und er führte aus der Fläche heraus statt aus dem Sheet.
    setParams(next, { replace: !offen });
  };

  const { coach, health, milestones, milestonesLoading, accountsBalance, disposable, disposableLoading, focus, followUps, loading } = model;

  return (
    <div className="flex flex-col gap-6 py-2">
      {/* Kein eigener Seitenname mehr. Er stand hier UND abgeschnitten in der
          App-Leiste — die Bildprüfung hat beides nebeneinander belegt („H…"
          oben, „Heute für dich" hier). Seit der Dichteweiche rendert die Shell
          ihn einmal im Inhalt, oberhalb dieser Fläche. */}
      {/* ── Aussage 1: der Kontostand ─────────────────────────────────
          Zuerst, und als grösste Zahl der Fläche. Das ist es, wonach beim
          Öffnen als Erstes gesucht wird — jede Einordnung darunter setzt
          diese Zahl voraus. Der ganze Block führt zu den Buchungen: Wer den
          Saldo antippt, will wissen, woraus er entstanden ist. */}
      <section>
        <Link to="/transactions" className="-mx-1 block min-h-11 px-1">
          <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("coach.balanceLabel")}
          </span>
          {accountsBalance === null ? (
            <Skeleton variant="shimmer" className="mt-1 h-14 w-56 rounded-lg" />
          ) : (
            <span className="mt-0.5 block text-5xl font-semibold tabular-nums tracking-tight">
              {money.format(accountsBalance)}
            </span>
          )}
          <span className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
            {t("coach.balanceAction")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </span>
        </Link>
      </section>

      {/* ── Aussage 2: was davon bis zum Gehalt frei ist ────────────────
          Direkt unter dem Saldo, weil sie ihn einordnet: Ein Kontostand
          beantwortet nicht, was davon schon vergeben ist. Bewusst kleiner
          gesetzt — sie ist die zweite Zahl, nicht die erste. */}
      <section className="border-t border-border/60 pt-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("coach.availableUntilPayday")}
        </p>
        {disposableLoading ? (
          <Skeleton variant="shimmer" className="mt-2 h-9 w-40 rounded-lg" />
        ) : disposable && disposable.obligations === 0 ? (
          // Ohne offene Pflichten IST der freie Betrag der Kontostand. Die
          // Zahl ein zweites Mal zu setzen sagt nichts — die Aussage ist
          // dann, dass nichts mehr abgeht.
          <p className="mt-1 text-lg font-medium leading-snug">
            {t("coach.noFixedCostsUntilPayday")}
            <span className="mt-0.5 block text-sm font-normal text-muted-foreground">
              {formatCoachDaysUntil(disposable.daysUntilPayday, t)}
            </span>
          </p>
        ) : disposable ? (
          <>
            <p
              className={cn(
                "mt-0.5 text-3xl font-semibold tabular-nums",
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
          // Satz statt einer 0, die eine falsche Auskunft waere.
          <p className="mt-1 text-sm text-muted-foreground">{t("coach.noRecurringIncomeDetected")}</p>
        )}
      </section>

      {/* Bleibt unsichtbar, wenn nichts offen ist. */}
      <CategorySuggestionsInbox />

      {/* ── Aussage 3: der Coach, in wenigen Zeilen ─────────────────────
          Hier steht bewusst nur der EINE nächste Schritt und der Sprung
          dorthin — nicht die Begruendung, nicht die Rangfolge. Wer mehr will,
          geht einen Schritt tiefer. */}
      <section className="border-t border-border/60 pt-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("coach.focusedNextStep")}
        </p>
        {loading ? (
          <Skeleton variant="shimmer" className="mt-2 h-16 w-full rounded-lg" />
        ) : focus ? (
          <>
            <h2 className="mt-1 text-xl font-semibold leading-snug">{focus.title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1">
              {focus.ctaTo && (
                <Link
                  to={focus.ctaTo}
                  className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary"
                >
                  {focus.ctaLabel ?? t("coach.viewAll")}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              )}
              <button
                type="button"
                onClick={() => setDetail(true)}
                className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted-foreground"
              >
                {t("coach.focusedMore")}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="mt-1 text-xl font-semibold leading-snug text-positive">{t("coach.allGood")}</h2>
            <button
              type="button"
              onClick={() => setDetail(true)}
              className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted-foreground"
            >
              {t("coach.focusedMore")}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </>
        )}
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
