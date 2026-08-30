import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test-utils/render';
import GreetingStep, { firstNameOf } from '../steps/GreetingStep';

describe('firstNameOf', () => {
  it('sollte den Vornamen aus einem vollen Namen nehmen', () => {
    expect(firstNameOf('Dana Muster')).toBe('Dana');
    expect(firstNameOf('  Dana  ')).toBe('Dana');
  });
});

describe('GreetingStep', () => {
  it('sollte einen Angemeldeten mit Vornamen begrüßen', () => {
    renderWithProviders(
      <GreetingStep accountName="Dana Muster" initialName="" onContinue={vi.fn()} />,
    );
    expect(screen.getByText('Hallo Dana')).toBeInTheDocument();
    expect(screen.queryByLabelText('Dein Name')).toBeNull();
  });

  it('sollte anonym nach der Anrede fragen und die Zusage danebenstellen', () => {
    renderWithProviders(<GreetingStep accountName={null} initialName="" onContinue={vi.fn()} />);
    expect(screen.getByLabelText('Dein Name')).toBeInTheDocument();
    // Die Zusage ist der Grund, warum die Frage zumutbar ist — sie gehört
    // neben die Eingabe, nicht ins Kleingedruckte.
    expect(screen.getByText(/keine Rückübertragung an den Server/)).toBeInTheDocument();
  });

  it('sollte den eingegebenen Namen melden', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    renderWithProviders(
      <GreetingStep accountName={null} initialName="" onContinue={onContinue} />,
    );
    await user.type(screen.getByLabelText('Dein Name'), 'Dana');
    await user.click(screen.getByRole('button', { name: 'Weiter' }));
    expect(onContinue).toHaveBeenCalledWith('Dana');
  });

  it('sollte ohne Namen fortfahren können', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    renderWithProviders(
      <GreetingStep accountName={null} initialName="" onContinue={onContinue} />,
    );
    await user.click(screen.getByRole('button', { name: 'Ohne Namen fortfahren' }));
    expect(onContinue).toHaveBeenCalledWith('');
  });

  it('sollte auf Englisch dieselbe Frage stellen', () => {
    renderWithProviders(<GreetingStep accountName={null} initialName="" onContinue={vi.fn()} />, {
      locale: 'en',
    });
    expect(screen.getByLabelText('Your name')).toBeInTheDocument();
  });
});
