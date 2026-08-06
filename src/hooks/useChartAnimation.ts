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
import { MOTION_DURATIONS, MOTION_EASINGS_CHART, resolveDuration } from '@/lib/motion-tokens';

export type ChartAnimationConfig = {
  /** Ob die Chart-Aufbau-Animation aktiv ist. */
  animate: boolean;
  /** Dauer der Aufbau-Animation in ms. */
  animationDuration: number;
  /**
   * Easing-Kurve der Aufbau-Animation.
   *
   * Bewusst der Literal-Typ und nicht `string`: Recharts typisiert
   * `animationEasing` als Template-Literal
   * `cubic-bezier(${number},${number},${number},${number})`. Ein breiter
   * `string` liesse sich dort nicht zuweisen — der Wert waere ohne Cast
   * unbenutzbar, was genau der Grund war, dass bisher nur `animate`
   * durchgereicht wurde.
   */
  animationEasing: typeof MOTION_EASINGS_CHART.build;
};

export function useChartAnimation(): ChartAnimationConfig {
  const reduce = useReducedMotion();

  return useMemo(() => ({
    animate: !reduce,
    animationDuration: resolveDuration(MOTION_DURATIONS.slow, reduce),
    animationEasing: MOTION_EASINGS_CHART.build,
  }), [reduce]);
}
