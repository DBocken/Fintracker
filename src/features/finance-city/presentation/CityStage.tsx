/**
 * Die 3D-Fläche der Stadt mit allem, was darauf liegt (herausgelöst aus
 * `CityPage.tsx` in WP 6.4): Canvas, HTML-Labels, Vignette, Kontext-Chip,
 * Erst-Besuch-Hinweis und Steuerleiste — plus der WebGL-nahe Zustand, den nur
 * diese Fläche betrifft (Kamera-Rig, gemessene Canvas-Größe, Störungsmeldung
 * und deren Neuaufbau-Schlüssel).
 *
 * Der Canvas bleibt gemountet, solange Daten vorhanden sind — im Listen-Modus
 * wird er nur visuell ausgeblendet und `aria-hidden` gesetzt, statt ihn zu
 * entfernen: ein Toggle soll keinen WebGL-Kontext neu aufbauen, und
 * Screenreader sollen nicht zwei konkurrierende Ansichten sehen.
 *
 * `canvasGeneration` ist der Remount-Schlüssel: ein Neuaufbau nach hartem
 * Kontextverlust braucht einen frischen WebGL-Kontext, und den bekommt man nur
 * über ein neues `<canvas>`-Element.
 *
 * Die Fläche trägt `role="group"`, nicht `role="img"`: in ihr stecken die
 * Distrikt-Labels und im Störfall die Knöpfe „erneut versuchen"/„zur Liste".
 * `role="img"` erklärt all das zum Bildinhalt — Hilfstechnik reicht es dann
 * nicht mehr durch, und die einzige Ausweichmöglichkeit aus einer toten
 * 3D-Fläche wäre ausgerechnet für die unerreichbar, die sie am dringendsten
 * brauchen (axe: nested-interactive).
 */

import { useCallback, useRef, useState, type MutableRefObject, type RefObject } from 'react';
import * as THREE from 'three';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/useI18n';
import { useIsWideDesktop } from '@/hooks/useIsWideDesktop';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { CityPageModel } from '../application/use-city-page-model';
import { CityCanvas, type CityControlsApi, type CityCanvasUnavailableReason } from './CityCanvas';
import { CityLabels, type CityLabelsHandle } from './CityLabels';
import { CityContextChip } from './CityContextChip';
import { CityControlsBar } from './CityControlsBar';
import { CityUnavailableNotice } from './CityUnavailableNotice';
import { CityTapHint } from './CityMoments';
import { useCityCameraRig } from './use-city-camera-rig';
import { useCityCanvasSize } from './use-city-canvas-size';
import { useCitySceneEffects } from './use-city-scene-effects';
import type { CitySceneHandle } from './city-scene';

/** WP-C5/D9: Mobil 6, Desktop 10 gleichzeitig sichtbare Labels (Kollisions-Cap, `resolveLabelCollisions`). */
const MAX_VISIBLE_LABELS_MOBILE = 6;
const MAX_VISIBLE_LABELS_DESKTOP = 10;

export type CityStageProps = {
  city: CityPageModel;
  /** Header + Tabs — ihre Höhe ist die Sichtzentrums-Korrektur der Kamera. */
  chromeRef: RefObject<HTMLElement | null>;
  showList: boolean;
  onShowList: () => void;
};

export function CityStage({ city, chromeRef, showList, onShowList }: CityStageProps) {
  const { t } = useI18n();
  const sceneRef = useRef<CitySceneHandle | null>(null);
  const controlsApiRef = useRef<CityControlsApi | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const labelsRef = useRef<CityLabelsHandle | null>(null);

  const [unavailable, setUnavailable] = useState<CityCanvasUnavailableReason | null>(null);
  const [canvasGeneration, setCanvasGeneration] = useState(0);
  const rebuild = useCallback(() => {
    setUnavailable(null);
    setCanvasGeneration((generation) => generation + 1);
  }, []);

  const isWideDesktop = useIsWideDesktop();
  const reducedMotion = useReducedMotion();
  const requestFrame = useCallback(() => controlsApiRef.current?.invalidate(), []);
  const canvasSize = useCityCanvasSize({ containerRef, active: true, requestFrame });
  const cameraController = useCityCameraRig({
    active: true,
    sceneRef,
    controlsApiRef,
    chromeRef,
    reducedMotion,
    cameraIntent: city.nav.cameraIntent,
    layout: city.geometry.layout,
    focusLayout: city.geometry.focusLayout,
    onZoomOutThreshold: city.nav.actions.zoomOutStep,
  });
  useCitySceneEffects({ sceneRef, requestFrame, highlightId: city.hoveredBoxId, atmosphere: city.atmospherePreset });

  // `CityLabels.reproject` läuft ausschließlich über `onFrame` — das feuert
  // nur in Frames, in denen tatsächlich gerendert wurde (Perf-Vorgabe).
  const handleFrame = useCallback((camera: THREE.PerspectiveCamera) => labelsRef.current?.reproject(camera), []);

  return (
    <div
      ref={containerRef}
      data-tour-id="city-canvas"
      aria-hidden={showList}
      role={showList ? undefined : 'group'}
      aria-label={showList ? undefined : t('city.canvasAriaLabel')}
      className={cn('absolute inset-0', showList && 'invisible')}
    >
      <CityCanvas
        key={canvasGeneration}
        layout={city.geometry.layout}
        onTapBox={city.handleTapBox}
        onHoverBox={city.setHoveredBox}
        onControlsStart={() => cameraController?.cancelFlight()}
        onControlsChange={() => cameraController?.onControlsChange()}
        cameraController={cameraController}
        onFrame={handleFrame}
        controlsApiRef={controlsApiRef}
        sceneRef={sceneRef}
        onUnavailable={setUnavailable}
        flowLines={city.geometry.flowLines}
        className="absolute inset-0"
      />

      {/* Im Listen-Modus unterdrückt — dort ist die Alternative ja schon offen. */}
      {unavailable && !showList && (
        <CityUnavailableNotice reason={unavailable} onRebuild={rebuild} onShowList={onShowList} />
      )}

      {/* WP-D6: dezente Vignette rahmt die Szene — reines CSS-Overlay (kein
          Post-Processing/GPU-Pass), liegt UNTER den Labels. */}
      <div
        aria-hidden="true"
        data-testid="city-vignette"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(2,6,12,0.22)_100%)] dark:bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.45)_100%)]"
      />

      <CityStageLabels city={city} labelsRef={labelsRef} canvasSize={canvasSize} isWideDesktop={isWideDesktop} />

      {city.geometry.context && (
        <CityContextChip
          context={city.geometry.context}
          overview={city.overview}
          goalsSummary={city.goalsSummary}
          isIncomeWorld={city.tab === 'income'}
          valueFormat={city.valueFormat}
          formatAmount={city.formatCityAmount}
        />
      )}

      {city.tapHint.visible && city.nav.level === 'city' && <CityTapHint />}

      <CityControlsBar
        fullscreenTargetRef={containerRef}
        canGoBack={city.nav.level !== 'city'}
        onBack={city.nav.actions.zoomOutStep}
        onReset={city.nav.actions.reset}
      />
    </div>
  );
}

/**
 * HTML-Overlay-Beschriftungen über der Szene (WP-C5): dieselbe Layout-Quelle
 * wie die 3D-Boxen, Text/Beträge aus dem Modell. Die Screen-Projektion
 * passiert nicht hier, sondern in `CityLabels.reproject()` pro `onFrame`-Tick.
 */
function CityStageLabels({
  city,
  labelsRef,
  canvasSize,
  isWideDesktop,
}: {
  city: CityPageModel;
  labelsRef: MutableRefObject<CityLabelsHandle | null>;
  canvasSize: { width: number; height: number };
  isWideDesktop: boolean;
}) {
  return (
    <CityLabels
      ref={labelsRef}
      labels={city.geometry.labels}
      canvasSize={canvasSize}
      maxVisible={isWideDesktop ? MAX_VISIBLE_LABELS_DESKTOP : MAX_VISIBLE_LABELS_MOBILE}
      // WP-D1/D9: Auf BREITEN Screens zeigt die Stadt-Ebene alle
      // Distrikt-Labels; auf schmalen stapelten sie sich unlesbar über der
      // Stadt — dort gilt das Culling auch dort (die wichtigsten Distrikte
      // gewinnen, der Rest bleibt über Chip und Liste erreichbar).
      declutter={city.nav.level !== 'city' || !isWideDesktop}
      // WP-D2/D3: ab der Distrikt-Ebene seitlich versetzt und per farbiger
      // Führungslinie mit der Etage verbunden, statt mittig auf dem Baukörper.
      connectors={city.nav.level !== 'city'}
      highlightedId={city.hoveredBoxId}
      onLabelHover={city.setHoveredBox}
      onLabelTap={city.handleTapBox}
      valueFormat={city.valueFormat}
      // WP-D1: Fade-in nur bei echtem Ebenen-/Weltwechsel, NICHT bei jedem
      // Query-Refetch — sonst flackern alle Labels, sobald eine
      // Kategorie-Zuweisung oder ein Fensterfokus die Stadt-Query neu lädt.
      // Tab im Key (WP-D5): auch der Weltwechsel baut die Stadt neu auf.
      fadeKey={`${city.tab}:${city.nav.level}`}
      className="absolute inset-0"
    />
  );
}
