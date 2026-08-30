import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test-utils/render';
import { MODIFIERS } from '@/lib/life-situations';
import ModifiersStep from '../steps/ModifiersStep';

const noop = vi.fn();

describe('ModifiersStep', () => {
  it('sollte jeden Umstand als Mehrfachauswahl anbieten', () => {
    renderWithProviders(
      <ModifiersStep selected={[]} onToggle={noop} onContinue={noop} onBack={noop} />,
    );
    expect(screen.getAllByRole('checkbox')).toHaveLength(MODIFIERS.length);
  });

  it('sollte die Lebenssituationen NICHT mit auf diese Seite nehmen', () => {
    renderWithProviders(
      <ModifiersStep selected={[]} onToggle={noop} onContinue={noop} onBack={noop} />,
    );
    expect(screen.queryByText(/Familie mit Kindern/)).toBeNull();
  });

  it('sollte gewählte Umstände als angehakt zeigen', () => {
    renderWithProviders(
      <ModifiersStep selected={['investing']} onToggle={noop} onContinue={noop} onBack={noop} />,
    );
    const angehakt = screen.getAllByRole('checkbox').filter((el) => el.getAttribute('aria-checked') === 'true');
    expect(angehakt).toHaveLength(1);
  });

  it('sollte eine Umschaltung melden', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    renderWithProviders(
      <ModifiersStep selected={[]} onToggle={onToggle} onContinue={noop} onBack={noop} />,
    );
    await user.click(screen.getAllByRole('checkbox')[0]);
    expect(onToggle).toHaveBeenCalledWith(MODIFIERS[0].id);
  });

  it('sollte ohne Auswahl „Nichts davon" anbieten statt eines leeren „Weiter"', () => {
    // Der Knopf sagt, was der Klick bedeutet — „Weiter" ohne Auswahl liesse
    // offen, ob die Frage übersprungen oder verneint wurde.
    renderWithProviders(
      <ModifiersStep selected={[]} onToggle={noop} onContinue={noop} onBack={noop} />,
    );
    expect(screen.getByRole('button', { name: 'Nichts davon' })).toBeInTheDocument();
  });

  it('sollte mit Auswahl „Weiter" anbieten', () => {
    renderWithProviders(
      <ModifiersStep selected={['children']} onToggle={noop} onContinue={noop} onBack={noop} />,
    );
    expect(screen.getByRole('button', { name: 'Weiter' })).toBeInTheDocument();
  });

  it('sollte auf Englisch dieselben Umstände anbieten', () => {
    renderWithProviders(
      <ModifiersStep selected={[]} onToggle={noop} onContinue={noop} onBack={noop} />,
      { locale: 'en' },
    );
    expect(screen.getAllByRole('checkbox')).toHaveLength(MODIFIERS.length);
  });
});
