/**
 * Registereinträge rund um Kontostand-Vorschau und „bis zum Gehalt" (WP-F.3).
 *
 * Alle drei sind bewusst **Verweise** (`aufwand: 'teuer'`, `art: 'verweis'`),
 * dieselbe Bauform wie `leistbarkeit.anschaffung`: Der tagesgenaue Forecast
 * (`calculateDeterministicForecast`) und die Bis-zum-Gehalt-Rechnung
 * (`computeDisposableUntilPayday`) existieren als reine Funktionen — aber
 * ihre EINGABEN entstehen in einer Service-Schicht (`buildForecastInput`:
 * Konten, Flows, Gehaltserkennung, Overrides), die eine Feature-`domain`
 * nicht rufen darf und deren Ergebnis für jede Chat-Frage nachzubauen die
 * Fläche wäre, die beim Tippen einfriert. Der Verweis öffnet die Fläche, die
 * genau diese Zahl bereits live rechnet — mit dem ehrlichen Satz, WO
 * gerechnet wird, statt einer hier nachgebauten Zweitrechnung, die driften
 * kann.
 */
import type { QuestionEntry } from '@/lib/question-registry';

const verweis = (
  id: string,
  ausloeser: readonly string[],
  verstaerker: readonly string[],
  aussageKey: string,
  deepLink: string,
  deepLinkLabelKey: string,
): QuestionEntry => ({
  id,
  slots: { erforderlich: [], optional: [] },
  ausloeser,
  verstaerker,
  needs: [],
  aufwand: 'teuer',
  antwort: () => ({
    art: 'verweis',
    wert: null,
    anzahl: 0,
    aussage: { key: aussageKey, params: {} },
    deepLink,
    deepLinkArt: 'kontext',
    deepLinkLabelKey,
  }),
});

export const questions: readonly QuestionEntry[] = [
  verweis(
    'forecast.monatsende',
    ['financeQuestions.trigger.kontostand'],
    ['financeQuestions.trigger.voraussichtlich', 'financeQuestions.trigger.reicht'],
    'financeQuestions.answer.forecastMonatsende',
    '/liquidity',
    'financeQuestions.showForecast',
  ),
  verweis(
    'forecast.horizont',
    ['financeQuestions.trigger.horizont'],
    ['financeQuestions.trigger.voraussichtlich', 'financeQuestions.trigger.kontostand'],
    'financeQuestions.answer.forecastHorizont',
    '/liquidity',
    'financeQuestions.showForecast',
  ),
  verweis(
    'verfuegbar.bisGehalt',
    ['financeQuestions.trigger.gehalt'],
    ['financeQuestions.trigger.bisGehalt'],
    'financeQuestions.answer.bisGehalt',
    '/coach',
    'financeQuestions.showCoach',
  ),
];
