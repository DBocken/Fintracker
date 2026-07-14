import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { App } from '@capacitor/app';
import type { CityNavigationViewModel } from './city-view-model';

/**
 * Android-Hardware-Back auf der Stadt-Seite (README-Akzeptanzkriterium
 * "Android-Hardware-Back navigiert beim Drill-down zuerst eine Ebene
 * zurück"). Sobald irgendein `backButton`-Listener registriert ist,
 * übernimmt Capacitor das GESAMTE Zurück-Verhalten (kein Default mehr) —
 * dieser Handler entscheidet daher selbst zwischen Ebenen-Rückstufung,
 * Fokus-Lösen und Standard-Navigation:
 *
 * 1. `level` ist `subcategory` oder `district` -> eine Ebene hoch
 *    (`actions.zoomOutStep()`; subcategory->district->city, siehe
 *    `use-city-navigation.ts`).
 * 2. `level` ist `city` MIT gesetztem `focusDistrictId` (Ebene-1-Fokus ohne
 *    Eintauchen) -> `zoomOutStep()` ist auf city-Ebene ein No-op (siehe
 *    `use-city-navigation.ts#zoomOutStep`, letzter Zweig), darum stattdessen
 *    `actions.reset()` (identischer Ziel-State: city ohne Fokus — der davon
 *    abweichende `cameraIntent.kind` ('reset' statt 'fit-city') ist hier
 *    irrelevant, der Kamera-Controller behandelt beide als Flug zur
 *    Gesamtansicht).
 * 3. Sonst (oberste Ebene, kein Fokus) -> Standard-Navigation
 *    (`window.history.back()`). App-Exit-Entscheidungen sind NICHT Aufgabe
 *    dieses Hooks (README "Folgeschritte" bleibt für weitere Screens offen).
 *
 * Web: `Capacitor.isNativePlatform() === false` -> der Hook ist komplett
 * inert (kein `@capacitor/app`-Zugriff, kein Listener).
 *
 * Ref-Spiegelung (gleiches Muster wie `CityCanvas.tsx`s `onTapBoxRef` etc.):
 * der Listener wird EINMALIG beim Mount registriert und darf daher nicht die
 * `nav`-Closure vom Registrierungszeitpunkt einfrieren — er liest bei jedem
 * Backbutton-Event den jeweils aktuellen Stand aus `navRef.current`.
 *
 * Lifecycle/Race: `App.addListener` liefert ein PROMISE auf das Handle.
 * Wird die Seite (und damit dieser Hook) VOR Auflösung des Promise wieder
 * unmountet, darf der native Listener nicht bestehen bleiben — sonst ein
 * Leak über den Seitenwechsel hinaus. Ein `cancelled`-Flag markiert diesen
 * Fall; sobald das Promise danach doch noch auflöst, wird sofort
 * `remove()` nachgeholt statt das Handle nur zu verwerfen.
 */
export function useCityBackNavigation(nav: CityNavigationViewModel): void {
  const navRef = useRef(nav);
  navRef.current = nav;

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;
    let handle: PluginListenerHandle | null = null;

    App.addListener('backButton', () => {
      const current = navRef.current;

      if (current.level === 'subcategory' || current.level === 'district') {
        current.actions.zoomOutStep();
        return;
      }

      if (current.level === 'city' && current.focusDistrictId !== null) {
        current.actions.reset();
        return;
      }

      window.history.back();
    }).then((registeredHandle) => {
      if (cancelled) {
        // Unmount ist schon vor Auflösung passiert -> sofort entfernen statt
        // den Handle nur zu verwerfen (sonst bliebe der native Listener aktiv).
        void registeredHandle.remove();
        return;
      }
      handle = registeredHandle;
    });

    return () => {
      cancelled = true;
      void handle?.remove();
      handle = null;
    };
  }, []);
}
