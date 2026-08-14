import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';

import { MemoryRouter } from 'react-router-dom';

import { renderWithI18n } from '@/test-utils/render';
import type { TutorialRun } from '@/hooks/useTutorialRun';
import { useTutorialPresence } from '../tutorial-presence';
import { useTutorialControl } from '@/hooks/useTutorialControl';

let runMock: TutorialRun;

function makeRun(overrides: Partial<TutorialRun> = {}): TutorialRun {
  return {
    active: false,
    chapter: null,
    step: null,
    stepIndex: 0,
    stepCount: 0,
    upcoming: 'transactions',
    nextChapter: null,
    teachable: ['transactions'],
    remaining: 0,
    start: vi.fn(),
    startSeries: vi.fn(),
    next: vi.fn(),
    back: vi.fn(),
    end: vi.fn(),
    finishAndEnd: vi.fn(),
    ...overrides,
  };
}

vi.mock('@/hooks/useTutorialRun', () => ({
  useTutorialRun: () => runMock,
}));

// Das Overlay hat eigene Tests; hier zählt nur, WANN der Host es zeigt.
vi.mock('../TutorialOverlay', () => ({ default: () => <div data-testid="tutorial-overlay" /> }));

import TutorialHost from '../TutorialHost';

/** Sichtbarkeits-Sonde: liest die Präsenz so, wie es der Coach-Streifen tut. */
function Probe() {
  const { hintVisible } = useTutorialPresence();
  return <div data-testid="probe">{String(hintVisible)}</div>;
}

/** Sonde für den Kontrollzugriff — prüft, was der Host nach außen reicht. */
function ControlProbe() {
  const control = useTutorialControl();
  return (
    <button type="button" data-testid="start-all" onClick={control.startAll}>
      startAll
    </button>
  );
}

function renderHost(pathname = '/dashboard', locale: 'de' | 'en' = 'de') {
  return renderWithI18n(
    <MemoryRouter initialEntries={[pathname]}>
      <TutorialHost>
        <Probe />
        <ControlProbe />
      </TutorialHost>
    </MemoryRouter>,
    locale,
  );
}

beforeEach(() => {
  runMock = makeRun();
});

describe('TutorialHost — Hinweisebenen-Präsenz (Befund A-2)', () => {
  it('sollte ohne laufende Führung keine Präsenz melden', () => {
    renderHost();
    expect(screen.getByTestId('probe')).toHaveTextContent('false');
  });

  it('sollte während einer laufenden Führung Präsenz melden', () => {
    runMock = makeRun({ active: true });
    renderHost();
    expect(screen.getByTestId('tutorial-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('probe')).toHaveTextContent('true');
  });
});

describe('TutorialHost — kein Einladungsstreifen mehr', () => {
  // docs/tutorial-sequence.md, Schritt 7: Mit Kopfzeilen-Knopf und der Frage
  // im Onboarding gibt es zwei dauerhafte Einstiege — ein zusätzlich über
  // jeder Seite schwebendes Angebot wäre ein dritter, redundanter Weg.
  it('[REGRESSION] sollte nie „Soll ich es dir zeigen?" anzeigen, auch wenn ein Kapitel bereitsteht', () => {
    runMock = makeRun({ teachable: ['transactions'], upcoming: 'transactions' });
    renderHost('/transactions');
    expect(screen.queryByText('Soll ich es dir zeigen?')).not.toBeInTheDocument();
  });
});

describe('TutorialHost — Kontrollzugriff', () => {
  it('sollte startAll auf startSeries mit den lehrbaren Kapiteln abbilden', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    runMock = makeRun({ teachable: ['transactions', 'city'] });
    renderHost();
    await userEvent.click(screen.getByTestId('start-all'));
    expect(runMock.startSeries).toHaveBeenCalledWith(['transactions', 'city']);
  });
});
