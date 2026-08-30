import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test-utils/render';
import { LIFE_SITUATIONS, MODIFIERS } from '@/lib/life-situations';
import SituationStep from '../steps/SituationStep';

vi.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => true,
  useMotionSafe: (props: unknown) => props,
}));

describe('SituationStep', () => {
  it('sollte alle Lebenssituationen zur Auswahl anbieten', () => {
    renderWithProviders(<SituationStep onChoose={vi.fn()} onSkip={vi.fn()} />);
    // Ein Knopf je Situation, dazu „Später entscheiden".
    expect(screen.getAllByRole('button')).toHaveLength(LIFE_SITUATIONS.length + 1);
  });

  it('sollte die Umstände NICHT mit auf diese Seite nehmen', () => {
    // Der Dichtebruch, der den Umbau ausgelöst hat: 10 + 7 Auswahlelemente
    // in zwei Auswahllogiken auf einer Seite.
    renderWithProviders(<SituationStep onChoose={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.queryByText(MODIFIERS[0].id)).toBeNull();
  });

  it('sollte jede Situation mit einer kurzen Erklärung beschreiben', () => {
    renderWithProviders(<SituationStep onChoose={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByText(/Taschengeld, Nebenjob oder Ausbildungsvergütung/)).toBeInTheDocument();
  });

  it('sollte die Situation als Ziel benennen, nicht als Statusetikett', () => {
    // Niemand klickt freiwillig auf „verschuldet".
    renderWithProviders(<SituationStep onChoose={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Schulden abbauen/ })).toBeInTheDocument();
  });

  it('sollte die Wahl unmittelbar melden, ohne zweiten Knopf', async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    renderWithProviders(<SituationStep onChoose={onChoose} onSkip={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /Familie mit Kindern/ }));
    await waitFor(() => expect(onChoose).toHaveBeenCalledWith('family'));
  });

  it('sollte übersprungen werden können', async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn();
    renderWithProviders(<SituationStep onChoose={vi.fn()} onSkip={onSkip} />);
    await user.click(screen.getByRole('button', { name: 'Später entscheiden' }));
    expect(onSkip).toHaveBeenCalled();
  });

  it('sollte auf Englisch dieselbe Auswahl anbieten', () => {
    renderWithProviders(<SituationStep onChoose={vi.fn()} onSkip={vi.fn()} />, { locale: 'en' });
    expect(screen.getAllByRole('button')).toHaveLength(LIFE_SITUATIONS.length + 1);
  });
});
