import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import { I18nProvider } from '@/i18n/I18nProvider';
import TutorialOverlay from '../TutorialOverlay';
import type { TutorialRun } from '@/hooks/useTutorialRun';
import { stepsFor } from '@/lib/tutorial-steps';

/**
 * Anders als `TutorialOverlay.test.tsx` läuft hier ein **echter** Router: Der
 * Befund „springt wahllos auf andere Seiten" lässt sich nur mit einer
 * Adresse prüfen, die sich wirklich ändert — mit einem `useNavigate`-Spion
 * bleibt der Ort stehen, und genau die Rückkopplung war das Problem.
 */

beforeEach(() => {
  document.body.innerHTML = '';
});

function makeRun(overrides: Partial<TutorialRun> = {}): TutorialRun {
  const steps = stepsFor('city');
  return {
    active: true,
    chapter: 'city',
    step: steps[0],
    stepIndex: 0,
    stepCount: steps.length,
    upcoming: null,
    teachable: [],
    remaining: 0,
    start: vi.fn(),
    startSeries: vi.fn(),
    next: vi.fn(),
    back: vi.fn(),
    end: vi.fn(),
    ...overrides,
  };
}

/** Zeigt den aktuellen Ort an und bietet einen Weg fort — wie die Navigation. */
function Elsewhere() {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <div>
      <span data-testid="ort">{location.pathname}</span>
      <button type="button" onClick={() => navigate('/settings')}>
        weg hier
      </button>
    </div>
  );
}

function renderOverlay(run: TutorialRun, at = '/dashboard') {
  return render(
    <I18nProvider initialLocale="de">
      <MemoryRouter initialEntries={[at]}>
        <Elsewhere />
        <Routes>
          <Route path="*" element={<TutorialOverlay run={run} />} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe('TutorialOverlay — Führung und Ort', () => {
  it('sollte einmal zur Route des Schritts führen und dort bleiben', async () => {
    renderOverlay(makeRun());
    await waitFor(() => expect(screen.getByTestId('ort')).toHaveTextContent('/city'));
  });

  it('[REGRESSION] sollte die Führung beenden, wenn der Nutzer den Bereich selbst verlässt', async () => {
    // Vorher zog der Effekt bei jedem Ortswechsel zurück auf die Route des
    // Schritts: Ein Klick in der Navigation sprang sofort wieder zurück. Eine
    // Führung, die man nicht verlassen kann, ist ein Käfig.
    const run = makeRun();
    renderOverlay(run);
    await waitFor(() => expect(screen.getByTestId('ort')).toHaveTextContent('/city'));

    await userEvent.click(screen.getByRole('button', { name: 'weg hier' }));

    await waitFor(() => expect(run.end).toHaveBeenCalled());
    expect(screen.getByTestId('ort')).toHaveTextContent('/settings');
  });
});

describe('TutorialOverlay — der Rahmen zeigt nie auf das Falsche', () => {
  it('[REGRESSION] sollte den Rahmen sofort lösen, wenn der neue Schritt seinen Anker (noch) nicht hat', async () => {
    // `useAnchorRect` sucht den neuen Anker eine Sekunde lang. Bis dahin stand
    // der alte Rahmen weiter auf dem Element des vorigen Schritts — nach einem
    // Seitenwechsel also auf einer Stelle der alten Seite.
    const el = document.createElement('div');
    el.setAttribute('data-tour-id', 'city-canvas');
    document.body.appendChild(el);

    const steps = stepsFor('city');
    const run = makeRun();
    const { rerender } = renderOverlay(run);
    await waitFor(() => expect(screen.getByTestId('tutorial-hole')).toBeInTheDocument());

    const next = makeRun({ chapter: 'dashboard', step: stepsFor('dashboard')[0], stepCount: 2 });
    expect(next.step?.anchor).not.toBe(steps[0].anchor);

    rerender(
      <I18nProvider initialLocale="de">
        <MemoryRouter initialEntries={['/dashboard']}>
          <Elsewhere />
          <Routes>
            <Route path="*" element={<TutorialOverlay run={next} />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    );

    expect(screen.queryByTestId('tutorial-hole')).not.toBeInTheDocument();
  });
});
