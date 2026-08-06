import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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

beforeEach(() => {
  runMock = makeRun();
});

describe('TutorialHost — Hinweisebenen-Präsenz (Befund A-2)', () => {
  it('sollte die Präsenz melden, solange die Einladung sichtbar ist', () => {
    renderWithI18n(
      <TutorialHost>
        <Probe />
      </TutorialHost>,
      'de',
    );
    expect(screen.getByText('Soll ich es dir zeigen?')).toBeInTheDocument();
    expect(screen.getByTestId('probe')).toHaveTextContent('true');
  });

  it('[REGRESSION] sollte nach dem Wegklicken die Einladung verbergen und die Präsenz freigeben', async () => {
    renderWithI18n(
      <TutorialHost>
        <Probe />
      </TutorialHost>,
      'de',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Nicht jetzt' }));
    expect(screen.queryByText('Soll ich es dir zeigen?')).not.toBeInTheDocument();
    expect(screen.getByTestId('probe')).toHaveTextContent('false');
  });

  it('sollte ohne bereitstehendes Kapitel keine Präsenz melden', () => {
    runMock = makeRun({ upcoming: null });
    renderWithI18n(
      <TutorialHost>
        <Probe />
      </TutorialHost>,
      'de',
    );
    expect(screen.getByTestId('probe')).toHaveTextContent('false');
  });

  it('sollte während einer laufenden Führung Präsenz melden (Overlay statt Einladung)', () => {
    runMock = makeRun({ active: true });
    renderWithI18n(
      <TutorialHost>
        <Probe />
      </TutorialHost>,
      'de',
    );
    expect(screen.getByTestId('tutorial-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('probe')).toHaveTextContent('true');
  });
});
