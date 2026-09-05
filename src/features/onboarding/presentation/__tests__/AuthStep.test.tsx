import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test-utils/render';
import AuthStep from '../steps/AuthStep';

const signInWithOAuth = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { signInWithOAuth: (...args: unknown[]) => signInWithOAuth(...args) } },
}));

// Das Supabase-Widget wird hier nicht mitgerendert: Geprüft wird, DASS es
// erst nach der Wahl erscheint, nicht wie es innen aussieht.
vi.mock('@supabase/auth-ui-react', () => ({
  Auth: () => <div data-testid="supabase-auth-widget" />,
}));

describe('AuthStep', () => {
  beforeEach(() => {
    signInWithOAuth.mockReset();
    signInWithOAuth.mockResolvedValue({ data: { url: null }, error: null });
  });

  it('sollte beide Wege als eigene Karten anbieten', () => {
    renderWithProviders(<AuthStep onBack={vi.fn()} />);
    expect(screen.getByText('Mit Google fortfahren')).toBeInTheDocument();
    expect(screen.getByText('Mit E-Mail und Passwort')).toBeInTheDocument();
  });

  it('sollte das Anmeldeformular erst nach der Wahl einblenden', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AuthStep onBack={vi.fn()} />);
    expect(screen.queryByTestId('supabase-auth-widget')).toBeNull();
    await user.click(screen.getByRole('button', { name: /E-Mail/ }));
    expect(screen.getByTestId('supabase-auth-widget')).toBeInTheDocument();
  });

  it('sollte Google unmittelbar starten', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AuthStep onBack={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /Google/ }));
    expect(signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google' }),
    );
  });

  it('sollte einen gescheiterten Anmeldestart benennen', async () => {
    signInWithOAuth.mockResolvedValue({ data: null, error: new Error('kaputt') });
    const user = userEvent.setup();
    renderWithProviders(<AuthStep onBack={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /Google/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/konnte nicht gestartet werden/);
  });

  it('sollte den Rückweg zum anonymen Start anbieten', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    renderWithProviders(<AuthStep onBack={onBack} />);
    await user.click(screen.getByRole('button', { name: 'Doch lieber anonym starten' }));
    expect(onBack).toHaveBeenCalled();
  });

  it('sollte zusichern, dass spätere Zugangsdienste den Datenstand erhalten', () => {
    renderWithProviders(<AuthStep onBack={vi.fn()} />);
    // Alltags-Register (Standard); die Fachsprache sagt „Dein Datenstand
    // bleibt erhalten" — dieselbe Zusage, anderes Wort.
    expect(screen.getByText(/bleibt dabei erhalten/)).toBeInTheDocument();
  });

  it('sollte auf Englisch dieselben Wege anbieten', () => {
    renderWithProviders(<AuthStep onBack={vi.fn()} />, { locale: 'en' });
    expect(screen.getByText('Continue with Google')).toBeInTheDocument();
    expect(screen.getByText('Continue with email and password')).toBeInTheDocument();
  });
});
