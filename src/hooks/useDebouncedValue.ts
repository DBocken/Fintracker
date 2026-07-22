import { useEffect, useState } from 'react';

/**
 * Liefert `value` verzögert: Der zurückgegebene Wert folgt dem Eingabewert erst,
 * nachdem sich dieser `delayMs` lang nicht mehr geändert hat. Für teure, von
 * schnellen Eingaben getriebene Ableitungen (z. B. das Filtern der Buchungsliste
 * bei jedem Tastendruck) — die Eingabe selbst bleibt responsiv, nur die Folge-
 * berechnung wird gebündelt.
 *
 * Der Timer wird bei jedem Wertwechsel und beim Unmount sauber aufgeräumt, sodass
 * kein veralteter Wert nachträglich gesetzt wird.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
