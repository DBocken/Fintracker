/**
 * WP-7.7 — Zugang zur Bewegungsstufe aus React.
 *
 * Verbindet das einmalig gelesene Geräteprofil (`useDeviceProfile`) mit der
 * reinen Ableitung (`@/lib/motion-quality`) und der einzigen reaktiven Größe
 * darin: `prefers-reduced-motion`, das der Nutzer jederzeit umstellen kann.
 *
 * Jede Komponente, die Bewegung zeigt, holt ihre Dauern über `duration()`
 * statt direkt aus `MOTION_DURATIONS` — sonst gäbe es die Degradation zwar,
 * aber niemand hielte sich daran.
 */

import { useMemo } from 'react';
import { useReducedMotion } from './useReducedMotion';
import { deviceProfile } from './useDeviceProfile';
import {
  deriveMotionQuality,
  resolveMotionDuration,
  type MotionQualitySettings,
} from '@/lib/motion-quality';

export type MotionQuality = MotionQualitySettings & {
  /** Löst eine Token-Dauer aus `MOTION_DURATIONS` gegen die Stufe auf (ms). */
  duration: (tokenDuration: number) => number;
  /** Dieselbe Dauer in Sekunden — die Einheit, die Framer Motion erwartet. */
  seconds: (tokenDuration: number) => number;
};

/**
 * Die Bewegungsstufe dieses Geräts, inklusive `prefers-reduced-motion`.
 *
 * ```tsx
 * const motion = useMotionQuality();
 * <motion.div transition={{ duration: motion.seconds(MOTION_DURATIONS.default) }} />
 * ```
 */
export function useMotionQuality(): MotionQuality {
  const reducedMotion = useReducedMotion();

  return useMemo(() => {
    const settings = deriveMotionQuality(deviceProfile(), { reducedMotion });
    const duration = (tokenDuration: number) => resolveMotionDuration(tokenDuration, settings);
    return {
      ...settings,
      duration,
      seconds: (tokenDuration: number) => duration(tokenDuration) / 1000,
    };
  }, [reducedMotion]);
}
