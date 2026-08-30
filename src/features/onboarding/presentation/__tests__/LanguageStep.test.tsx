import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test-utils/render';
import { INACTIVE_LOCALES, SUPPORTED_LOCALES } from '@/i18n/locale';
import { LOCALE_OPTIONS } from '@/i18n/locale-options';
import LanguageStep from '../steps/LanguageStep';

// Die Auflösung wird hier nicht geprüft (das tut DissolveTransition.test),
// aber sie darf den Klick nicht verschlucken: ohne Canvas-Kontext in jsdom
// läuft sie sofort durch.
vi.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => true,
  useMotionSafe: (props: unknown) => props,
}));

describe('LanguageStep', () => {
  it('sollte jede unterstützte Sprache mit Flagge und Endonym anbieten', () => {
    renderWithProviders(<LanguageStep onChoose={vi.fn()} />);
    for (const option of LOCALE_OPTIONS) {
      expect(screen.getByText(option.label)).toBeInTheDocument();
      expect(screen.getByText(option.flag)).toBeInTheDocument();
    }
    expect(screen.getAllByRole('button')).toHaveLength(SUPPORTED_LOCALES.length);
  });

  it('sollte den Gruß in JEDER Sprache zeigen, nicht nur in der aktiven', () => {
    // Der Sinn der Fläche: Sie muss lesbar sein, ohne dass man die gerade
    // eingestellte Sprache versteht.
    renderWithProviders(<LanguageStep onChoose={vi.fn()} />);
    expect(screen.getByText('Willkommen')).toBeInTheDocument();
    expect(screen.getByText('Welcome')).toBeInTheDocument();
    expect(screen.getByText('Добро пожаловать')).toBeInTheDocument();
  });

  it('sollte inaktive Sprachen nicht anbieten', () => {
    renderWithProviders(<LanguageStep onChoose={vi.fn()} />);
    for (const inaktiv of INACTIVE_LOCALES) {
      expect(screen.queryByText(new RegExp(inaktiv))).toBeNull();
    }
  });

  it('sollte die gewählte Sprache melden', async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    renderWithProviders(<LanguageStep onChoose={onChoose} />);
    await user.click(screen.getByRole('button', { name: /English/ }));
    // Die Wahl wird erst gemeldet, wenn das Abgewählte verweht ist.
    await waitFor(() => expect(onChoose).toHaveBeenCalledWith('en'));
  });

  it('sollte auf Englisch dieselbe Auswahl anbieten', () => {
    renderWithProviders(<LanguageStep onChoose={vi.fn()} />, { locale: 'en' });
    expect(screen.getByText('Choose your language')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(SUPPORTED_LOCALES.length);
  });
});
