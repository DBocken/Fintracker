import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithI18n } from '@/test-utils/render';
import type { ForecastConfig, ForecastInput } from '@/lib/forecast-types';
import * as useAffordabilityModule from '@/hooks/useAffordability';
import AskYourMoney from '../AskYourMoney';

/**
 * [REGRESSION] Der Betragsparser war ein Roh-`parseFloat` mit Komma-Ersetzung
 * (`coding-guide.md` §8 verbietet genau das): getipptes „1.200" (deutscher
 * Tausenderpunkt) wurde als 1,2 gelesen. Der Wächter `check:money-parsing`
 * (WP 2.2) hätte diese Fundstelle vor dem Fix gemeldet.
 */
vi.mock('@/hooks/useAffordability');

const INPUT: ForecastInput = {
  accounts: [
    { id: 'a1', name: 'Girokonto', kind: 'checking', openingBalance: 1000 },
  ],
};

const CONFIG: ForecastConfig = { startDate: '2026-08-01' };

describe('AskYourMoney', () => {
  beforeEach(() => {
    vi.mocked(useAffordabilityModule.useAffordability).mockReturnValue({
      result: null,
      isCalculating: false,
    });
  });

  describe.each([
    { locale: 'de' as const, amountLabel: /Betrag in Euro/, askLabel: /Kann ich mir das leisten\?/ },
    { locale: 'en' as const, amountLabel: /Amount in euros/, askLabel: /Can I afford this\?/ },
  ])('$locale', ({ locale, amountLabel, askLabel }) => {
    it('[REGRESSION] sollte getipptes „1.200" als 1200 statt 1,2 interpretieren', async () => {
      const user = userEvent.setup();
      renderWithI18n(<AskYourMoney input={INPUT} config={CONFIG} />, locale);

      await user.type(screen.getByLabelText(amountLabel), '1.200');
      await user.click(screen.getByRole('button', { name: askLabel }));

      const calls = vi.mocked(useAffordabilityModule.useAffordability).mock.calls;
      const lastGoal = calls[calls.length - 1]?.[2];
      expect(lastGoal).toEqual({ amount: 1200, dayIndex: 30 });
    });

    it('sollte die Frage-Schaltfläche bei ungültigem Betrag deaktiviert lassen', async () => {
      const user = userEvent.setup();
      renderWithI18n(<AskYourMoney input={INPUT} config={CONFIG} />, locale);

      await user.type(screen.getByLabelText(amountLabel), 'abc');

      expect(screen.getByRole('button', { name: askLabel })).toBeDisabled();
    });
  });
});
