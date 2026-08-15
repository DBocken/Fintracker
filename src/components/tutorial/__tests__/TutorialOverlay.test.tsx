import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
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

const reduceMotionMock = vi.fn(() => false);
vi.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => reduceMotionMock(),
}));

beforeEach(() => {
  document.body.innerHTML = '';
  navigate.mockClear();
});

afterEach(() => reduceMotionMock.mockReturnValue(false));

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
    nextChapter: null,
    teachable: [],
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
    expect(await screen.findByText('Schritt 1 von 3')).toBeInTheDocument();
  });

  it('sollte auf Englisch dieselbe Führung zeigen', async () => {
    withAnchor('dashboard-flow');
    renderWithProviders(<TutorialOverlay run={makeRun()} />, { locale: 'en' });
    expect(await screen.findByText('Where your money flows')).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
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

describe('TutorialOverlay — Kapitelende: hier aufhören oder weiter', () => {
  it('sollte am Ende eines Kapitels mit Fortsetzung eine echte Wahl anbieten statt automatisch weiterzugehen', async () => {
    // Befund: Am letzten Schritt eines Kapitels mit `remaining > 0` ging die
    // Folge bislang automatisch ins nächste Kapitel über, sobald „Weiter"
    // geklickt wurde — es gab keine Möglichkeit, genau hier aufzuhören.
    withAnchor('dashboard-flow');
    const steps = stepsFor('dashboard');
    renderWithProviders(
      <TutorialOverlay
        run={makeRun({
          stepIndex: steps.length - 1,
          step: steps[steps.length - 1],
          remaining: 1,
          nextChapter: 'city',
        })}
      />,
      { locale: 'de' },
    );

    expect(await screen.findByRole('button', { name: 'Hier beenden' })).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: /Weiter zu .+/ }),
    ).toBeInTheDocument();
    // „Fertig" wäre hier gelogen (es kommt noch ein Kapitel) und „Führung
    // beenden" würde das eben gesehene Kapitel nicht als abgeschlossen zählen.
    expect(screen.queryByRole('button', { name: 'Fertig' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Führung beenden' })).not.toBeInTheDocument();
  });

  it('[REGRESSION] sollte „Hier beenden" das Kapitel abschließen, ohne fortzusetzen', async () => {
    withAnchor('dashboard-flow');
    const steps = stepsFor('dashboard');
    const run = makeRun({
      stepIndex: steps.length - 1,
      step: steps[steps.length - 1],
      remaining: 1,
      nextChapter: 'city',
    });
    renderWithProviders(<TutorialOverlay run={run} />, { locale: 'de' });

    await userEvent.click(await screen.findByRole('button', { name: 'Hier beenden' }));
    expect(run.finishAndEnd).toHaveBeenCalled();
    expect(run.next).not.toHaveBeenCalled();
  });

  it('sollte „Weiter zu …" das nächste Kapitel benennen und normal fortsetzen', async () => {
    withAnchor('dashboard-flow');
    const steps = stepsFor('dashboard');
    const run = makeRun({
      stepIndex: steps.length - 1,
      step: steps[steps.length - 1],
      remaining: 1,
      nextChapter: 'city',
    });
    renderWithProviders(<TutorialOverlay run={run} />, { locale: 'de' });

    const continueButton = await screen.findByRole('button', { name: /Weiter zu .+/ });
    // Nennt tatsächlich das Ziel, nicht nur pauschal „Weiter".
    expect(continueButton).toHaveTextContent('Weiter zu');
    await userEvent.click(continueButton);
    expect(run.next).toHaveBeenCalled();
    expect(run.finishAndEnd).not.toHaveBeenCalled();
  });

  it('sollte bei nur noch einem Schritt weiterhin „Weiter" ohne Ziel-Nennung zeigen', async () => {
    // Innerhalb desselben Kapitels (kein Kapitelende) bleibt der Knopf wie
    // gehabt — nur der Übergang ZWISCHEN Kapiteln bekommt die Wahl.
    withAnchor('dashboard-flow');
    const steps = stepsFor('dashboard');
    renderWithProviders(
      <TutorialOverlay run={makeRun({ stepIndex: 0, step: steps[0], remaining: 1, nextChapter: 'city' })} />,
      { locale: 'de' },
    );
    expect(await screen.findByRole('button', { name: 'Weiter' })).toBeInTheDocument();
  });
});

describe('TutorialOverlay — Klick-Aufforderung (`step.interactive`)', () => {
  it('sollte reine Erklär-Schritte neutral umranden, ohne Klick-Aufblitzen', async () => {
    // `dashboard.flow` hat kein `interactive` — reine Erklärung.
    withAnchor('dashboard-flow');
    renderWithProviders(<TutorialOverlay run={makeRun()} />, { locale: 'de' });
    const hole = await screen.findByTestId('tutorial-hole');
    expect(hole.style.boxShadow).toContain('hsl(var(--primary))');
    expect(hole.style.boxShadow).not.toContain('warning');
    expect(screen.queryByTestId('tutorial-click-cue')).not.toBeInTheDocument();
  });

  it('[REGRESSION] sollte einen Schritt mit Handlungsaufforderung farbig hervorheben und aufblitzen lassen', async () => {
    // Der Befund: „schau her" (Erklärung) und „mach das jetzt" (Suchfeld
    // tippen, Kategorie wählen, Split-Zeile ausfüllen) sahen bislang optisch
    // identisch aus — hier `transactionsFilter.search`, das Suchfeld tippen.
    withAnchor('transactions-search');
    const steps = stepsFor('transactionsFilter');
    const searchStep = steps.find((s) => s.id === 'search');
    expect(searchStep?.interactive).toBe(true);

    renderWithProviders(
      <TutorialOverlay
        run={makeRun({ chapter: 'transactionsFilter', step: searchStep, stepCount: steps.length })}
      />,
      { locale: 'de' },
    );

    const hole = await screen.findByTestId('tutorial-hole');
    expect(hole.style.boxShadow).toContain('hsl(var(--warning))');
    const cue = screen.getByTestId('tutorial-click-cue');
    expect(cue.className).toContain('animate-[tutorial-click-pulse');
  });

  it('sollte das Aufblitzen bei reduzierter Bewegung gar nicht erst rendern', async () => {
    reduceMotionMock.mockReturnValue(true);
    withAnchor('transactions-search');
    const steps = stepsFor('transactionsFilter');
    const searchStep = steps.find((s) => s.id === 'search');

    renderWithProviders(
      <TutorialOverlay
        run={makeRun({ chapter: 'transactionsFilter', step: searchStep, stepCount: steps.length })}
      />,
      { locale: 'de' },
    );

    // Der farbige Rahmen selbst bleibt (er ist kein Bewegungseffekt) — nur
    // das einmalige Aufblitzen entfällt.
    const hole = await screen.findByTestId('tutorial-hole');
    expect(hole.style.boxShadow).toContain('hsl(var(--warning))');
    expect(screen.queryByTestId('tutorial-click-cue')).not.toBeInTheDocument();
  });
});

describe('TutorialOverlay — Premium-Schritt (`step.premium`)', () => {
  it('sollte eine Premium-Funktion in Premium-Farbe umranden statt in Warn- oder Neutralfarbe', async () => {
    // Der Unterschied trägt die ganze Aussage: „mach das jetzt" (Warnfarbe)
    // und „das gibt es, aber nur mit Pro" (Premium-Farbe) sind zwei
    // verschiedene Botschaften und dürfen nicht gleich aussehen.
    withAnchor('split-teaser');
    const steps = stepsFor('transactionSplitPremium');
    const premiumStep = steps.find((s) => s.id === 'teaser');
    expect(premiumStep?.premium).toBe(true);

    renderWithProviders(
      <TutorialOverlay
        run={makeRun({ chapter: 'transactionSplitPremium', step: premiumStep, stepCount: steps.length })}
      />,
      { locale: 'de' },
    );

    const hole = await screen.findByTestId('tutorial-hole');
    expect(hole.style.boxShadow).toContain('hsl(var(--premium))');
    expect(hole.style.boxShadow).not.toContain('warning');
    // Eine Premium-Erwähnung ist keine Handlungsaufforderung — kein Aufblitzen.
    expect(screen.queryByTestId('tutorial-click-cue')).not.toBeInTheDocument();
  });

  it('sollte den Schritt sichtbar als Premium kennzeichnen', async () => {
    withAnchor('split-teaser');
    const steps = stepsFor('transactionSplitPremium');
    const premiumStep = steps.find((s) => s.id === 'teaser');

    renderWithProviders(
      <TutorialOverlay
        run={makeRun({ chapter: 'transactionSplitPremium', step: premiumStep, stepCount: steps.length })}
      />,
      { locale: 'de' },
    );

    expect(await screen.findByTestId('tutorial-premium-badge')).toHaveTextContent('Pro');
  });

  it('sollte gewöhnliche Schritte nicht als Premium kennzeichnen', async () => {
    withAnchor('dashboard-flow');
    renderWithProviders(<TutorialOverlay run={makeRun()} />, { locale: 'de' });
    await screen.findByTestId('tutorial-hole');
    expect(screen.queryByTestId('tutorial-premium-badge')).not.toBeInTheDocument();
  });
});
