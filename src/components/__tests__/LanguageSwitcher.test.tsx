import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { I18nProvider } from '@/i18n/I18nProvider';

function renderSwitcher() {
  return render(
    <I18nProvider>
      <LanguageSwitcher />
    </I18nProvider>,
  );
}

describe('LanguageSwitcher', () => {
  describe('Normal Behavior', () => {
    it('sollte ein kompaktes Popup mit einem einzigen Trigger sein', () => {
      renderSwitcher();
      // Nur ein Trigger im geschlossenen Zustand — spart Platz im Mobil-Header.
      const triggers = screen.getAllByRole('button');
      expect(triggers).toHaveLength(1);
      expect(triggers[0]).toHaveAttribute('aria-label');
      expect(triggers[0]).toHaveAttribute('title');
    });

    it('sollte beim Öffnen Deutsch und English anbieten', async () => {
      const user = userEvent.setup();
      renderSwitcher();
      await user.click(screen.getByRole('button', { name: /sprache wählen/i }));

      expect(await screen.findByRole('menuitem', { name: /deutsch wählen/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /english wählen/i })).toBeInTheDocument();
    });

    it('sollte die Sprache wechseln, wenn ein Eintrag gewählt wird', async () => {
      const user = userEvent.setup();
      renderSwitcher();
      const trigger = () => screen.getByRole('button', { name: /sprache wählen/i });

      // Explizit beide Richtungen wählen — unabhängig von der Standardsprache:
      // der Trigger-Titel spiegelt die jeweils aktive Sprache.
      await user.click(trigger());
      await user.click(await screen.findByRole('menuitem', { name: /deutsch wählen/i }));
      expect(trigger()).toHaveAttribute('title', 'Deutsch');

      await user.click(trigger());
      await user.click(await screen.findByRole('menuitem', { name: /english wählen/i }));
      expect(trigger()).toHaveAttribute('title', 'English');
    });
  });

  describe('Edge Cases', () => {
    it('sollte außerhalb von I18nProvider einen Error werfen', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => render(<LanguageSwitcher />)).toThrow();
      consoleSpy.mockRestore();
    });

    it('sollte ein Aria-Label für Accessibility am Trigger haben', () => {
      renderSwitcher();
      const trigger = screen.getByRole('button', { name: /sprache wählen/i });
      expect(trigger).toHaveAttribute('aria-label');
      expect(trigger).toHaveAttribute('title');
    });
  });
});
