import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithI18n } from '@/test-utils/render';
import TutorialInvitation from '../TutorialInvitation';
import type { TutorialRun } from '@/hooks/useTutorialRun';

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

describe('TutorialInvitation', () => {
  it('sollte einladen, wenn ein Kapitel bereitsteht', () => {
    renderWithI18n(<TutorialInvitation run={makeRun()} onDismiss={vi.fn()} />, 'de');
    expect(screen.getByText('Soll ich es dir zeigen?')).toBeInTheDocument();
  });

  it('sollte auf Englisch dieselbe Einladung zeigen', () => {
    renderWithI18n(<TutorialInvitation run={makeRun()} onDismiss={vi.fn()} />, 'en');
    expect(screen.getByText('Shall I show you around?')).toBeInTheDocument();
  });

  it('sollte schweigen, wenn kein Kapitel bereitsteht', () => {
    renderWithI18n(<TutorialInvitation run={makeRun({ upcoming: null })} onDismiss={vi.fn()} />, 'de');
    expect(screen.queryByText('Soll ich es dir zeigen?')).not.toBeInTheDocument();
  });

  it('sollte die Führung starten', async () => {
    const run = makeRun();
    renderWithI18n(<TutorialInvitation run={run} onDismiss={vi.fn()} />, 'de');
    await userEvent.click(screen.getByRole('button', { name: 'Zeig es mir' }));
    expect(run.start).toHaveBeenCalled();
  });

  it('sollte das Wegklicken dem Host melden, ohne die Führung zu starten', async () => {
    // Das Verbergen selbst gehört dem Host (Befund A-2, Hinweisebenen-Präsenz)
    // und ist in TutorialHost.test.tsx abgesichert.
    const run = makeRun();
    const onDismiss = vi.fn();
    renderWithI18n(<TutorialInvitation run={run} onDismiss={onDismiss} />, 'de');
    await userEvent.click(screen.getByRole('button', { name: 'Nicht jetzt' }));
    expect(run.start).not.toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
