/**
 * Erst-Besuch-Hinweis „Tippe auf ein Viertel" (WP-D3, herausgelöst in WP 6.4).
 *
 * Der Hinweis verschwindet dauerhaft nach der ersten erfolgreichen
 * Interaktion — reines UI-Flag, deshalb direkt `localStorage` (Präzedenzfall
 * `GentleModeProvider`/`SkinProvider`), kein Service-Umweg nötig.
 *
 * Beide Storage-Zugriffe sind gekapselt: Im Privacy-Modus wirft `localStorage`,
 * und dann soll der Hinweis sessionweise erscheinen bzw. sessionweise
 * verschwinden — nicht die Seite mitreißen.
 */

import { useCallback, useState } from 'react';

export const CITY_TAP_HINT_DISMISSED_KEY = 'fintracker.city.tap-hint-dismissed';

export type CityTapHint = {
  visible: boolean;
  dismiss: () => void;
};

export function useCityTapHint(): CityTapHint {
  const [visible, setVisible] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(CITY_TAP_HINT_DISMISSED_KEY) !== '1';
    } catch {
      return true; // Storage blockiert (z. B. Privacy-Modus): Hinweis nur sessionweise.
    }
  });

  const dismiss = useCallback(() => {
    setVisible((prev) => {
      if (!prev) return prev;
      try {
        window.localStorage.setItem(CITY_TAP_HINT_DISMISSED_KEY, '1');
      } catch {
        // Storage blockiert: Hinweis verschwindet trotzdem für diese Session.
      }
      return false;
    });
  }, []);

  return { visible, dismiss };
}
