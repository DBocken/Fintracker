import { useQuery } from '@tanstack/react-query';
import { getWaterfallPlan } from '@/services/waterfall-service';

/**
 * Der Liquiditäts-Wasserfall als gemeinsame Quelle für Panel und Seite.
 *
 * **Warum ein Hook und nicht zwei `useQuery`-Aufrufe.** Auf `/liquidity` steht
 * das Panel ÜBER dem Bericht. Solange es lädt, kennt niemand seine Höhe — und
 * sobald es sie einnimmt, rutscht alles darunter nach unten (gemessen CLS
 * 0,102 gegen ein Budget von 0,1; WP-10.4). Ein höhengleiches Skelett löst das
 * nicht, weil die Höhe von den Daten abhängt.
 *
 * Deshalb wartet die Seite, bis der Plan da ist, und rendert dann alles auf
 * einmal. Dafür brauchen Seite und Panel dieselbe Ladeaussage — hier, statt
 * zweimal denselben `queryKey` von Hand zu wiederholen.
 *
 * Der Preis ist ausgesprochen: Der Bericht erscheint einen Moment später,
 * dafür springt er nicht. Das ist der bessere Tausch, weil die Verschiebung
 * genau dann zuschlägt, wenn jemand schon zu lesen begonnen hat.
 */
export function useWaterfallPlan() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['waterfall-plan'],
    queryFn: () => getWaterfallPlan(),
  });
  return { plan: data ?? null, isLoading, isError, refetch };
}
