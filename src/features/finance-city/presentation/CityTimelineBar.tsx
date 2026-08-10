/**
 * Monatsleiste der Stadt (WP-5.2, herausgelöst aus `CityPage.tsx` in WP 6.4).
 *
 * Bewusst Schritte statt eines Reglers — ein Regler suggeriert stufenlose
 * Zeit, tatsächlich sind es diskrete Monate. Nur im Ausgaben-Tab vorhanden
 * (`timeline` ist sonst leer): nur dort liefert der Forecast eine Prognose je
 * Kategorie.
 */

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/useI18n';
import type { CityTimelineCursor } from '../application/use-city-timeline-cursor';

export function CityTimelineBar({ cursor }: { cursor: CityTimelineCursor }) {
  const { t } = useI18n();

  return (
    <div className="flex shrink-0 items-center gap-1" data-testid="city-timeline">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t('city.timeline.previous')}
        disabled={!cursor.canStepBack}
        onClick={() => cursor.step(-1)}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </Button>
      <span className="min-w-[9rem] text-center text-sm tabular-nums" aria-live="polite">
        {cursor.label}
        {cursor.isForecast && (
          <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {t('city.timeline.forecastBadge')}
          </span>
        )}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t('city.timeline.next')}
        disabled={!cursor.canStepForward}
        onClick={() => cursor.step(1)}
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
