import { createContext, useContext } from 'react';

/**
 * Sichtbarkeit der Tutorial-Hinweisebene (Einladung oder laufende Führung),
 * gelesen von nachrangigen Hinweisen wie dem Coach-Streifen des Dashboards.
 *
 * Befund A-2 (WP-4.6-Critic-Review): drei Hinweisebenen standen übereinander
 * vor dem Inhalt. Regel: höchstens eine echte Hinweisebene gleichzeitig —
 * nachrangige warten, bis die vorrangige weggeklickt oder abgeschlossen ist.
 * Der Demodaten-Banner ist bewusst KEINE dieser Ebenen: Datenherkunft ist
 * Integritätsanzeige und darf nie zurückgestellt werden.
 */
export interface TutorialPresence {
  hintVisible: boolean;
}

const TutorialPresenceContext = createContext<TutorialPresence>({ hintVisible: false });

/** Provider gehört ausschließlich `TutorialHost` — genau einer pro App. */
export const TutorialPresenceProvider = TutorialPresenceContext.Provider;

export function useTutorialPresence(): TutorialPresence {
  return useContext(TutorialPresenceContext);
}
