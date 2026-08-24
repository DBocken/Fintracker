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
  {
    /**
     * Kombinierte Was-wäre-wenn-Frage (WP-H): „Auto verkaufen,
     * Gehaltserhöhung in 2 Monaten, 5k Urlaub im Dezember — ohne den
     * Notgroschen anzugreifen?" Der Router extrahiert die Veränderungs-Menge
     * deterministisch (`scenario-intent.ts`) und routet bei ≥ 2 Deltas (oder
     * 1 Delta + Schwelle) direkt hierher — die Auslöser unten sind nur der
     * ZWEITE Weg für ausdrückliche Formulierungen („was wäre wenn ich …").
     *
     * `antwort()` bleibt rein: Sie reicht die Absicht als `art: 'szenario'`
     * durch; die Monte-Carlo-Rechnung läuft asynchron in der Fläche
     * (`use-scenario-answer.ts`) über die bestehende Engine.
     *
     * Abgrenzung zur Leistbarkeit: KEINE Deltas ⇒ `leistbarkeit.anschaffung`
     * (ein Betrag, heutige Welt); Deltas ⇒ hierher (veränderte Welt).
     */
    id: 'szenario.kombination',
    slots: { erforderlich: [], optional: ['betrag'] },
    ausloeser: ['financeQuestions.trigger.szenarioKombination'],
    needs: [],
    aufwand: 'teuer',
    beantwortetSzenarien: true,
    nimmtSzenarioAbsicht: true,
    antwort: (slots) => ({
      art: 'szenario',
      wert: null,
      anzahl: slots.szenario?.deltas.length ?? 0,
      aussage: {
        key: 'financeQuestions.answer.szenarioKombination',
        params: { anzahl: slots.szenario?.deltas.length ?? 0 },
      },
      szenario: slots.szenario,
      deepLink: '/liquidity',
      deepLinkArt: 'kontext',
      deepLinkLabelKey: 'financeQuestions.showForecast',
    }),
  },
];
