import { describe, expect, it, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '@/test-utils/render';
import TutorialOverlay from '../TutorialOverlay';
import type { TutorialRun } from '@/hooks/useTutorialRun';
import { stepsFor } from '@/lib/tutorial-steps';

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

beforeEach(() => {
  document.body.innerHTML = '';
  navigate.mockClear();
});

/** Lauf-Attrappe: die Zustandsmaschine hat einen eigenen Test. */
function makeRun(overrides: Partial<TutorialRun> = {}): TutorialRun {
  const steps = stepsFor('dashboard');
  return {
    active: true,
    chapter: 'dashboard',
    step: steps[0],
    stepIndex: 0,
    stepCount: steps.length,
    upcoming: null,
    start: vi.fn(),
    next: vi.fn(),
    back: vi.fn(),
    end: vi.fn(),
    ...overrides,
  };
}

function withAnchor(id: string) {
  const el = document.createElement('div');
  el.setAttribute('data-tour-id', id);
  document.body.appendChild(el);
  return el;
}

describe('TutorialOverlay', () => {
  it('sollte Titel und Erklärung des Schritts zeigen', async () => {
    withAnchor('dashboard-flow');
    renderWithProviders(<TutorialOverlay run={makeRun()} />, { locale: 'de' });
    expect(await screen.findByText('Wohin dein Geld fließt')).toBeInTheDocument();
  });

  it('sollte den Fortschritt benennen statt ihn zu verschweigen', async () => {
    withAnchor('dashboard-flow');
    renderWithProviders(<TutorialOverlay run={makeRun()} />, { locale: 'de' });
    expect(await screen.findByText('Schritt 1 von 2')).toBeInTheDocument();
  });

  it('sollte auf Englisch dieselbe Führung zeigen', async () => {
    withAnchor('dashboard-flow');
    renderWithProviders(<TutorialOverlay run={makeRun()} />, { locale: 'en' });
    expect(await screen.findByText('Where your money flows')).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
  });

  it('sollte im letzten Schritt „Fertig" statt „Weiter" anbieten', async () => {
    withAnchor('dashboard-flow');
    const steps = stepsFor('dashboard');
    renderWithProviders(
      <TutorialOverlay run={makeRun({ stepIndex: steps.length - 1, step: steps[steps.length - 1] })} />,
      { locale: 'de' },
    );
    expect(await screen.findByRole('button', { name: 'Fertig' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Weiter' })).not.toBeInTheDocument();
  });

  it('sollte im ersten Schritt kein „Zurück" anbieten', async () => {
    withAnchor('dashboard-flow');
    renderWithProviders(<TutorialOverlay run={makeRun()} />, { locale: 'de' });
    await screen.findByText('Wohin dein Geld fließt');
    expect(screen.queryByRole('button', { name: 'Zurück' })).not.toBeInTheDocument();
  });

  it('sollte weiterschalten und beenden können', async () => {
    withAnchor('dashboard-flow');
    const run = makeRun();
    renderWithProviders(<TutorialOverlay run={run} />, { locale: 'de' });
    await userEvent.click(await screen.findByRole('button', { name: 'Weiter' }));
    expect(run.next).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Führung beenden' }));
    expect(run.end).toHaveBeenCalled();
  });

  it('sollte ohne vorhandenen Anker trotzdem erklären statt zu blockieren', async () => {
    // Kein Element mit data-tour-id im DOM — genau der Fall nach einem
    // Refactor, der den Marker verloren hat.
    renderWithProviders(<TutorialOverlay run={makeRun()} />, { locale: 'de' });
    expect(await screen.findByText('Wohin dein Geld fließt')).toBeInTheDocument();
    expect(screen.queryByTestId('tutorial-hole')).not.toBeInTheDocument();
  });

  it('sollte nichts zeigen, wenn kein Lauf aktiv ist', () => {
    renderWithProviders(
      <TutorialOverlay run={makeRun({ active: false, step: null })} />,
      { locale: 'de' },
    );
    expect(screen.queryByText('Wohin dein Geld fließt')).not.toBeInTheDocument();
  });

  it('sollte zur Route des Schritts führen, statt raten zu lassen', async () => {
    withAnchor('city-canvas');
    const steps = stepsFor('city');
    renderWithProviders(
      <TutorialOverlay run={makeRun({ chapter: 'city', step: steps[0], stepCount: steps.length })} />,
      { locale: 'de' },
    );
    await screen.findByText('Deine Ausgaben als Stadt');
    expect(navigate).toHaveBeenCalledWith('/city');
  });
});
