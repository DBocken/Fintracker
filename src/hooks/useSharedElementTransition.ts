/**
 * Shared-Element-Transition-Hook (WP-3.2).
 *
 * Liefert eine stabile `layoutId` für Framer Motion, die eine Karte/Source
 * mit ihrer Detailansicht verbindet. Bei `prefers-reduced-motion` wird keine
 * `layoutId` geliefert (direkter Sprung statt Transition).
 *
 * Die Transition-Dauer ist MOTION_DURATIONS.slow (600ms), bei Reduced Motion 0.
 *
 * @see docs/aaa-plus/tdd-specs.md — WP-3.2
 */

import { useCallback, useMemo, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';
import { MOTION_DURATIONS } from '@/lib/motion-tokens';

export type SharedElementTransitionResult = {
  /** Framer Motion `layoutId` — undefined bei Reduced Motion. */
  layoutId: string | undefined;
  /** Ob die Transition gerade aktiv ist. */
  isActive: boolean;
  /** Dauer der Transition in ms. */
  transitionDuration: number;
  /** Transition aktivieren. */
  activate: () => void;
  /** Transition deaktivieren. */
  deactivate: () => void;
};

export function useSharedElementTransition<T extends string>(
  sourceId: T,
): SharedElementTransitionResult {
  const reduce = useReducedMotion();
  const [isActive, setIsActive] = useState(false);

  const activate = useCallback(() => setIsActive(true), []);
  const deactivate = useCallback(() => setIsActive(false), []);

  return useMemo(() => ({
    layoutId: reduce ? undefined : sourceId,
    isActive,
    transitionDuration: reduce ? 0 : MOTION_DURATIONS.slow,
    activate,
    deactivate,
  }), [sourceId, isActive, reduce, activate, deactivate]);
}
