/**
 * Die 3D-Fläche kann leer/tot sein, ohne dass die DATEN fehlen (WP-5.7):
 * kein WebGL-Kontext, oder der Treiber hat einen laufenden eingezogen. Vorher
 * blieb dann eine stumme Fläche stehen — beim Kontextverlust sogar mit
 * eingefrorenen, veralteten Zahlen. Hier wird benannt, was los ist, und der
 * Weg zur Listenansicht gezeigt: dieselben Daten, nur ohne 3D.
 *
 * Herausgelöst aus `CityPage.tsx` in WP 6.4.
 */

import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/useI18n';
import type { CityCanvasUnavailableReason } from './CityCanvas';

export type CityUnavailableNoticeProps = {
  reason: CityCanvasUnavailableReason;
  /** Nur beim Kontextverlust angeboten — siehe unten. */
  onRebuild: () => void;
  onShowList: () => void;
};

export function CityUnavailableNotice({ reason, onRebuild, onShowList }: CityUnavailableNoticeProps) {
  const { t } = useI18n();
  const contextLost = reason === 'context-lost';

  return (
    <div
      role="alert"
      data-testid="city-canvas-unavailable-notice"
      className="absolute inset-0 z-20 flex items-center justify-center bg-background/95 p-6"
    >
      <div className="max-w-sm space-y-3 text-center">
        <h2 className="text-base font-semibold">
          {t(contextLost ? 'city.unavailable.contextLostTitle' : 'city.unavailable.unsupportedTitle')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t(contextLost ? 'city.unavailable.contextLostBody' : 'city.unavailable.unsupportedBody')}
        </p>
        <div className="flex flex-wrap justify-center gap-2 pt-1">
          {/* Neuaufbau nur beim Kontextverlust: der ist behebbar (Speicherdruck
              vergeht). Fehlt WebGL ganz, wäre der Knopf ein Versprechen, das
              das Gerät nicht halten kann. */}
          {contextLost && (
            <Button size="sm" onClick={onRebuild}>
              {t('city.unavailable.retry')}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onShowList}>
            {t('city.unavailable.toList')}
          </Button>
        </div>
      </div>
    </div>
  );
}
