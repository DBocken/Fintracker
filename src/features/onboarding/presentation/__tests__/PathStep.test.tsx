import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test-utils/render';
import PathStep from '../steps/PathStep';

vi.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => true,
  useMotionSafe: (props: unknown) => props,
}));

describe('PathStep', () => {
  it('sollte beide Möglichkeiten mit ihrer Einschränkung benennen', () => {
    renderWithProviders(<PathStep onChoose={vi.fn()} />);
    expect(screen.getByText('Du hast zwei Möglichkeiten.')).toBeInTheDocument();
    expect(screen.getByText('Anonym')).toBeInTheDocument();
    // Die Einschränkung steht beim Namen, nicht als spätere Überraschung.
    // Geprüft im Alltags-Register — dem Standard, den ein neuer Nutzer sieht.
    expect(screen.getByText(/Verbindung zu deiner Bank brauchst du ein Konto/)).toBeInTheDocument();
    expect(screen.getByText('Angemeldet')).toBeInTheDocument();
    expect(screen.getByText(/kostenpflichtige Zusätze dazubuchen/)).toBeInTheDocument();
  });

  it('sollte dieselbe Einschränkung auch in der Fachsprache benennen', () => {
    renderWithProviders(<PathStep onChoose={vi.fn()} />, { wording: 'technical' });
    expect(screen.getByText(/Banksynchronisierung benötigt ein Konto/)).toBeInTheDocument();
  });

  it('sollte den anonymen Weg melden', async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    renderWithProviders(<PathStep onChoose={onChoose} />);
    await user.click(screen.getByRole('button', { name: /Anonym/ }));
    // Die Wahl wird erst gemeldet, wenn das Abgewählte verweht ist.
    await waitFor(() => expect(onChoose).toHaveBeenCalledWith('anonymous'));
  });

  it('sollte den Konto-Weg melden', async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    renderWithProviders(<PathStep onChoose={onChoose} />);
    await user.click(screen.getByRole('button', { name: /Angemeldet/ }));
    // Die Wahl wird erst gemeldet, wenn das Abgewählte verweht ist.
    await waitFor(() => expect(onChoose).toHaveBeenCalledWith('account'));
  });

  it('sollte auf Englisch dieselbe Wahl anbieten', () => {
    renderWithProviders(<PathStep onChoose={vi.fn()} />, { locale: 'en' });
    expect(screen.getByText('You have two options.')).toBeInTheDocument();
    expect(screen.getByText('Anonymous')).toBeInTheDocument();
  });
});
