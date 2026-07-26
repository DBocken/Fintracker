import { describe, expect, it, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '@/test-utils/render';
import TutorialOverlay from '../TutorialOverlay';
import type { TutorialRun } from '@/features/tutorial/application/useTutorialRun';
import { stepsFor } from '@/features/tutorial/domain/tutorial-steps';

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


describe('TutorialOverlay — zum Ziel führen', () => {
  it('sollte das Ziel ins Bild scrollen, bevor es erklärt wird', async () => {
    const el = withAnchor('dashboard-flow');
    const scrollIntoView = vi.fn();
    el.scrollIntoView = scrollIntoView;

    renderWithProviders(<TutorialOverlay run={makeRun()} />, { locale: 'de' });

    // Worauf gezeigt wird, muss sichtbar sein — sonst zeigt die Führung ins
    // Nichts, sobald der Anker weiter unten auf der Seite liegt.
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
    expect(scrollIntoView.mock.calls[0][0]).toMatchObject({ block: 'center' });
  });

  it('sollte öffnen, was der Schritt braucht, statt darum zu bitten', async () => {
    const opener = withAnchor('transactions-first-row');
    const click = vi.fn();
    opener.addEventListener('click', click);
    withAnchor('transaction-detail');

    const steps = stepsFor('transactionDetails');
    const panelStep = steps.find((st) => st.openAnchor);
    expect(panelStep).toBeDefined();

    renderWithProviders(
      <TutorialOverlay
        run={makeRun({ chapter: 'transactionDetails', step: panelStep, stepCount: steps.length })}
      />,
      { locale: 'de' },
    );

    // Die Führung klickt selbst — sonst hinge die Folge daran, ob der Nutzer
    // im richtigen Moment das Richtige trifft.
    await waitFor(() => expect(click).toHaveBeenCalled());
  });

  it('sollte am Ziel hängen statt als Blatt von unten zu erscheinen', async () => {
    // Ein Bottom Sheet nähme die untere Bildschirmhälfte — also oft genau das
    // Element, von dem der Schritt spricht. `data-side` beweist, dass die
    // Erklärung an einem Anker positioniert ist und nicht am Bildschirmrand.
    withAnchor('dashboard-flow');
    renderWithProviders(<TutorialOverlay run={makeRun()} />, { locale: 'de' });
    const text = await screen.findByText('Wohin dein Geld fließt');
    expect(text.closest('[data-side]')).not.toBeNull();
  });
});

describe('TutorialOverlay — [REGRESSION] Fehler aus dem Praxistest', () => {
  it('sollte die Erklärung über das Ziel legen, wenn dieses unten steht', async () => {
    // Auf schmalen Geräten legte sich das Popup genau über das Element, von
    // dem der Schritt sprach — in der Detailansicht waren die Kategorien
    // dadurch verdeckt. Radix weicht dem Bildschirmrand aus, kennt aber das
    // Loch nicht; die Seite muss deshalb aus der Ankerlage kommen.
    const el = withAnchor('dashboard-flow');
    el.getBoundingClientRect = () =>
      ({ top: window.innerHeight - 60, left: 0, width: 300, height: 40 }) as DOMRect;

    renderWithProviders(<TutorialOverlay run={makeRun()} />, { locale: 'de' });
    const text = await screen.findByText('Wohin dein Geld fließt');
    await waitFor(() => {
      expect(text.closest('[data-side]')?.getAttribute('data-side')).toBe('top');
    });
  });

  it('sollte darunter bleiben, wenn das Ziel oben steht', async () => {
    const el = withAnchor('dashboard-flow');
    el.getBoundingClientRect = () => ({ top: 20, left: 0, width: 300, height: 40 }) as DOMRect;

    renderWithProviders(<TutorialOverlay run={makeRun()} />, { locale: 'de' });
    const text = await screen.findByText('Wohin dein Geld fließt');
    expect(text.closest('[data-side]')?.getAttribute('data-side')).toBe('bottom');
  });

  it('sollte einen geschlossenen Bereich wieder öffnen statt weiterzumachen', async () => {
    // Schließt der Nutzer die Detailansicht mittendrin, verschwindet das Ziel.
    // Vorher lief die Führung stumpf weiter und zeigte auf nichts.
    const opener = withAnchor('transactions-first-row');
    const detail = withAnchor('detail-category');
    const click = vi.fn(() => {
      // Der Klick stellt das Ziel wieder her.
      detail.setAttribute('data-tour-id', 'detail-category');
    });
    opener.addEventListener('click', click);

    const steps = stepsFor('transactionDetails');
    const categoryStep = steps.find((st) => st.id === 'category');
    expect(categoryStep?.openAnchor).toBeDefined();

    renderWithProviders(
      <TutorialOverlay
        run={makeRun({ chapter: 'transactionDetails', step: categoryStep, stepCount: steps.length })}
      />,
      { locale: 'de' },
    );
    await screen.findByText('Kategorie und Unterkategorie sind schon gesetzt');

    // Nutzer schließt die Detailansicht.
    detail.remove();
    await waitFor(() => expect(click).toHaveBeenCalled(), { timeout: 2000 });
  });
});
