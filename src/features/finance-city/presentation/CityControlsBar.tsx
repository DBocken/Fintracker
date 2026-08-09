/**
 * Kompakte Steuerleiste der Stadt (WP-D9, herausgelöst aus `CityPage.tsx` in
 * WP 6.4): eine Ebene zurück, Ansicht zurücksetzen, Vollbild.
 * Videoplayer-Optik (kleine Rechtecke, unten rechts), liegt IM
 * Canvas-Container und bleibt damit auch im Vollbild sichtbar.
 *
 * Touch-Ziele mobil 44 px (`h-11`), auf Desktop kompakter (`md:h-9`).
 *
 * Vollbild läuft über die Fullscreen-API auf dem Canvas-Container (Labels,
 * Chip und diese Leiste liegen darin und bleiben sichtbar). Auf Plattformen
 * ohne Element-Vollbild (z. B. iPhone-Safari) erscheint der Knopf gar nicht
 * erst — ein Knopf, der nichts tun kann, ist schlimmer als keiner.
 */

import { useCallback, useEffect, useState, type RefObject } from 'react';
import { ChevronLeft, Maximize2, Minimize2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/useI18n';

const CONTROL_CLASS = 'h-11 w-11 rounded-md bg-background/80 shadow-sm backdrop-blur-sm md:h-9 md:w-9';

export type CityControlsBarProps = {
  /** Vollbild-Ziel: der Canvas-Container. */
  fullscreenTargetRef: RefObject<HTMLElement | null>;
  /** Auf Stadt-Ebene gibt es keine Ebene mehr, in die man zurück könnte. */
  canGoBack: boolean;
  onBack: () => void;
  onReset: () => void;
};

function useCityFullscreen(targetRef: RefObject<HTMLElement | null>) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const supported = typeof document !== 'undefined' && document.fullscreenEnabled === true;

  useEffect(() => {
    const handleChange = () => setIsFullscreen(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  const toggle = useCallback(() => {
    const el = targetRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void el.requestFullscreen().catch(() => {});
  }, [targetRef]);

  return { supported, isFullscreen, toggle };
}

export function CityControlsBar({ fullscreenTargetRef, canGoBack, onBack, onReset }: CityControlsBarProps) {
  const { t } = useI18n();
  const fullscreen = useCityFullscreen(fullscreenTargetRef);

  return (
    <div data-testid="city-controls" className="absolute bottom-3 right-3 flex items-center gap-1">
      <Button
        type="button"
        variant="secondary"
        size="icon"
        data-testid="city-control-back"
        aria-label={t('city.controlBack')}
        disabled={!canGoBack}
        onClick={onBack}
        className={CONTROL_CLASS}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="icon"
        data-testid="city-control-reset"
        aria-label={t('city.controlReset')}
        onClick={onReset}
        className={CONTROL_CLASS}
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
      </Button>
      {fullscreen.supported && (
        <Button
          type="button"
          variant="secondary"
          size="icon"
          data-testid="city-control-fullscreen"
          aria-label={t(fullscreen.isFullscreen ? 'city.controlExitFullscreen' : 'city.controlFullscreen')}
          onClick={fullscreen.toggle}
          className={CONTROL_CLASS}
        >
          {fullscreen.isFullscreen ? (
            <Minimize2 className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Maximize2 className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      )}
    </div>
  );
}
