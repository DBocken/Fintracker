import { useLayoutEffect } from 'react';
import { useDisplayDensity } from './useDisplayDensity';
import type { DisplayDensity } from '@/features/shared/domain/display-density';

/**
 * Schreibt die aktuelle Dichte als `data-density` an das Wurzelelement und
 * gibt sie zurück.
 *
 * **Wofür.** Manches an der Dichte ist CSS, nicht Struktur: die Mindestgrösse
 * der Tippziele, der Verzicht auf Karten-Chrome. Diese Regeln brauchen keinen
 * React-Zweig, sondern eine Angabe, gegen die eine Utility-Klasse prüfen kann
 * (`fokussiert:min-h-11`, siehe `@custom-variant` in `src/index.css`).
 *
 * **Warum das Attribut und nicht eine zweite Media Query.** Genau davor warnt
 * `docs/architecture/darstellungsdichte.md` unter „Verworfene Alternativen":
 * Zwei Kriterien widersprechen sich in Randfällen, und dann entscheidet
 * niemand mehr nachvollziehbar. Der erste Entwurf dieser Umstellung benutzte
 * `@media (pointer: coarse)` für die Tippziele — ein zweites Kriterium neben
 * der Dichte, und damit ein Telefon mit angeschlossener Maus, das plötzlich
 * kleine Ziele bekommt, während die Präsentation weiter fokussiert bleibt.
 * Über das Attribut folgt die Grösse der EINEN Entscheidung.
 *
 * **Warum `useLayoutEffect` und nicht `theme-init.js`.** Das Theme wird dort
 * vor dem Bündel gesetzt, weil ein heller Blitz vor dem dunklen Thema
 * sichtbar wäre. Hier genügt `useLayoutEffect`: Er läuft nach dem Render und
 * VOR dem Anstrich, es gibt also kein Bild ohne das Attribut. Der Preis wäre
 * sonst die Schwelle 768 ein zweites Mal im Quelltext — als Zahl in einer
 * Datei, die kein Typsystem und kein Test erreicht.
 */
export function useDensityRootAttribute(): DisplayDensity {
  const density = useDisplayDensity();

  useLayoutEffect(() => {
    document.documentElement.dataset.density = density;
  }, [density]);

  return density;
}
