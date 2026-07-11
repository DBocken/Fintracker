import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider } from '@/i18n/I18nProvider';
import { AccountFormDialog } from '../AccountFormDialog';
import type { Account } from '@/types';

// Radix' Select misst seine Breite über ResizeObserver, den jsdom nicht kennt.
globalThis.ResizeObserver ||= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

function renderDialog(
  { account = null, onSave = vi.fn() }: { account?: Account | null; onSave?: (data: Partial<Account>) => void } = {},
  locale: 'de' | 'en' = 'de',
) {
  render(
    <I18nProvider initialLocale={locale}>
      <AccountFormDialog
        open
        onOpenChange={() => {}}
        account={account}
        accounts={[]}
        onSave={onSave}
        isLoading={false}
      />
    </I18nProvider>,
  );
  return { onSave };
}

function makeAccount(overrides: Partial<Account>): Account {
  return {
    id: 'acc-1',
    user_id: 'local',
    name: 'Konto',
    type: 'checking',
    currency: 'EUR',
    color: '#1d5c54',
    icon: '🏦',
    is_budget_pool_member: true,
    order_index: 0,
    ...overrides,
  };
}

describe('AccountFormDialog – Geschäftskonto-Switch', () => {
  describe('Normal Behavior', () => {
    it('sollte den Geschäftskonto-Switch anzeigen (Deutsch)', () => {
      renderDialog({}, 'de');
      expect(screen.getByText('Geschäftskonto')).toBeInTheDocument();
    });

    it('sollte den Geschäftskonto-Switch anzeigen (Englisch)', () => {
      renderDialog({}, 'en');
      expect(screen.getByText('Business account')).toBeInTheDocument();
    });

    it('sollte is_business=true speichern, wenn der Switch aktiviert wird', () => {
      const onSave = vi.fn();
      renderDialog({ onSave });

      fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Firmenkonto' } });
      fireEvent.click(screen.getByRole('switch', { name: 'Geschäftskonto' }));
      fireEvent.submit(screen.getByRole('switch', { name: 'Geschäftskonto' }).closest('form')!);

      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ is_business: true }));
    });

    it('sollte den Switch aus einem bestehenden Geschäftskonto vorbelegen', () => {
      renderDialog({ account: makeAccount({ is_business: true }) });
      expect(screen.getByRole('switch', { name: 'Geschäftskonto' })).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('Edge Cases', () => {
    it('sollte Bestandskonten ohne Flag als privat vorbelegen (undefined ≙ false)', () => {
      renderDialog({ account: makeAccount({}) });
      expect(screen.getByRole('switch', { name: 'Geschäftskonto' })).toHaveAttribute('aria-checked', 'false');
    });

    it('sollte is_business=false speichern, wenn der Switch aus bleibt', () => {
      const onSave = vi.fn();
      renderDialog({ onSave });

      fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Privatkonto' } });
      fireEvent.submit(screen.getByRole('switch', { name: 'Geschäftskonto' }).closest('form')!);

      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ is_business: false }));
    });
  });
});
