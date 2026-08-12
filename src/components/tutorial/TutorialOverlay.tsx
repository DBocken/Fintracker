import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useI18n } from '@/i18n/useI18n';
import { anchorSelector, stepBodyKey, stepTitleKey, tutorialTitleKey } from '@/lib/tutorial-steps';
import type { TutorialRun } from '@/hooks/useTutorialRun';
import { useAnchorRect } from './useAnchorRect';

/**
 * Die fokussierte Führung: Das erklärte Element bleibt hell, der Rest tritt
 * zurück, und die Erklärung steht **daneben**
 * (`docs/tutorial-progressive-disclosure.md`).
 *
 * Drei Regeln, die den Unterschied zwischen Führung und Textkasten ausmachen:
 *
 * 1. **Neben dem Fokus, nie darüber.** Ein zentriertes Popup verdeckt genau
 *    das, wovon es spricht. Deshalb auf JEDER Bildschirmgröße ein an das Ziel
 *    gehefteter Popover — auch mobil, wo ein Bottom Sheet die untere
 *    Bildschirmhälfte und damit oft das Gezeigte selbst wegnimmt. Das ist die
 *    bewusste Ausnahme von der Bottom-Sheet-Regel (AGENTS.md §4): Dieselbe
 *    Präsentation ist hier kein Sparzwang, sondern Bedingung.
 * 2. **Zum Ziel scrollen** (`useAnchorRect`). Worauf man zeigt, muss man
 *    sehen können.
 * 3. **Feine Schritte.** Ein Schritt zeigt genau eine Sache. Öffnet ein
 *    Schritt etwas (`openAnchor`), macht die Führung das selbst — sonst
 *    hinge die Folge davon ab, ob der Nutzer im richtigen Moment das
 *    Richtige anklickt.
 */

/** Luft um das ausgeschnittene Loch, damit der Rahmen nicht am Inhalt klebt. */
const HOLE_PADDING = 6;

/** Abstand zum Bildschirmrand, den der Popover einhält. */
const COLLISION_PADDING = 12;

/**
 * Sind wir auf der Fläche des Schritts? Ein angehängtes Segment (`/transactions/42`)
 * ist noch dieselbe; ein abschließender Schrägstrich ist kein Ortswechsel.
 */
function samePath(pathname: string, route: string): boolean {
  const here = pathname.replace(/\/+$/, '') || '/';
  const there = route.replace(/\/+$/, '') || '/';
  return here === there || here.startsWith(`${there}/`);
}

export default function TutorialOverlay({ run }: { run: TutorialRun }) {
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const location = useLocation();

  const step = run.step;
  const endRun = run.end;
  const rect = useAnchorRect(step?.anchor, run.active, reduceMotion);

  // Der Schritt spielt auf einer bestimmten Route — dorthin wird geführt,
  // statt den Nutzer raten zu lassen, wo das Erklärte steht. **Einmal je
  // Schritt**: Vorher galt die Bedingung „Ort ≠ Route" dauerhaft, und damit
  // sprang jeder eigene Navigationsklick des Nutzers sofort wieder zurück.
  // Wer den Bereich verlässt, beendet die Führung — sie ist ein Angebot, kein
  // Käfig, und das Overlay lässt das Gezeigte bewusst bedienbar.
  const navigatedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!run.active || !step?.route) return;
    const marker = `${run.chapter}:${step.id}`;

    if (samePath(location.pathname, step.route)) {
      navigatedFor.current = marker;
      return;
    }
    if (navigatedFor.current === marker) {
      endRun();
      return;
    }
    navigatedFor.current = marker;
    navigate(step.route);
  }, [run.active, run.chapter, endRun, step, location.pathname, navigate]);

  useEffect(() => {
    if (!run.active) navigatedFor.current = null;
  }, [run.active]);

  // Schritte, die in einem erst zu öffnenden Bereich spielen (Detailansicht,
  // Aufteilung), öffnen ihn selbst. Genau einmal je Schritt — sonst würde ein
  // erneutes Rendern das Ziel wieder zuklappen.
  const openedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!run.active || !step?.openAnchor) return;
    const marker = `${run.chapter}:${step.id}`;
    if (openedFor.current === marker) return;
    const el = document.querySelector<HTMLElement>(anchorSelector(step.openAnchor));
    if (!el) return;
    openedFor.current = marker;
    el.click();
  }, [run.active, run.chapter, step]);

  useEffect(() => {
    if (!run.active) openedFor.current = null;
  }, [run.active]);

  if (!run.active || !step || !run.chapter) return null;

  const title = t(stepTitleKey(run.chapter, step), '');
  const body = t(stepBodyKey(run.chapter, step), '');
  // „Fertig" nur, wenn danach wirklich nichts mehr kommt. In einer Folge
  // (Gesamt-Tutorial) führt der letzte Schritt eines Kapitels ins nächste —
  // „Fertig" wäre dort schlicht gelogen.
  const isLast = run.stepIndex >= run.stepCount - 1 && run.remaining === 0;
  const chapterName = t(tutorialTitleKey(run.chapter), '');

  const progress = t('tutorial.progress', 'Schritt {current} von {total}')
    .replace('{current}', String(run.stepIndex + 1))
    .replace('{total}', String(run.stepCount));

  return (
    <>
      {/* Abdunkeln mit Loch. `pointer-events-none`: Was erklärt wird, bleibt
          bedienbar — eine Führung, die das Gezeigte sperrt, kann nicht zum
          Mitmachen auffordern. */}
      <div className="pointer-events-none fixed inset-0 z-50" aria-hidden="true">
        {rect ? (
          <div
            data-testid="tutorial-hole"
            className="absolute rounded-lg ring-2 ring-primary"
            style={{
              top: rect.top - HOLE_PADDING,
              left: rect.left - HOLE_PADDING,
              width: rect.width + HOLE_PADDING * 2,
              height: rect.height + HOLE_PADDING * 2,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
              transition: reduceMotion ? 'none' : 'top .2s, left .2s, width .2s, height .2s',
            }}
          />
        ) : (
          // Ohne Anker gilt der Schritt der ganzen Ansicht, nicht einem
          // Element — abgedunkelt wird trotzdem.
          <div className="absolute inset-0 bg-black/60" />
        )}
      </div>

      <Popover open>
        {/* Unsichtbarer Anker an der Position des Ziels: So positioniert und
            kollisionsprüft Radix gegen ein beliebiges bestehendes Element,
            das gar nicht sein Kind ist. */}
        <PopoverAnchor asChild>
          <div
            className="pointer-events-none fixed"
            style={
              rect
                ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
                : { top: '50%', left: '50%', width: 1, height: 1 }
            }
          />
        </PopoverAnchor>
        <PopoverContent
          className="z-[60] w-[min(20rem,calc(100vw-2rem))]"
          side="bottom"
          align="start"
          avoidCollisions
          collisionPadding={COLLISION_PADDING}
          // Kein Fokus-Klau auf das Popup: Das Gezeigte soll bedienbar
          // bleiben, und ein Sprung in den Erklärtext nähme dem Nutzer die
          // Stelle, auf die gerade gezeigt wird.
          onOpenAutoFocus={(e) => e.preventDefault()}
          aria-describedby={undefined}
        >
          {/* Wo man gerade ist — in einer Folge ist das die einzige Auskunft
              darüber, welches Kapitel gerade läuft. */}
          {chapterName && (
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {chapterName}
            </p>
          )}
          <h3 className="font-medium">{title}</h3>
          <p className="pt-1 text-sm text-muted-foreground">{body}</p>
          <p className="pt-2 text-xs text-muted-foreground">{progress}</p>
          <div className="flex items-center justify-between gap-3 pt-2">
            <Button variant="ghost" size="sm" onClick={run.end}>
              {t('tutorial.end', 'Führung beenden')}
            </Button>
            <div className="flex items-center gap-2">
              {run.stepIndex > 0 && (
                <Button variant="outline" size="sm" onClick={run.back}>
                  {t('tutorial.back', 'Zurück')}
                </Button>
              )}
              <Button size="sm" onClick={run.next}>
                {isLast ? t('tutorial.done', 'Fertig') : t('tutorial.next', 'Weiter')}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
