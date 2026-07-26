import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithI18n } from '@/test-utils/render';
import TutorialInvitation from '../TutorialInvitation';
import type { TutorialRun } from '@/features/tutorial/application/useTutorialRun';

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
    renderWithI18n(<TutorialInvitation run={makeRun()} />, 'de');
    expect(screen.getByText('Soll ich es dir zeigen?')).toBeInTheDocument();
  });

  it('sollte auf Englisch dieselbe Einladung zeigen', () => {
    renderWithI18n(<TutorialInvitation run={makeRun()} />, 'en');
    expect(screen.getByText('Shall I show you around?')).toBeInTheDocument();
  });

  it('sollte schweigen, wenn kein Kapitel bereitsteht', () => {
    renderWithI18n(<TutorialInvitation run={makeRun({ upcoming: null })} />, 'de');
    expect(screen.queryByText('Soll ich es dir zeigen?')).not.toBeInTheDocument();
  });

  it('sollte die Führung starten', async () => {
    const run = makeRun();
    renderWithI18n(<TutorialInvitation run={run} />, 'de');
    await userEvent.click(screen.getByRole('button', { name: 'Zeig es mir' }));
    expect(run.start).toHaveBeenCalled();
  });

  it('sollte sich wegklicken lassen, ohne die Führung zu starten', async () => {
    const run = makeRun();
    renderWithI18n(<TutorialInvitation run={run} />, 'de');
    await userEvent.click(screen.getByRole('button', { name: 'Nicht jetzt' }));
    expect(run.start).not.toHaveBeenCalled();
    expect(screen.queryByText('Soll ich es dir zeigen?')).not.toBeInTheDocument();
  });
});
