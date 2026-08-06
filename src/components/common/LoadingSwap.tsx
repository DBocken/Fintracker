/**
 * WP-7.3 — Ladeverhalten (Liquid Loading), der sichtbare Teil.
 *
 * Blendet zwischen Ladezustand und Inhalt über, statt hart umzuschalten, und
 * hält sich dabei an die Choreografie aus `@/lib/loading-choreography`: kein
 * Skeleton unter der Wahrnehmungsschwelle, und ein einmal gezeigtes bleibt
 * lange genug, um gelesen zu werden.
 *
 * `mode="wait"` bei `AnimatePresence` ist Absicht: Skeleton und Inhalt sollen
 * einander ablösen, nicht übereinanderliegen. Beide gleichzeitig sichtbar
 * ergäbe für den Moment des Übergangs eine doppelte Darstellung derselben
 * Sache — genau das Flimmern, das dieses Arbeitspaket beseitigt.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useMotionQuality } from '@/hooks/useMotionQuality';
import { MOTION_DURATIONS, MOTION_EASINGS_BEZIER } from '@/lib/motion-tokens';
import {
  resolveLoadingPhase,
  remainingSkeletonMs,
  SKELETON_DELAY_MS,
  type LoadingPhase,
} from '@/lib/loading-choreography';

export type LoadingSwapProps = {
  loading: boolean;
  /** Der Ladezustand — üblicherweise `<Skeleton variant="shimmer" />`. */
  skeleton: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * Führt die Phasenlogik über die Zeit.
 *
 * Bewusst mit Timern und nicht mit einem Intervall: es gibt genau zwei
 * Zeitpunkte, an denen sich etwas ändern kann (Schwelle erreicht,
 * Mindestdauer abgelaufen). Ein Intervall würde dazwischen sinnlos rendern.
 */
function useLoadingPhase(loading: boolean): LoadingPhase {
  const [, forceRender] = useState(0);
  const loadingSince = useRef<number | null>(null);
  const skeletonSince = useRef<number | null>(null);

  if (loading && loadingSince.current === null) loadingSince.current = Date.now();
  if (!loading && loadingSince.current !== null && skeletonSince.current === null) {
    // Fertig, ohne dass je ein Skeleton stand — der schnelle Fall.
    loadingSince.current = null;
  }

  const now = Date.now();
  const loadingForMs = loadingSince.current === null ? null : now - loadingSince.current;
  const skeletonVisibleForMs = skeletonSince.current === null ? null : now - skeletonSince.current;

  const phase = resolveLoadingPhase({ loading, loadingForMs, skeletonVisibleForMs });
  if (phase === 'skeleton' && skeletonSince.current === null) skeletonSince.current = now;
  if (phase === 'content') {
    loadingSince.current = null;
    skeletonSince.current = null;
  }

  useEffect(() => {
    if (phase === 'blank') {
      // Aufwachen, sobald die Schwelle erreicht ist.
      const wait = Math.max(0, SKELETON_DELAY_MS - (loadingForMs ?? 0));
      const timer = setTimeout(() => forceRender((n) => n + 1), wait);
      return () => clearTimeout(timer);
    }
    if (phase === 'skeleton' && !loading) {
      // Fertig geladen, aber die Mindestdauer läuft noch.
      const timer = setTimeout(() => forceRender((n) => n + 1), remainingSkeletonMs(skeletonVisibleForMs));
      return () => clearTimeout(timer);
    }
    return undefined;
    // `loadingForMs`/`skeletonVisibleForMs` sind bei jedem Render andere Zahlen
    // und würden den Timer sonst bei jedem Render neu aufsetzen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, loading]);

  return phase;
}

export function LoadingSwap({ loading, skeleton, children, className }: LoadingSwapProps) {
  const phase = useLoadingPhase(loading);
  const motionQuality = useMotionQuality();
  const duration = motionQuality.seconds(MOTION_DURATIONS.fast);

  return (
    <div className={className}>
      <AnimatePresence mode="wait" initial={false}>
        {phase === 'blank' && <div key="blank" />}
        {phase === 'skeleton' && (
          <motion.div
            key="skeleton"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration, ease: MOTION_EASINGS_BEZIER.precision }}
          >
            {skeleton}
          </motion.div>
        )}
        {phase === 'content' && (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration, ease: MOTION_EASINGS_BEZIER.precision }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default LoadingSwap;
