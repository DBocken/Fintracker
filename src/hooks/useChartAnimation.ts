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
import { useMotionQuality } from './useMotionQuality';
import { MOTION_DURATIONS, MOTION_EASINGS_CHART } from '@/lib/motion-tokens';

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
  // WP-7.7: Die Dauer kommt aus der Bewegungsstufe des Geräts statt fest aus
  // dem Token. Recharts interpoliert jeden Pfad in JavaScript — bei 25 Serien
  // ist das der teuerste Dauerposten der App und damit der erste, der auf
  // schwacher Hardware kürzer werden muss. `animate` bleibt an: eine gekürzte
  // Aufbau-Animation ist immer noch ein Aufbau, ein abgeschalteter wäre das
  // „Aufpoppen", das Design-Prinzip 2 gerade verbietet. Nur reduced-motion
  // (durationScale === 0) schaltet wirklich ab.
  const motion = useMotionQuality();

  return useMemo(() => {
    const animationDuration = motion.duration(MOTION_DURATIONS.slow);
    return {
      animate: animationDuration > 0,
      animationDuration,
      animationEasing: MOTION_EASINGS_CHART.build,
    };
  }, [motion]);
}
