import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MemoryRouter } from 'react-router-dom';

import { renderWithI18n } from '@/test-utils/render';
import type { TutorialRun } from '@/hooks/useTutorialRun';
import { useTutorialPresence } from '../tutorial-presence';

let runMock: TutorialRun;

function makeRun(overrides: Partial<TutorialRun> = {}): TutorialRun {
  return {
    active: false,
    chapter: null,
    step: null,
    stepIndex: 0,
    stepCount: 0,
    upcoming: 'transactions',
    teachable: ['transactions'],
    start: vi.fn(),
    next: vi.fn(),
    back: vi.fn(),
    end: vi.fn(),
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

/**
 * Der Host entscheidet seit dem Seitensprung-Befund anhand der geöffneten
 * Seite — deshalb rendert jeder Test an einem konkreten Ort.
 */
function renderHost(pathname = '/dashboard', locale: 'de' | 'en' = 'de') {
  return renderWithI18n(
    <MemoryRouter initialEntries={[pathname]}>
      <TutorialHost>
        <Probe />
      </TutorialHost>
    </MemoryRouter>,
    locale,
  );
}

beforeEach(() => {
  runMock = makeRun();
});

describe('TutorialHost — Hinweisebenen-Präsenz (Befund A-2)', () => {
  it('sollte die Präsenz melden, solange die Einladung sichtbar ist', () => {
    renderHost();
    expect(screen.getByText('Soll ich es dir zeigen?')).toBeInTheDocument();
    expect(screen.getByTestId('probe')).toHaveTextContent('true');
  });

  it('[REGRESSION] sollte nach dem Wegklicken die Einladung verbergen und die Präsenz freigeben', async () => {
    renderHost();
    await userEvent.click(screen.getByRole('button', { name: 'Nicht jetzt' }));
    expect(screen.queryByText('Soll ich es dir zeigen?')).not.toBeInTheDocument();
    expect(screen.getByTestId('probe')).toHaveTextContent('false');
  });

  it('sollte ohne bereitstehendes Kapitel keine Präsenz melden', () => {
    runMock = makeRun({ upcoming: null, teachable: [] });
    renderHost();
    expect(screen.getByTestId('probe')).toHaveTextContent('false');
  });

  it('sollte während einer laufenden Führung Präsenz melden (Overlay statt Einladung)', () => {
    runMock = makeRun({ active: true });
    renderHost();
    expect(screen.getByTestId('tutorial-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('probe')).toHaveTextContent('true');
  });
});

describe('TutorialHost — welches Kapitel angeboten wird', () => {
  it('sollte auf der Seite eines Kapitels genau dieses anbieten', async () => {
    runMock = makeRun({ teachable: ['transactions', 'city'], upcoming: 'transactions' });
    renderHost('/transactions');
    expect(screen.getByText('Eine kurze Führung durch diesen Bereich.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Zeig es mir' }));
    expect(runMock.start).toHaveBeenCalledWith('transactions');
  });

  it('[REGRESSION] sollte das Kapitel der geöffneten Seite dem Lehrplan-Anfang vorziehen', async () => {
    // Der Befund: Auf /city stand die Einladung „Führung durch diesen
    // Bereich" und startete die Buchungen — die Seite sprang weg, und
    // erklärt wurde etwas anderes als das, worauf man gerade sah.
    runMock = makeRun({ teachable: ['transactions', 'city'], upcoming: 'transactions' });
    renderHost('/city');
    expect(screen.getByText('Eine kurze Führung durch diesen Bereich.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Zeig es mir' }));
    expect(runMock.start).toHaveBeenCalledWith('city');
  });

  it('[REGRESSION] sollte auf einer fremden Seite das Ziel benennen statt „diesen Bereich" zu behaupten', async () => {
    runMock = makeRun({ teachable: ['transactions'], upcoming: 'transactions' });
    renderHost('/settings');
    expect(screen.queryByText('Eine kurze Führung durch diesen Bereich.')).not.toBeInTheDocument();
    // Der Sprung wird angekündigt und benennt den Bereich, in den er führt.
    expect(screen.getByText(/Buchungen/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Zeig es mir' }));
    expect(runMock.start).toHaveBeenCalledWith('transactions');
  });

  it('sollte den angekündigten Sprung auch auf Englisch benennen', () => {
    runMock = makeRun({ teachable: ['transactions'], upcoming: 'transactions' });
    renderHost('/settings', 'en');
    expect(screen.getByText(/Transactions/)).toBeInTheDocument();
  });
});
