import { CheckCircle2, Clock, GraduationCap, PlayCircle } from 'lucide-react';

import InteractiveCard from '@/features/shared/presentation/InteractiveCard';
import FinanceErrorState from '@/features/shared/presentation/FinanceErrorState';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/useI18n';
import { useTutorialControl } from '@/hooks/useTutorialControl';
import { useTutorialCatalog } from '../application/use-tutorial-catalog';
import type { TutorialCatalogChapter } from '@/lib/tutorial-catalog';

/**
 * Die Gesamtübersicht: **alle** Führungen, nach Bereich gruppiert, mit dem
 * Stand je Kapitel.
 *
 * Drei Entscheidungen, die hier eingebaut sind:
 *
 * 1. **Ein Klick startet, er erklärt nicht erst.** Ein Kapitel ist zwei bis
 *    elf Schritte lang; eine Zwischenseite mit Beschreibung wäre länger als
 *    das, was sie beschreibt. Der Klick startet die Führung, und die führt
 *    selbst auf ihre Fläche (`TutorialOverlay`).
 * 2. **Erledigtes bleibt startbar.** Der grüne Haken ist eine Auskunft, keine
 *    Sperre — Nachschlagen ist der häufigste Grund, eine Führung ein zweites
 *    Mal zu öffnen.
 * 3. **Wartende Kapitel stehen da, aber grau.** Ein Rahmen um einen leeren
 *    Bildschirm lehrt nichts (`docs/tutorial-sequence.md`). Sie zu verstecken
 *    wäre trotzdem falsch: Wer die Übersicht öffnet, fragt, was es gibt.
 */
export default function TutorialsOverview() {
  const { t } = useI18n();
  const { catalog, isLoading, isError, retry } = useTutorialCatalog();
  const { start, startSeries } = useTutorialControl();

  if (isError) return <FinanceErrorState variant="data" onRetry={retry} />;

  if (isLoading || !catalog) {
    return (
      <div className="space-y-3">
        <Skeleton variant="shimmer" className="h-24 w-full" />
        <Skeleton variant="shimmer" className="h-64 w-full" />
      </div>
    );
  }

  const pct = catalog.total > 0 ? Math.round((catalog.doneCount / catalog.total) * 100) : 0;

  // Reihenfolge des Lehrplans, quer über alle Bereiche — die Folge ist genau
  // das, was der Katalog ohnehin schon sortiert hat.
  const runnable = catalog.sections
    .flatMap((s) => s.chapters)
    .filter((c) => c.state !== 'waiting')
    .map((c) => c.id);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Fortschritts-Readout ohne Karten-Chrome: Es ist eine Auskunft, kein
          Ziel (AGENTS.md §9, „Karten sind Aktionen"). */}
      <div className="overflow-hidden rounded-xl bg-gradient-to-br from-brand/10 via-premium/15 to-transparent p-5 sm:p-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-sm text-muted-foreground">{t('tutorials.progressLabel')}</div>
            <div className="mt-1 text-3xl font-semibold tabular-nums">
              {catalog.doneCount}
              <span className="text-lg font-normal text-muted-foreground"> / {catalog.total}</span>
            </div>
          </div>
          <div className="text-2xl font-semibold tabular-nums text-primary">{pct}%</div>
        </div>
        <Progress value={pct} className="mt-3" aria-label={t('tutorials.progressLabel')} />

        {/* Das zusammenhängende Tutorial: alle startbaren Kapitel am Stück, in
            Lehrplan-Reihenfolge. Wartende Kapitel bleiben draußen — eine
            Führung durch einen leeren Bildschirm lehrt nichts und würde die
            Folge mittendrin entwerten. */}
        <Button
          className="mt-4"
          disabled={runnable.length === 0}
          onClick={() => startSeries(runnable)}
        >
          <PlayCircle className="mr-2 h-4 w-4" aria-hidden="true" />
          {catalog.doneCount > 0 ? t('tutorials.startSeriesAgain') : t('tutorials.startSeries')}
        </Button>
        {runnable.length === 0 && (
          <p className="pt-2 text-xs text-muted-foreground">{t('tutorials.seriesWaiting')}</p>
        )}
      </div>

      {catalog.sections.map((section) => (
        <section key={section.route} className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold">{t(section.titleKey)}</h2>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {t('tutorials.sectionProgress')
                .replace('{done}', String(section.doneCount))
                .replace('{total}', String(section.total))}
            </span>
          </div>

          <ul className="space-y-2">
            {section.chapters.map((chapter) => (
              <li key={chapter.id}>
                <ChapterRow chapter={chapter} onStart={() => start(chapter.id)} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ChapterRow({
  chapter,
  onStart,
}: {
  chapter: TutorialCatalogChapter;
  onStart: () => void;
}) {
  const { t } = useI18n();
  const waiting = chapter.state === 'waiting';
  const done = chapter.state === 'done';

  const stateLabel = done
    ? t('tutorials.stateDone')
    : waiting
      ? t('tutorials.stateWaiting')
      : t('tutorials.stateReady');

  return (
    <InteractiveCard
      onClick={onStart}
      disabled={waiting}
      indicator={waiting ? 'none' : 'arrow'}
      aria-label={`${t(chapter.titleKey)} — ${stateLabel}`}
    >
      <div className="flex items-center gap-3">
        {done ? (
          // Farbe nur als Paar und nie geraten (AGENTS.md §9): `text-positive`
          // ist das Token für den grünen Haken auf der Kartenfläche.
          <CheckCircle2 className="h-5 w-5 shrink-0 text-positive" aria-hidden="true" />
        ) : waiting ? (
          <Clock className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : (
          <GraduationCap className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
        )}

        <div className="min-w-0 flex-1">
          <div className={cn('truncate text-sm font-medium', waiting && 'text-muted-foreground')}>
            {t(chapter.titleKey)}
          </div>
          <div className="text-xs text-muted-foreground">
            {t('tutorials.steps').replace('{count}', String(chapter.stepCount))}
            {' · '}
            {stateLabel}
          </div>
        </div>
      </div>
    </InteractiveCard>
  );
}
