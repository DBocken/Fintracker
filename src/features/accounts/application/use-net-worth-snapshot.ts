/**
 * Schreibt den Vermögensstand des laufenden Monats fort (Welle 4).
 *
 * Ohne diese Kopplung bliebe die Historie für immer leer — eine
 * Datengrundlage ohne Erzeuger ist keine. Der Schnappschuss entsteht beim
 * ANSCHAUEN: Wer die Konten-Fläche im Monat einmal öffnet, hat den Punkt.
 *
 * Bewusst NICHT in `getNetWorthBreakdown()`: Ein Seiteneffekt in einer
 * Lesefunktion überrascht jeden späteren Aufrufer — auch Tests, die nur
 * rechnen wollen. Und bewusst je Monat höchstens einmal geschrieben: Die
 * Fortschreibung ersetzt den Monatswert, statt Punkte zu häufen.
 */

import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getNetWorthBreakdown } from '@/services/net-worth-service';
import { schreibeSchnappschuss } from '@/services/net-worth-history-service';
import { monatsSchluessel } from '@/lib/net-worth-history-types';

export function useNetWorthSnapshot(jetzt: Date = new Date()): void {
  // Derselbe Schlüssel wie überall sonst — kein zweiter Ladevorgang (§4).
  const { data, isError } = useQuery({ queryKey: ['net-worth'], queryFn: getNetWorthBreakdown });
  const geschrieben = useRef<string | null>(null);
  const monat = monatsSchluessel(jetzt);

  useEffect(() => {
    // Ein Lesefehler darf keinen Schnappschuss erzeugen: Eine unvollständige
    // Aufstellung als Monatswert festzuhalten hiesse, einen Knick in die
    // Kurve zu schreiben, den es nie gab.
    if (!data || isError || geschrieben.current === monat) return;
    geschrieben.current = monat;
    void schreibeSchnappschuss(data, jetzt);
  }, [data, isError, monat, jetzt]);
}
