import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useI18n } from '@/i18n/useI18n';
import { anchorSelector, stepBodyKey, stepTitleKey } from '../domain/tutorial-steps';
import type { TutorialRun } from '../application/useTutorialRun';
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

/** Abstand zwischen Loch und Erklärung — der Rahmen soll frei bleiben. */
const SIDE_OFFSET = 12;

/**
 * Wie oft die Führung versucht, einen verschwundenen Bereich wieder zu öffnen,
 * bevor sie aufgibt. Ohne Deckel liefe sie in eine Schleife, wenn der Klick
 * den Anker gar nicht herstellt.
 */
const MAX_REOPEN_ATTEMPTS = 3;

export default function TutorialOverlay({ run }: { run: TutorialRun }) {
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const location = useLocation();

  const step = run.step;
  const rect = useAnchorRect(step?.anchor, run.active, reduceMotion);

  // Der Schritt spielt auf einer bestimmten Route — dorthin wird geführt,
  // statt den Nutzer raten zu lassen, wo das Erklärte steht.
  useEffect(() => {
    if (!run.active || !step?.route) return;
    if (location.pathname !== step.route) navigate(step.route);
  }, [run.active, step, location.pathname, navigate]);

  // Schritte, die in einem erst zu öffnenden Bereich spielen (Detailansicht,
  // Aufteilung), öffnen ihn selbst — und zwar IMMER DANN, wenn ihr Ziel fehlt.
  //
  // Das ist der Unterschied zu „einmal beim Betreten": Schließt der Nutzer die
  // Detailansicht mittendrin, ist der Anker weg, und die Führung lief vorher
  // stumpf weiter. Jetzt merkt sie es und macht wieder auf. Der Zähler
  // verhindert die Schleife, falls der Klick das Ziel gar nicht herstellt.
  const reopenAttempts = useRef(0);
  const attemptsFor = useRef<string | null>(null);
  useEffect(() => {
    if (!run.active || !step?.openAnchor || !step.anchor) return;
    const marker = `${run.chapter}:${step.id}`;
    if (attemptsFor.current !== marker) {
      attemptsFor.current = marker;
      reopenAttempts.current = 0;
    }
    if (rect !== null) {
      reopenAttempts.current = 0;
      return;
    }
    if (reopenAttempts.current >= MAX_REOPEN_ATTEMPTS) return;
    const el = document.querySelector<HTMLElement>(anchorSelector(step.openAnchor));
    if (!el) return;
    reopenAttempts.current += 1;
    el.click();
  }, [run.active, run.chapter, step, rect]);

  if (!run.active || !step || !run.chapter) return null;

  const title = t(stepTitleKey(run.chapter, step), '');
  const body = t(stepBodyKey(run.chapter, step), '');
  const isLast = run.stepIndex >= run.stepCount - 1;

  // Radix weicht dem Bildschirmrand aus, kennt aber das ausgeschnittene Loch
  // nicht — auf schmalen Geräten legte es sich deshalb genau über das Element,
  // von dem der Schritt spricht. Die Seite wird darum aus der Lage des Ankers
  // bestimmt: Ziel in der oberen Hälfte ⇒ Erklärung darunter, sonst darüber.
  const side: 'top' | 'bottom' =
    rect && rect.top + rect.height / 2 > window.innerHeight / 2 ? 'top' : 'bottom';

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
          side={side}
          align="start"
          avoidCollisions
          sideOffset={SIDE_OFFSET}
          collisionPadding={COLLISION_PADDING}
          // Kein Fokus-Klau auf das Popup: Das Gezeigte soll bedienbar
          // bleiben, und ein Sprung in den Erklärtext nähme dem Nutzer die
          // Stelle, auf die gerade gezeigt wird.
          onOpenAutoFocus={(e) => e.preventDefault()}
          aria-describedby={undefined}
        >
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
