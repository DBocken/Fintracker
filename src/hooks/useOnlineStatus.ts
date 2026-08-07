import { useEffect, useState } from 'react';

/**
 * Verbindungszustand des Browsers (WP-9.3).
 *
 * `navigator.onLine` allein genügt nicht: Es ist eine Momentaufnahme und
 * ändert sich, ohne dass React davon erführe. Erst die beiden Ereignisse
 * machen daraus einen Zustand, dem die Oberfläche folgen kann.
 *
 * **Was der Wert bedeutet — und was nicht.** `false` heißt „der Browser
 * meldet keine Netzverbindung". Es heißt NICHT, dass die App nicht
 * funktioniert: Fintracker ist local-first, die Finanzdaten liegen in
 * IndexedDB auf dem Gerät. Offline ist hier kein Fehler, sondern ein
 * Betriebszustand, in dem einige wenige Zusatzfunktionen pausieren.
 *
 * Umgekehrt heißt `true` nicht, dass eine bestimmte Gegenstelle erreichbar
 * ist — der Browser weiß nur von seiner eigenen Schnittstelle. Deshalb
 * ersetzt dieser Hook keine Fehlerbehandlung, er ergänzt sie: `hasError` sagt
 * „hat nicht geklappt", dieser Hook liefert oft das *Warum*.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    // Zwischen dem ersten Rendern und diesem Effekt kann sich der Zustand
    // geändert haben — dann bliebe die Anzeige sonst dauerhaft falsch.
    setOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}

export default useOnlineStatus;
