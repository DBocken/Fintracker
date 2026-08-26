/**
 * Asynchrone Auswertung einer Zielrückrechnung (Welle 3).
 *
 * Dieselbe Arbeitsteilung wie bei der Szenario-Antwort (WP-H): Das Register
 * bleibt rein und liefert nur die gestellte FRAGE (`art: 'zielrueckrechnung'`);
 * hier läuft die Suche. Sie ist teuer — eine Binärsuche über den Betrag mit je
 * einem Monte-Carlo-Lauf pro Schritt — und hat in einer synchronen `antwort()`
 * nichts verloren.
 *
 * **Kein zweiter Apparat**: Gerechnet wird mit `hoechsterTragbarerBetrag` bzw.
 * `evaluateAffordability` aus `lib/finrisk/affordability.ts`, denselben
 * Funktionen, die „Frag dein Geld" auf `/liquidity` benutzt. Die Zielfrage ist
 * die Umkehrung, nicht eine zweite Definition von „tragbar".
 *
 * Anders als die Szenario-Antwort läuft die Suche NICHT im Worker: Sie
 * braucht die Rückgabe mehrfach nacheinander (jeder Suchschritt hängt am
 * vorigen), und ein Worker-Roundtrip je Schritt wäre teurer als die Rechnung
 * selbst. Der Zuschnitt der Läufe hält sie in derselben Grössenordnung wie
 * die Chat-Simulation.
 */
import { useMemo } from 'react';
import { useForecast } from '@/hooks/useForecast';
import { useForecastOverrides } from '@/hooks/useForecastOverrides';
import {
  evaluateAffordability,
  hoechsterTragbarerBetrag,
  type AffordabilityOption,
} from '@/lib/finrisk/affordability';
import type { Zielfrage } from '@/lib/question-registry';

/**
 * Zuschnitt der Suche. Bewusst kleiner als die Chat-Simulation (300): Hier
 * laufen ACHT Bewertungen nacheinander, nicht eine — und die gesuchte Grösse
 * ist eine Grenze, keine Wahrscheinlichkeit auf zwei Stellen.
 */
const ZIEL_MONTE_CARLO = { trials: 120, seed: 1 } as const;

export interface GoalAnswerModel {
  /** Gefundene Obergrenze (EUR) — nur bei `art: 'obergrenze'`. */
  obergrenze: number | null;
  /**
   * Nötige monatliche Rate (EUR) — nur bei `art: 'sparrate'`. `null`, wenn
   * das Ziel auch mit Sparen nicht erreichbar ist; dann sagt das die Fläche,
   * statt eine Zahl zu nennen, die nichts hält.
   */
  sparrate: number | null;
  /**
   * Das Ziel ist schon OHNE Änderung tragbar (nur `sparrate`). Dann ist
   * „0 € monatlich" die richtige, aber missverständliche Antwort — die
   * Fläche formuliert sie als Entwarnung.
   */
  bereitsTragbar: boolean;
  /**
   * Schon vor der Ausgabe unter der Zielsicherheit (nur `obergrenze`). Dann
   * ist nicht die Anschaffung das Problem, sondern der Stand davor.
   */
  bereitsUnterDeckung: boolean;
  /** Erreichte Erfolgswahrscheinlichkeit der gefundenen Antwort (0..1). */
  sicherheit: number | null;
  isCalculating: boolean;
  isError: boolean;
  refetch: () => void;
}

const LEER: Omit<GoalAnswerModel, 'isCalculating' | 'isError' | 'refetch'> = {
  obergrenze: null,
  sparrate: null,
  bereitsTragbar: false,
  bereitsUnterDeckung: false,
  sicherheit: null,
};

export function useGoalAnswer(ziel: Zielfrage | null): GoalAnswerModel {
  const { overrides } = useForecastOverrides();
  const { input, isLoading, isError, refetch } = useForecast();

  const config = useMemo(
    () => ({
      months: overrides.months,
      safetyBuffer: overrides.safetyBuffer,
      bufferBasis: overrides.bufferBasis,
    }),
    [overrides.months, overrides.safetyBuffer, overrides.bufferBasis],
  );

  const ergebnis = useMemo(() => {
    if (!ziel || !input) return LEER;

    if (ziel.art === 'obergrenze') {
      const gefunden = hoechsterTragbarerBetrag(input, config, ziel.inTagen, {
        monteCarlo: ZIEL_MONTE_CARLO,
      });
      return {
        ...LEER,
        obergrenze: gefunden.bereitsUnterDeckung ? null : gefunden.betrag,
        bereitsUnterDeckung: gefunden.bereitsUnterDeckung,
        sicherheit: gefunden.successProbability,
      };
    }

    if (ziel.betrag === undefined) return LEER;

    const menu = evaluateAffordability(
      input,
      config,
      { amount: ziel.betrag, dayIndex: ziel.inTagen },
      { monteCarlo: ZIEL_MONTE_CARLO },
    );
    if (menu.affordableAsIs) {
      return { ...LEER, bereitsTragbar: true, sicherheit: menu.baseSuccess };
    }
    // Der `earn`-Hebel IST die gesuchte Sparrate: das kleinste monatliche
    // Plus, das die Zielsicherheit erreicht. Ihn nachzubauen hiesse, dieselbe
    // Binärsuche ein zweites Mal zu schreiben.
    const sparen = menu.options.find(
      (o: AffordabilityOption) => o.detail.kind === 'earn',
    );
    return {
      ...LEER,
      sparrate: sparen?.detail.kind === 'earn' ? sparen.detail.perMonth : null,
      sicherheit: sparen?.successProbability ?? menu.baseSuccess,
    };
  }, [ziel, input, config]);

  return {
    ...ergebnis,
    isCalculating: ziel !== null && isLoading,
    isError,
    refetch,
  };
}
