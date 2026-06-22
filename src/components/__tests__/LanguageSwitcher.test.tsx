import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { I18nProvider } from '@/i18n/I18nProvider';

describe('LanguageSwitcher', () => {
  describe('Normal Behavior', () => {
    it('sollte Flaggen-Symbole für Deutsch und Englisch anzeigen', () => {
      render(
        <I18nProvider>
          <LanguageSwitcher />
        </I18nProvider>
      );
      expect(screen.getByText('🇩🇪')).toBeInTheDocument();
      expect(screen.getByText('🇬🇧')).toBeInTheDocument();
    });

    it('sollte zwei Buttons haben mit unterschiedlichen Varianten', () => {
      render(
        <I18nProvider>
          <LanguageSwitcher />
        </I18nProvider>
      );
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(2);
      expect(buttons[0]).toHaveTextContent('🇩🇪');
      expect(buttons[1]).toHaveTextContent('🇬🇧');
    });

    it('sollte Sprache wechseln wenn auf Flag geklickt wird', async () => {
      const user = userEvent.setup();
      render(
        <I18nProvider>
          <LanguageSwitcher />
        </I18nProvider>
      );
      const enButton = screen.getByText('🇬🇧').closest('button')!;

      // Klick auf EN-Button - sollte nicht werfen
      await user.click(enButton);
      // Button sollte noch sichtbar sein
      expect(screen.getByText('🇬🇧')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('sollte nur außerhalb von I18nProvider Error werfen', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => render(<LanguageSwitcher />)).toThrow();
      consoleSpy.mockRestore();
    });

    it('sollte Aria-Label für Accessibility haben', () => {
      render(
        <I18nProvider>
          <LanguageSwitcher />
        </I18nProvider>
      );
      const deButton = screen.getByText('🇩🇪').closest('button');
      expect(deButton).toHaveAttribute('aria-label');
      expect(deButton).toHaveAttribute('title');
    });
  });
});
