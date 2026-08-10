import { useEffect, useRef } from 'react';

/**
 * Generischer Inaktivitäts-Timer (WP 3.2 / SEC-2).
 *
 * Kennt keine Verschlüsselungs-Domäne — reine DOM-Aktivität (+ optionaler
 * Zusatzkanal, z.B. für Aktivität ohne Maus/Tastatur) gegen eine Zeitspanne.
 * `LocalEncryptionProvider` verwendet ihn für den Auto-Lock; die Trennung
 * hält den Hook unabhängig testbar und wiederverwendbar, ohne die
 * Schichtregel `hooks-ohne-components` zu berühren (AGENTS.md §3) — dieser
 * Hook importiert nichts aus `components/` oder `services/`.
 */

/** Ereignisse, die als "der Mensch ist noch da" zählen. */
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel'] as const;

export interface UseIdleTimerOptions {
  /**
   * Zeitspanne ohne Aktivität in Millisekunden, nach der `onIdle` feuert.
   * `null` deaktiviert den Timer vollständig — kein Listener wird
   * registriert, kein Timer läuft (kein Timer ohne Zweck).
   */
  timeoutMs: number | null;
  /** Wird nach `timeoutMs` ohne Aktivität aufgerufen. */
  onIdle: () => void;
  /**
   * Zusätzliche Aktivitätsquelle jenseits von DOM-Events, z.B. ein laufender
   * Schreibvorgang ohne Maus-/Tastatureingabe. Erhält den internen Reset als
   * Listener und gibt eine Abmelde-Funktion zurück (dasselbe Muster wie
   * `window.addEventListener`/`removeEventListener`). Sollte eine über die
   * App-Laufzeit stabile Referenz sein — eine bei jedem Render neu erzeugte
   * Funktion lässt den Effekt unnötig neu laufen (und würde dabei den Timer
   * mitten in einer stillen Phase zurücksetzen).
   */
  extraActivity?: (listener: () => void) => () => void;
}

export function useIdleTimer({ timeoutMs, onIdle, extraActivity }: UseIdleTimerOptions): void {
  // Ref statt Dependency: `onIdle` darf bei jedem Render eine neue Referenz
  // sein (üblich bei inline Arrow Functions), ohne den Timer neu zu starten.
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    if (timeoutMs == null) return undefined;

    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => onIdleRef.current(), timeoutMs);
    };

    reset();

    const unsubscribeExtra = extraActivity?.(reset);
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, reset, { passive: true });
    }

    return () => {
      clearTimeout(timer);
      unsubscribeExtra?.();
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, reset);
      }
    };
  }, [timeoutMs, extraActivity]);
}
