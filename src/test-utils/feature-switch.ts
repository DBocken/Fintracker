import { waitFor } from '@testing-library/react';
import type { NavFeatureId } from '@/lib/life-situations';

/**
 * Der Ein-/Ausschalter einer Nav-Funktion — sprachunabhängig gesucht.
 *
 * Drei Testdateien haben ihn vorher über sein sichtbares Label gesucht
 * (`getByRole('switch', { name: /Trading/ })`). Das funktionierte nur, solange
 * dieses Label zufällig in jeder Sprache und in beiden Sprachstilen gleich
 * hieß. Mit dem Alltagsregister („Wertpapiere") brach es — und zwar in Tests,
 * die mit der Beschriftung fachlich gar nichts zu tun haben.
 *
 * Die stabile Identität der Zeile ist der Feature-Key, und der steht als `id`
 * ohnehin im DOM (`FeatureSelection.tsx`: `id={`feature-${feature}`}`, mit dem
 * `<Label htmlFor>` verbunden). Danach wird hier gesucht.
 *
 * `waitFor` statt `getElementById` direkt, damit die Aufrufstellen ihr
 * bisheriges `await findBy…`-Verhalten behalten: die Schalter erscheinen in
 * einigen Tests erst nach einem Schrittwechsel im Onboarding-Dialog.
 */
export function findFeatureSwitch(feature: NavFeatureId): Promise<HTMLElement> {
  return waitFor(() => {
    const element = document.getElementById(`feature-${feature}`);
    if (!element) {
      throw new Error(`Kein Schalter für die Nav-Funktion "${feature}" im DOM`);
    }
    return element;
  });
}
