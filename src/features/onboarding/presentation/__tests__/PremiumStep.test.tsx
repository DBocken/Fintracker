import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test-utils/render';
import PremiumStep from '../steps/PremiumStep';

const noop = vi.fn();

describe('PremiumStep', () => {
  it('sollte Kostenloses und Premium gegenüberstellen', () => {
    renderWithProviders(
      <PremiumStep anonymous={false} onContinue={noop} onBack={noop} onOpenBilling={noop} />,
    );
    expect(screen.getByText('Immer kostenlos')).toBeInTheDocument();
    expect(screen.getByText('Mit Premium')).toBeInTheDocument();
  });

  it('sollte anonym benennen, dass Buchen ein Konto braucht', () => {
    renderWithProviders(
      <PremiumStep anonymous onContinue={noop} onBack={noop} onOpenBilling={noop} />,
    );
    expect(screen.getByText(/nur mit einem Konto/)).toBeInTheDocument();
  });

  it('sollte angemeldet keinen Konto-Hinweis zeigen', () => {
    renderWithProviders(
      <PremiumStep anonymous={false} onContinue={noop} onBack={noop} onOpenBilling={noop} />,
    );
    expect(screen.queryByText(/nur mit einem Konto/)).toBeNull();
  });

  it('sollte weiterführen, ohne einen Kauf zu verlangen', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    const onOpenBilling = vi.fn();
    renderWithProviders(
      <PremiumStep
        anonymous={false}
        onContinue={onContinue}
        onBack={noop}
        onOpenBilling={onOpenBilling}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Weiter' }));
    expect(onContinue).toHaveBeenCalled();
    expect(onOpenBilling).not.toHaveBeenCalled();
  });

  it('sollte die Preise auf Wunsch öffnen', async () => {
    const user = userEvent.setup();
    const onOpenBilling = vi.fn();
    renderWithProviders(
      <PremiumStep
        anonymous={false}
        onContinue={noop}
        onBack={noop}
        onOpenBilling={onOpenBilling}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Preise ansehen' }));
    expect(onOpenBilling).toHaveBeenCalled();
  });

  it('sollte auf Englisch dieselbe Gegenüberstellung zeigen', () => {
    renderWithProviders(
      <PremiumStep anonymous={false} onContinue={noop} onBack={noop} onOpenBilling={noop} />,
      { locale: 'en' },
    );
    expect(screen.getByText('Always free')).toBeInTheDocument();
    expect(screen.getByText('With Premium')).toBeInTheDocument();
  });
});
