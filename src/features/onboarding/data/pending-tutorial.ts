/**
 * Der vorgemerkte Tutorial-Wunsch aus dem letzten Schritt des Einstiegs.
 *
 * **Warum ein Zettel und kein direkter Aufruf.** Die Führung gehört
 * `TutorialHost`, und der steht INNERHALB der `AppShell` — der Einstieg liegt
 * davor und hat den Kontext gar nicht. Der Wunsch wird deshalb notiert und
 * von `PendingTutorialStarter` eingelöst, sobald die App wirklich steht.
 *
 * Einmalig: Gelesen wird verbrauchend, damit ein Neuladen nach dem Einstieg
 * nicht erneut eine Führung startet.
 */

const PENDING_TUTORIAL_KEY = 'ausgabentracker_onboarding_start_tutorial_v1';

export function markTutorialWanted(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PENDING_TUTORIAL_KEY, '1');
  } catch {
    // Ohne Zettel bleibt die Führung aus — der Knopf in der Kopfzeile bleibt.
  }
}

/** Liest den Wunsch und löscht ihn im selben Zug. */
export function consumeTutorialWish(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const wert = window.localStorage.getItem(PENDING_TUTORIAL_KEY);
    window.localStorage.removeItem(PENDING_TUTORIAL_KEY);
    return wert === '1';
  } catch {
    return false;
  }
}
