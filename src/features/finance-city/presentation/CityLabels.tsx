/**
 * HTML-Overlay-Labels der Finanzstadt (WP-C5, README "HTML-Labels statt
 * Sprites"): projiziert `CityLabel.anchor` (3D-Weltkoordinate) über
 * `camera.project()` in Bildschirm-Pixel und rendert nur die Kollisions-
 * freie Teilmenge (`resolveLabelCollisions`, `domain/city-labels.ts`).
 *
 * Perf-kritisch (siehe `CityCanvas.tsx`-Perf-Vorgabe/`[REGRESSION]`-Test):
 * KEIN eigener Timer/rAF hier — `reproject()` wird von `CityPage` exakt
 * einmal pro tatsächlich gerendertem Frame über `CityCanvas`s `onFrame`
 * aufgerufen. Positions-Updates laufen imperativ über DOM-Refs
 * (`element.style.transform`), NICHT über `setState` — sonst ein
 * Re-Render-Sturm analog zur bereits behobenen rAF-Verdopplung. Die MENGE
 * der sichtbaren Labels (ändert sich selten: Level-Wechsel, Kollisionen)
 * ist als einziges React-State erlaubt.
 */
import { forwardRef, useCallback, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { resolveLabelCollisions, type CityLabel } from '../domain/city-labels';
import { cn, formatCurrency } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export type CityLabelsHandle = {
  /** Reprojiziert alle `labels` mit der aktuellen Kamera. Aufgerufen von `CityPage` über `CityCanvas`s `onFrame` — niemals von einem eigenen Timer. */
  reproject(camera: THREE.PerspectiveCamera): void;
};

export type CityLabelsProps = {
  labels: CityLabel[];
  canvasSize: { width: number; height: number };
  /**
   * 6 (Mobile) / 10 (Desktop). Bewusst als fertige Zahl statt eines eigenen
   * `useIsWideDesktop()`-Aufrufs hier: `CityPage` kennt den Breakpoint
   * bereits (misst dieselbe Canvas-Fläche für den Kamera-Controller) und
   * reicht ihn durch — hält diese Komponente frei von `matchMedia`, voll
   * deterministisch testbar mit einer festen Zahl.
   */
  maxVisible: number;
  className?: string;
};

/** Fixe Label-Box-Größe (px) für die Kollisionsauflösung — großzügig genug für Name + Betrag (Truncation im JSX). */
const LABEL_WIDTH_PX = 132;
const LABEL_HEIGHT_PX = 34;

/** README/Task: Labels mit NDC-Tiefe > 1 sind hinter der Kamera bzw. jenseits der Fern-Ebene — ausblenden. */
const NDC_Z_CULL = 1;
/** Distanz-Fade: ab dieser Tiefe beginnt das Ausblenden, bei `NDC_Z_FADE_END` (knapp vor dem Cull-Punkt) ist die Opazität 0. */
const NDC_Z_FADE_START = 0.85;
const NDC_Z_FADE_END = 0.98;

function fadeOpacityForDepth(ndcZ: number): number {
  if (ndcZ <= NDC_Z_FADE_START) return 1;
  if (ndcZ >= NDC_Z_FADE_END) return 0;
  return 1 - (ndcZ - NDC_Z_FADE_START) / (NDC_Z_FADE_END - NDC_Z_FADE_START);
}

type ProjectedLabel = { id: string; x: number; y: number; opacity: number };

export const CityLabels = forwardRef<CityLabelsHandle, CityLabelsProps>(function CityLabels(
  { labels, canvasSize, maxVisible, className },
  ref,
) {
  const reducedMotion = useReducedMotion();
  const elementRefs = useRef(new Map<string, HTMLDivElement>());
  const lastProjectedRef = useRef(new Map<string, ProjectedLabel>());
  const [visibleIds, setVisibleIds] = useState<ReadonlySet<string>>(() => new Set());

  const applyPosition = useCallback((projected: ProjectedLabel) => {
    const el = elementRefs.current.get(projected.id);
    if (!el) return;
    // Imperatives Positions-Update — bewusst KEIN React-State (Perf-Vorgabe oben).
    el.style.transform = `translate(-50%, -100%) translate(${projected.x}px, ${projected.y}px)`;
    el.style.opacity = String(projected.opacity);
  }, []);

  const reproject = useCallback(
    (camera: THREE.PerspectiveCamera) => {
      if (canvasSize.width <= 0 || canvasSize.height <= 0) return;

      const projectedById = new Map<string, ProjectedLabel>();
      const vector = new THREE.Vector3();
      for (const label of labels) {
        vector.set(label.anchor.x, label.anchor.y, label.anchor.z).project(camera);
        if (vector.z > NDC_Z_CULL) continue; // hinter der Kamera / jenseits der Fern-Ebene.
        const opacity = fadeOpacityForDepth(vector.z);
        if (opacity <= 0) continue;
        const x = ((vector.x + 1) / 2) * canvasSize.width;
        const y = ((1 - vector.y) / 2) * canvasSize.height;
        projectedById.set(label.id, { id: label.id, x, y, opacity });
      }
      lastProjectedRef.current = projectedById;

      const candidates = labels
        .filter((l) => projectedById.has(l.id))
        .map((l) => {
          const projected = projectedById.get(l.id)!;
          return {
            id: l.id,
            priority: l.priority,
            rect: {
              x: projected.x - LABEL_WIDTH_PX / 2,
              y: projected.y - LABEL_HEIGHT_PX,
              width: LABEL_WIDTH_PX,
              height: LABEL_HEIGHT_PX,
            },
          };
        });
      const nextVisible = resolveLabelCollisions(candidates, maxVisible);

      // Bereits gemountete, weiterhin sichtbare Labels SOFORT per Ref
      // aktualisieren — kein Warten auf den State-Commit unten.
      for (const id of nextVisible) {
        const projected = projectedById.get(id);
        if (projected) applyPosition(projected);
      }

      setVisibleIds((prev) => {
        if (prev.size === nextVisible.size && [...prev].every((id) => nextVisible.has(id))) return prev;
        return nextVisible;
      });
    },
    [labels, canvasSize.width, canvasSize.height, maxVisible, applyPosition],
  );

  useImperativeHandle(ref, () => ({ reproject }), [reproject]);

  // Labels, die GERADE erst (durch die `setVisibleIds`-Aktualisierung oben)
  // gemountet wurden, VOR dem ersten Paint positionieren — sonst ein
  // sichtbarer 1-Frame-Sprung von (0,0) zur echten Position, bis der
  // nächste `onFrame`-Tick erneut reprojiziert.
  useLayoutEffect(() => {
    for (const id of visibleIds) {
      const projected = lastProjectedRef.current.get(id);
      if (projected) applyPosition(projected);
    }
  }, [visibleIds, applyPosition]);

  return (
    <div
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      aria-hidden="true"
      data-testid="city-labels-layer"
    >
      {labels
        .filter((label) => visibleIds.has(label.id))
        .map((label) => (
          <div
            key={label.id}
            data-testid="city-label"
            data-label-id={label.id}
            ref={(el) => {
              if (el) elementRefs.current.set(label.id, el);
              else elementRefs.current.delete(label.id);
            }}
            className={cn(
              'absolute left-0 top-0 max-w-[8.5rem] truncate rounded bg-background/80 px-1.5 py-0.5 text-xs font-medium text-foreground shadow-sm',
              !reducedMotion && 'transition-opacity duration-150 ease-out',
            )}
          >
            {label.text}
            {typeof label.amount === 'number' && (
              <span className="ml-1 text-muted-foreground">{formatCurrency(label.amount)}</span>
            )}
          </div>
        ))}
    </div>
  );
});
