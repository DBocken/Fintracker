import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useI18n } from '@/i18n/useI18n';
import { stepBodyKey, stepTitleKey } from '@/lib/tutorial-steps';
import type { TutorialRun } from '@/hooks/useTutorialRun';
import { useAnchorRect } from './useAnchorRect';

/**
 * Die fokussierte Führung: Das erklärte Element bleibt hell, der Rest tritt
 * zurück, ein Popup erklärt es (`docs/tutorial-progressive-disclosure.md`).
 *
 * Das Loch entsteht über `box-shadow` mit großem Spread statt über eine
 * SVG-Maske — dieselbe Wirkung mit einem Element und ohne eigenes
 * Koordinatensystem. Fokusfalle, Escape und Positionierung kommen von Radix
 * (`Popover`/`Sheet`), statt sie nachzubauen; eine Tour-Bibliothek wäre
 * gegen AGENTS.md §7 und hier auch gar nicht nötig.
 *
 * Plattform-Prinzip (AGENTS.md §4): dieselben Schritte, andere Präsentation —
 * auf 375 px wird aus dem Popover ein Bottom Sheet, und das Abdunkeln bleibt.
 */

/** Luft um das ausgeschnittene Loch, damit der Rahmen nicht am Inhalt klebt. */
const HOLE_PADDING = 6;

export default function TutorialOverlay({ run }: { run: TutorialRun }) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const location = useLocation();

  const step = run.step;
  const rect = useAnchorRect(step?.anchor, run.active);

  // Der Schritt spielt auf einer bestimmten Route — dorthin wird geführt,
  // statt den Nutzer raten zu lassen, wo das Erklärte steht.
  useEffect(() => {
    if (!run.active || !step?.route) return;
    if (location.pathname !== step.route) navigate(step.route);
  }, [run.active, step, location.pathname, navigate]);

  if (!run.active || !step) return null;

  const title = t(stepTitleKey(run.chapter!, step), '');
  const body = t(stepBodyKey(run.chapter!, step), '');
  const isLast = run.stepIndex >= run.stepCount - 1;

  const controls = (
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
  );

  const progress = t('tutorial.progress', 'Schritt {current} von {total}')
    .replace('{current}', String(run.stepIndex + 1))
    .replace('{total}', String(run.stepCount));

  return (
    <>
      {/* Abdunkeln mit Loch. `pointer-events-none` auf dem Loch selbst: Was
          erklärt wird, bleibt bedienbar — eine Führung, die das Gezeigte
          sperrt, kann nicht zum Mitmachen auffordern. */}
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
          // Ohne Anker wird trotzdem abgedunkelt: Der Schritt gilt dann der
          // ganzen Ansicht, nicht einem Element.
          <div className="absolute inset-0 bg-black/60" />
        )}
      </div>

      {isMobile ? (
        <Sheet open onOpenChange={(next) => !next && run.end()}>
          <SheetContent side="bottom" className="z-[60]">
            <SheetHeader>
              <SheetTitle>{title}</SheetTitle>
              <SheetDescription>{body}</SheetDescription>
            </SheetHeader>
            <p className="pt-2 text-xs text-muted-foreground">{progress}</p>
            {controls}
          </SheetContent>
        </Sheet>
      ) : (
        <Popover open onOpenChange={(next) => !next && run.end()}>
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
          <PopoverContent className="z-[60] w-80" side="bottom" align="start">
            <h3 className="font-medium">{title}</h3>
            <p className="pt-1 text-sm text-muted-foreground">{body}</p>
            <p className="pt-2 text-xs text-muted-foreground">{progress}</p>
            {controls}
          </PopoverContent>
        </Popover>
      )}
    </>
  );
}
