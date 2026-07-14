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
   * deterministisch testbar mit einer festen Zahl. Nur wirksam, wenn
   * `declutter` `true` ist (siehe dort).
   */
  maxVisible: number;
  /**
   * WP-D1 (Nutzer-Befund: "wo würde Streaming auftauchen?"): `true` =
   * bisheriges Verhalten — `resolveLabelCollisions` (Kollisions-Culling) +
   * `maxVisible`-Cap greifen, kleine Nachbarn können ihr Label an größere
   * verlieren. `false` = ALLE projizierten Labels werden gerendert (nur
   * Hinter-der-Kamera-Cull über `NDC_Z_CULL` und der Distanz-Fade bleiben
   * aktiv) — kein `resolveLabelCollisions`-Aufruf, kein Cap.
   *
   * `CityPage` setzt dies auf `nav.level !== 'city'`: auf Stadt-Ebene gibt es
   * nur wenige Distrikte, da darf/soll JEDES Label sichtbar sein (auch ein
   * kleines wie "Abos & Streaming"); ab der Distrikt-/Unterkategorie-Ebene
   * gibt es potenziell viele Gebäude/Etagen, dort bleibt das Entzerren aktiv.
   */
  declutter: boolean;
  className?: string;
};

/**
 * Label-Aufbau-Sync (WP-D1, C7-Review): Balken wachsen bei einem Ebenen-/
 * Layoutwechsel ~500 ms lang (`city-scene.ts#BAR_GROWTH_DURATION_MS`) — ohne
 * Verzögerung steht ein Label sofort auf seiner (statischen) ZIEL-Oberkante
 * und schwebt sichtbar über der Lücke, bis der Balken es "einholt". Der
 * gesamte Label-CONTAINER blendet daher verzögert ein, sobald sich die
 * `labels`-Prop-IDENTITÄT ändert (= neues Layout).
 *
 * Zahl hier bewusst DUPLIZIERT statt aus `city-scene.ts` importiert: dort ist
 * `BAR_GROWTH_DURATION_MS` eine lokale Variable INNERHALB der
 * `createCityScene`-Fabrikfunktion (kein Modul-Export) — ein Export würde
 * `city-scene.ts` ändern, was laut Vorgabe tabu ist ("NICHT anfassen"). Ein
 * Import des Moduls wäre für sich genommen unproblematisch (reines Parsen
 * von `city-scene.ts` hat keine WebGL-Seiteneffekte, nur der Aufruf von
 * `createCityScene()` selbst hätte sie) — aber ohne Export gibt es dort
 * nichts zu importieren, also bleibt nur die Duplikation + dieser
 * Querverweis-Kommentar.
 */
const LABEL_FADE_IN_DELAY_MS = 500; // == city-scene.ts BAR_GROWTH_DURATION_MS
/** Fade-Dauer selbst (kurz) — unabhängig vom viel längeren Balkenwachstum, sorgt nur dafür, dass der Einblendsprung nach dem Delay nicht hart wirkt. */
const LABEL_FADE_IN_DURATION_MS = 200;

/**
 * Fixe Label-Box-Größe (px) für die Kollisionsauflösung — MUSS zur realen
 * gerenderten Größe des zweizeiligen Labels unten passen (Name oben, Betrag
 * darunter), sonst überlappen echte Labels trotz "kollisionsfrei" laut
 * `resolveLabelCollisions`.
 *
 * `LABEL_WIDTH_PX` = `max-w-[132px]` im JSX (Truncation greift bei dieser
 * Breite).
 *
 * `LABEL_HEIGHT_PX` = vertikales Padding (`py-1.5` = 2 × 6px = 12px) + Name-
 * Zeile (`leading-4` = 16px) + Zeilenabstand (`gap-0.5` = 2px) + Betrags-
 * Zeile (`leading-[14px]` = 14px) = 12 + 16 + 2 + 14 = 44px.
 */
const LABEL_WIDTH_PX = 132;
const LABEL_HEIGHT_PX = 44;

/**
 * Reine Sichtbarkeits-/Hinter-der-Kamera-Prüfung über die projizierte
 * NDC-Tiefe: `> 1` = hinter der Kamera (Vorzeichen-Flip von `w`) bzw. jenseits
 * der Fern-Ebene. Das ist der EINZIGE Zweck von `ndc.z` hier.
 *
 * [REGRESSION] WP-C5: `ndc.z` NICHT für das Distanz-Fading verwenden — die
 * perspektivische Tiefe ist nichtlinear (1/z) und liegt bei realen
 * Kameradistanzen (near 0.1 / far 1000, Stadt ~30 Einheiten entfernt) bereits
 * bei ~0.99 für ALLE Anker. Ein Fade über `ndc.z` blendete dadurch jedes Label
 * aus (nichts sichtbar an Vierteln/Gebäuden/Etagen). Das Fading läuft jetzt
 * über die echte Welt-Distanz Kamera→Anker.
 */
const NDC_Z_CULL = 1;

/**
 * Distanz-Fade über die WELT-Distanz (Kamera→Anker). Großzügig gewählt: bis
 * `FADE_START_DISTANCE` voll sichtbar, danach linear bis 0 bei
 * `FADE_END_DISTANCE`. `selectCityLabels` liefert ohnehin nur Labels der
 * AKTUELLEN Ebene (alle in vergleichbarer Distanz), das Entzerren übernimmt
 * die Kollisionsauflösung + `maxVisible` — der Fade greift daher praktisch nur
 * für sehr große Städte / extreme Kamera-Distanzen und darf die normalen
 * Labels nie ausblenden.
 */
const FADE_START_DISTANCE = 60;
const FADE_END_DISTANCE = 100;

function fadeOpacityForDistance(distance: number): number {
  if (distance <= FADE_START_DISTANCE) return 1;
  if (distance >= FADE_END_DISTANCE) return 0;
  return 1 - (distance - FADE_START_DISTANCE) / (FADE_END_DISTANCE - FADE_START_DISTANCE);
}

type ProjectedLabel = { id: string; x: number; y: number; opacity: number };

export const CityLabels = forwardRef<CityLabelsHandle, CityLabelsProps>(function CityLabels(
  { labels, canvasSize, maxVisible, declutter, className },
  ref,
) {
  const reducedMotion = useReducedMotion();
  const elementRefs = useRef(new Map<string, HTMLDivElement>());
  const lastProjectedRef = useRef(new Map<string, ProjectedLabel>());
  const containerRef = useRef<HTMLDivElement | null>(null);
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
        // Welt-Distanz VOR `project()` messen (project() mutiert `vector`
        // in-place zu NDC — danach ist die Weltposition verloren).
        vector.set(label.anchor.x, label.anchor.y, label.anchor.z);
        const worldDistance = camera.position.distanceTo(vector);
        vector.project(camera);
        if (vector.z > NDC_Z_CULL) continue; // hinter der Kamera / jenseits der Fern-Ebene.
        const opacity = fadeOpacityForDistance(worldDistance);
        if (opacity <= 0) continue;
        const x = ((vector.x + 1) / 2) * canvasSize.width;
        const y = ((1 - vector.y) / 2) * canvasSize.height;
        projectedById.set(label.id, { id: label.id, x, y, opacity });
      }
      lastProjectedRef.current = projectedById;

      // WP-D1: Culling/Cap gelten NUR noch, wenn `declutter` aktiv ist
      // (district-/subcategory-Ebene — dort potenziell viele Gebäude/
      // Etagen). Auf Stadt-Ebene (`declutter=false`) sind alle projizierten
      // (nicht hinter der Kamera liegenden, nicht weggefadeten) Labels
      // sichtbar — wenige Distrikte, kein Grund zum Ausdünnen.
      const nextVisible = declutter
        ? resolveLabelCollisions(
            labels
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
              }),
            maxVisible,
          )
        : new Set(projectedById.keys());

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
    [labels, canvasSize.width, canvasSize.height, maxVisible, declutter, applyPosition],
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

  // Label-Aufbau-Sync (WP-D1/C7-Review, siehe `LABEL_FADE_IN_DELAY_MS` oben):
  // NUR bei geänderter `labels`-Prop-IDENTITÄT (= Ebenen-/Layoutwechsel) neu
  // einblenden — NICHT bei jedem `reproject()`-Tick (Kamera-Bewegung ändert
  // `labels` nicht). Rein CSS-getrieben: kein Timer/rAF-Nachtick nötig, der
  // Browser fährt die Transition selbständig zu Ende, auch nachdem der
  // `onFrame`-Loop nach Flugende wieder schläft (Single-rAF-Invariante bleibt
  // unberührt — diese Komponente startet selbst KEINEN eigenen rAF/Timer).
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (reducedMotion) {
      // Konsistent zum Sofort-Verhalten der Balken bei reduced-motion
      // (`city-scene.ts`: `animationsEnabled=false` -> Sofort-Endzustand).
      el.style.transitionProperty = 'none';
      el.style.transitionDelay = '0s';
      el.style.transitionDuration = '0s';
      el.style.opacity = '1';
      return;
    }

    // Hart auf 0 zurücksetzen + ERZWUNGENER Reflow (Layout-Lesezugriff),
    // BEVOR die Ziel-Opazität mit Delay gesetzt wird — sonst fasst der
    // Browser beide Style-Schreibvorgänge im selben Frame zusammen (kein
    // Zwischen-Repaint bei 0) und es gibt keinen sichtbaren Übergang.
    // Standard-Trick, um eine CSS-Transition bei gleichbleibendem Zielwert
    // (hier: erneut 1) zuverlässig neu zu starten.
    el.style.transitionProperty = 'none';
    el.style.opacity = '0';
    void el.offsetHeight;
    el.style.transitionProperty = 'opacity';
    el.style.transitionDuration = `${LABEL_FADE_IN_DURATION_MS}ms`;
    el.style.transitionDelay = `${LABEL_FADE_IN_DELAY_MS}ms`;
    el.style.transitionTimingFunction = 'ease-out';
    el.style.opacity = '1';
  }, [labels, reducedMotion]);

  return (
    <div
      ref={containerRef}
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
              'absolute left-0 top-0 flex max-w-[132px] flex-col gap-0.5 rounded bg-background/80 px-1.5 py-1.5 shadow-sm',
              !reducedMotion && 'transition-opacity duration-150 ease-out',
            )}
          >
            {/* Zweizeilig (WP-C8): Name oben, Betrag darunter — vorher einzeilig
                nebeneinander, bei längeren Kategorie-/Vertragsnamen kollidierte
                der Betrag mit der Truncation. `LABEL_HEIGHT_PX` oben MUSS zu
                dieser Höhe passen. */}
            <span className="truncate text-xs font-medium leading-4 text-foreground">{label.text}</span>
            {typeof label.amount === 'number' && (
              <span className="truncate text-[10px] leading-[14px] text-muted-foreground">
                {formatCurrency(label.amount)}
              </span>
            )}
          </div>
        ))}
    </div>
  );
});
