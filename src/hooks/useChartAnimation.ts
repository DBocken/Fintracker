/**
 * Zentraler Chart-Animation-Hook (WP-6.7).
 *
 * Standardisiert die Aufbau-Animation für alle Recharts-Charts:
 * - `animate`: ob Animationen aktiv sind (false bei reduced-motion)
 * - `animationDuration`: Dauer in ms (MOTION_DURATIONS.slow)
 * - `animationEasing`: Easing-Kurve (MOTION_EASINGS.build)
 *
 * Verwendung in Recharts:
 * ```tsx
 * const { animate, animationDuration, animationEasing } = useChartAnimation();
 * <Bar isAnimationActive={animate} animationDuration={animationDuration} />
 * ```
 *
 * @see docs/aaa-plus/implementation-plan.md — WP-6.7
 */

import { useMemo } from 'react';
import { useReducedMotion } from './useReducedMotion';
import { MOTION_DURATIONS, MOTION_EASINGS, resolveDuration } from '@/lib/motion-tokens';

export type ChartAnimationConfig = {
  /** Ob die Chart-Aufbau-Animation aktiv ist. */
  animate: boolean;
  /** Dauer der Aufbau-Animation in ms. */
  animationDuration: number;
  /** Easing-Kurve der Aufbau-Animation. */
  animationEasing: string;
};

export function useChartAnimation(): ChartAnimationConfig {
  const reduce = useReducedMotion();

  return useMemo(() => ({
    animate: !reduce,
    animationDuration: resolveDuration(MOTION_DURATIONS.slow, reduce),
    animationEasing: MOTION_EASINGS.build,
  }), [reduce]);
}
