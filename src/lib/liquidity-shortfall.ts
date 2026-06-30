// Liquiditäts-Fehlbetrag: „Wie viel muss ich monatlich freimachen, um über dem
// Sicherheitspuffer zu bleiben?" — der „Wie viel"-Teil, der den Spar-Wasserfall
// (budget-priority-plan) speist.
//
// Deterministisch aus dem Forecast: fällt der projizierte Tiefststand unter den
// Puffer, ist der Fehlbetrag = Puffer − Tiefststand. Verteilt auf die Monate bis
// zum Tiefpunkt ergibt sich die nötige monatliche Einsparung, um den Tiefpunkt
// genau auf den Puffer zu heben (monatliche Kürzung × Monate ≥ Fehlbetrag).

export interface BufferShortfallInput {
  /** Projizierter Tiefststand (EUR) im Horizont. */
  lowestBalance: number;
  /** Sicherheitspuffer (EUR), unter den der Saldo nicht fallen soll. */
  safetyBuffer: number;
  /** Tage bis zum Tiefststand (ab heute). */
  daysUntilTrough: number;
}

export interface BufferShortfall {
  /** Liegt ein Puffer-Bruch vor? */
  breaches: boolean;
  /** Fehlbetrag am Tiefpunkt (EUR, ≥ 0). */
  deficit: number;
  /** Monate bis zum Tiefpunkt (≥ 1). */
  monthsUntilTrough: number;
  /** Nötige monatliche Einsparung, um den Tiefpunkt auf den Puffer zu heben. */
  monthlyNeeded: number;
}

export function computeBufferShortfall(input: BufferShortfallInput): BufferShortfall {
  const deficit = Math.max(0, input.safetyBuffer - input.lowestBalance);
  const monthsUntilTrough = Math.max(1, Math.ceil(input.daysUntilTrough / 30));
  const monthlyNeeded = Math.ceil(deficit / monthsUntilTrough);
  return { breaches: deficit > 0, deficit, monthsUntilTrough, monthlyNeeded };
}
