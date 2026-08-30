import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test-utils/render';
import RestartOnboardingButton from '../RestartOnboardingButton';

const restartOnboarding = vi.fn();
vi.mock('../../data/onboarding-restart', () => ({
  restartOnboarding: () => restartOnboarding(),
}));

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const echt = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...echt, useNavigate: () => navigate };
});

const showError = vi.fn();
vi.mock('@/utils/toast', () => ({
  showError: (m: string) => showError(m),
  showSuccess: vi.fn(),
}));

describe('RestartOnboardingButton', () => {
  beforeEach(() => {
    restartOnboarding.mockReset();
    restartOnboarding.mockResolvedValue(undefined);
    navigate.mockReset();
    showError.mockReset();
  });

  it('sollte nicht sofort zurücksetzen, sondern nachfragen', async () => {
    // Der Klick führt aus der App heraus — nichts, was man versehentlich tut.
    const user = userEvent.setup();
    renderWithProviders(<RestartOnboardingButton />);
    await user.click(screen.getByRole('button', { name: /Einstieg neu starten/ }));
    expect(restartOnboarding).not.toHaveBeenCalled();
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
  });

  it('sollte in der Rückfrage zusichern, dass keine Daten verloren gehen', async () => {
    // Ohne diesen Satz liest sich „neu starten" wie ein Zurücksetzen der App.
    const user = userEvent.setup();
    renderWithProviders(<RestartOnboardingButton />);
    await user.click(screen.getByRole('button', { name: /Einstieg neu starten/ }));
    expect(await screen.findByText(/bleiben unverändert/)).toBeInTheDocument();
  });

  it('sollte nach der Bestätigung zurücksetzen und in den Fluss führen', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RestartOnboardingButton />);
    await user.click(screen.getByRole('button', { name: /Einstieg neu starten/ }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: /Einstieg neu starten/ }));
    await waitFor(() => expect(restartOnboarding).toHaveBeenCalled());
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/willkommen/sprache'));
  });

  it('sollte beim Abbrechen nichts tun', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RestartOnboardingButton />);
    await user.click(screen.getByRole('button', { name: /Einstieg neu starten/ }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));
    expect(restartOnboarding).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('sollte bei einem Fehler NICHT in den Fluss führen', async () => {
    // Eine Weiterleitung in einen Fluss, dessen Zustand nicht steht, wäre
    // schlimmer als kein Neustart.
    restartOnboarding.mockRejectedValue(new Error('Speicher kaputt'));
    const user = userEvent.setup();
    renderWithProviders(<RestartOnboardingButton />);
    await user.click(screen.getByRole('button', { name: /Einstieg neu starten/ }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: /Einstieg neu starten/ }));
    await waitFor(() => expect(showError).toHaveBeenCalled());
    expect(navigate).not.toHaveBeenCalled();
  });

  it('sollte auf Englisch dieselbe Handlung anbieten', () => {
    renderWithProviders(<RestartOnboardingButton />, { locale: 'en' });
    expect(screen.getByRole('button', { name: /Restart the intro/ })).toBeInTheDocument();
  });
});
