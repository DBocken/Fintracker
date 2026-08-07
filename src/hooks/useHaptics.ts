/**
 * WP-7.8 — Haptisches Feedback aus React auslösen.
 *
 * Die Zuordnung Anlass → Muster steht rein in `@/lib/haptics`; hier kommt nur
 * der Browser-Zugriff dazu und die Frage, **ob** überhaupt vibriert wird.
 *
 * Zwei Gründe schweigen zu lassen:
 *
 * 1. `prefers-reduced-motion`. Wer weniger Bewegung verlangt, will in aller
 *    Regel auch kein Summen in der Hand — beides sind unaufgeforderte
 *    körperliche Reize, und die Einstellung ist der einzige Kanal, über den
 *    Nutzer das heute überhaupt sagen können. Ein eigener Schalter dafür
 *    gehört in den Einstellungen-Screen und damit in Phase 8.
 * 2. Das Gerät kann es nicht. `navigator.vibrate` fehlt auf dem Desktop und in
 *    Safari; der Aufruf muss dort folgenlos bleiben, nicht werfen.
 */

import { useCallback } from 'react';
import { useReducedMotion } from './useReducedMotion';
import { hapticPattern, type HapticKind } from '@/lib/haptics';

/** Ob dieses Gerät Vibration überhaupt anbietet. */
export function supportsHaptics(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

/**
 * Liefert eine Funktion, die eine haptische Rückmeldung auslöst.
 *
 * ```tsx
 * const haptic = useHaptics();
 * <Button onClick={() => { save(); haptic('confirm'); }} />
 * ```
 */
export function useHaptics(): (kind: HapticKind) => void {
  const reduce = useReducedMotion();

  return useCallback(
    (kind: HapticKind) => {
      if (reduce || !supportsHaptics()) return;
      try {
        navigator.vibrate(hapticPattern(kind));
      } catch {
        // Manche WebViews werfen, wenn die Seite im Hintergrund liegt oder der
        // Nutzer noch nicht interagiert hat. Eine fehlgeschlagene Vibration
        // darf niemals eine Aktion abbrechen — sie ist Beiwerk, nicht Inhalt.
      }
    },
    [reduce],
  );
}
