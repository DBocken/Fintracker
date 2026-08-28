/**
 * Asynchrone Auswertung einer Szenario-Antwort (WP-H).
 *
 * Das Register bleibt rein: `szenario.kombination` liefert nur die erkannte
 * Absicht (`art: 'szenario'`). DIESER Hook übersetzt sie in ein
 * `ScenarioPayload` (reine Funktion `baueSzenarioPayload`) und lässt die
 * bestehende Monte-Carlo-Engine im Worker rechnen (`useScenarioRisk` — kein
 * zweiter Apparat). Ein Lauf je abgeschickter Frage bzw. je Chip-Korrektur;
 * das ist die „teure" Aktion, die `aufwand: 'teuer'` aus der Tipp-Schleife
 * heraushalten will.
 *
 * Fehler der Datengrundlage werden benannt (`isError`) — die Fläche zeigt
 * dann den Fehlerzustand statt einer leeren Behauptung (§9.1).
 */
import { useMemo } from 'react';
import { useForecast } from '@/hooks/useForecast';
import { useForecastOverrides } from '@/hooks/useForecastOverrides';
import { useScenarioRisk } from '@/hooks/useScenarioRisk';
import { baueSzenarioPayload, type SzenarioPayloadErgebnis } from '@/features/shared/domain/scenario-absicht-payload';
import type { SzenarioAbsicht } from '@/features/shared/domain/scenario-intent';
import type { ScenarioResult } from '@/lib/finrisk/scenario-payload-types';

export interface ScenarioAnswerModel {
  /** Payload + je Delta die Auflösung (getroffene Posten, Unberücksichtigtes). */
  uebersetzung: SzenarioPayloadErgebnis | null;
  result: ScenarioResult | null;
  /** true, solange der Worker rechnet ODER die Datengrundlage noch lädt. */
  isCalculating: boolean;
  isError: boolean;
  refetch: () => void;
}

/** Bewusst schlanker als die Liquiditäts-Fläche (500): Der Chat braucht die
 * Kennzahlen, nicht die volle Heatmap-Auflösung — und mit festem Seed bleibt
 * das Ergebnis reproduzierbar. */
const CHAT_MONTE_CARLO = { trials: 300, seed: 1 } as const;

export function useScenarioAnswer(absicht: SzenarioAbsicht | null): ScenarioAnswerModel {
  const { overrides } = useForecastOverrides();
  const { input, isLoading, isError, refetch } = useForecast();

  const uebersetzung = useMemo(
    () =>
      absicht
        ? baueSzenarioPayload(absicht, {
            flows: input?.recurringFlows ?? [],
            safetyBuffer: overrides.safetyBuffer,
          })
        : null,
    [absicht, input, overrides.safetyBuffer],
  );

  const config = useMemo(
    () => ({
      months: overrides.months,
      safetyBuffer: overrides.safetyBuffer,
      bufferBasis: overrides.bufferBasis,
    }),
    [overrides.months, overrides.safetyBuffer, overrides.bufferBasis],
  );

  const { result, isCalculating } = useScenarioRisk(
    input,
    config,
    uebersetzung?.payload ?? null,
    { monteCarlo: CHAT_MONTE_CARLO },
  );

  return {
    uebersetzung,
    result,
    isCalculating: isCalculating || (absicht !== null && isLoading),
    isError,
    refetch,
  };
}
