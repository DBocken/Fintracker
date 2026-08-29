import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';
import type { ScenarioAnswerModel } from '../../application/use-scenario-answer';
import type { SzenarioAbsicht } from '@/features/shared/domain/scenario-intent';
import type { ScenarioResult } from '@/lib/finrisk/scenario-payload-types';

/**
 * Der Monte-Carlo-Worker existiert in jsdom nicht — gemockt wird deshalb die
 * application-Schicht als Ganzes. Getestet wird, was die Komponente
 * VERSPRICHT: Chips benennen die Deltas, eine Korrektur rechnet mit der
 * verkleinerten Absicht neu, das unbezifferte Einkommen fragt nach dem
 * Betrag, und das Ergebnis nennt Wahrscheinlichkeit und Delta.
 */
const useScenarioAnswerMock = vi.fn<(absicht: SzenarioAbsicht | null) => ScenarioAnswerModel>();
vi.mock('../../application/use-scenario-answer', () => ({
  useScenarioAnswer: (absicht: SzenarioAbsicht | null) => useScenarioAnswerMock(absicht),
}));

import { SzenarioAntwort } from '../SzenarioAntwort';

const ABSICHT: SzenarioAbsicht = {
  deltas: [
    { art: 'einkommen', abTag: 60 },
    { art: 'flow_entfaellt', konzept: 'auto', stichworte: ['kfz'], abTag: 0 },
    { art: 'einmalausgabe', betrag: 5000, abTag: 99, label: 'urlaub' },
  ],
  schwelle: 'notgroschen',
};

function modell(teil: Partial<ScenarioAnswerModel>): ScenarioAnswerModel {
  return {
    uebersetzung: {
      payload: {
        scenarioId: 'chat-kombination',
        scenarioType: 'custom_combination',
        timeHorizonDays: 219,
        thresholdAmount: 3000,
        events: [],
      },
      aufloesungen: [
        { delta: ABSICHT.deltas[0], unberuecksichtigt: true },
        {
          delta: ABSICHT.deltas[1],
          getroffeneFlows: [{ id: 'c-kfz', name: 'Kfz-Versicherung' }],
          unberuecksichtigt: false,
        },
        { delta: ABSICHT.deltas[2], unberuecksichtigt: false },
      ],
      schwelleEur: 3000,
    },
    result: null,
    isCalculating: false,
    isError: false,
    refetch: vi.fn(),
    ...teil,
  };
}

const ERGEBNIS = {
  deltaEndP50: -412.5,
  breachProbabilities: { '3000': [0, 0.04, 0.08] },
  stressCapacity: [],
  daily: [],
} as unknown as ScenarioResult;

beforeEach(() => useScenarioAnswerMock.mockReset());

describe('SzenarioAntwort', () => {
  it.each([
    ['de' as const, 'Verstanden habe ich', 'entfällt'],
    ['en' as const, 'Here is what I understood', 'goes away'],
  ])('sollte die Deltas als Chips benennen (%s)', (locale, titel, wegfall) => {
    useScenarioAnswerMock.mockReturnValue(modell({}));
    renderWithProviders(<SzenarioAntwort absicht={ABSICHT} />, { locale });

    expect(screen.getByText(titel)).toBeInTheDocument();
    // Der getroffene Posten wird BEIM NAMEN genannt — Transparenz statt
    // stiller Vollständigkeitsbehauptung.
    expect(screen.getByText(new RegExp(wegfall))).toHaveTextContent('Kfz-Versicherung');
  });

  it('sollte das unbezifferte Einkommen nach dem Betrag fragen statt zu raten', () => {
    useScenarioAnswerMock.mockReturnValue(modell({}));
    renderWithProviders(<SzenarioAntwort absicht={ABSICHT} />, { locale: 'de' });

    expect(screen.getByText('Einkommensänderung erkannt — wie viel pro Monat?')).toBeInTheDocument();
    const eingabe = screen.getByLabelText('Betrag pro Monat');
    fireEvent.change(eingabe, { target: { value: '300' } });
    fireEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));

    // Die Korrektur rechnet mit der BEZIFFERTEN Absicht neu.
    const letzte = useScenarioAnswerMock.mock.calls.at(-1)?.[0];
    expect(letzte?.deltas[0]).toMatchObject({ art: 'einkommen', betragProMonat: 300 });
  });

  it('sollte ein entferntes Delta aus der nächsten Rechnung nehmen', () => {
    useScenarioAnswerMock.mockReturnValue(modell({}));
    renderWithProviders(<SzenarioAntwort absicht={ABSICHT} />, { locale: 'de' });

    fireEvent.click(screen.getByRole('button', { name: /auto entfällt.*entfernen/ }));

    const letzte = useScenarioAnswerMock.mock.calls.at(-1)?.[0];
    expect(letzte?.deltas.map((d) => d.art)).toEqual(['einkommen', 'einmalausgabe']);
  });

  it('sollte das Ergebnis mit Puffer-Wahrscheinlichkeit und Delta nennen', () => {
    useScenarioAnswerMock.mockReturnValue(modell({ result: ERGEBNIS }));
    renderWithProviders(<SzenarioAntwort absicht={ABSICHT} />, { locale: 'de' });

    // 1 − 0.08 = 92 %.
    expect(screen.getByText('92 %')).toBeInTheDocument();
    expect(screen.getByText(/Kontostand am Ende des Zeitraums/)).toBeInTheDocument();
  });

  it('[ZUSTAND /fragen:fehler] sollte den Ladefehler der Datengrundlage benennen', () => {
    const refetch = vi.fn();
    useScenarioAnswerMock.mockReturnValue(modell({ isError: true, refetch }));
    renderWithProviders(<SzenarioAntwort absicht={ABSICHT} />, { locale: 'de' });

    expect(screen.getByRole('alert')).toHaveTextContent('Die Datengrundlage ließ sich nicht laden.');
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(refetch).toHaveBeenCalled();
  });

  it('sollte ohne wirksames Delta ehrlich sagen, dass es nichts zu rechnen gibt', () => {
    const m = modell({});
    m.uebersetzung = { payload: null, aufloesungen: [], schwelleEur: undefined };
    useScenarioAnswerMock.mockReturnValue(m);
    renderWithProviders(<SzenarioAntwort absicht={{ deltas: [] }} />, { locale: 'de' });

    expect(
      screen.getByText(/Keine der erkannten Veränderungen ließ sich auf deine Daten anwenden/),
    ).toBeInTheDocument();
  });
});
