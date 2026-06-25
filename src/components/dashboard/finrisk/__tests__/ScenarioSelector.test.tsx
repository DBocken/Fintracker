import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ScenarioSelector from '../ScenarioSelector';
import type { QuestionContext } from '@/lib/finrisk/scenario-questions';

const CTX: QuestionContext = { horizonDays: 180, thresholdAmount: 1000 };

describe('ScenarioSelector', () => {
  describe('Normal Behavior', () => {
    it('rechnet die Basisprüfung sofort beim Klick auf den Alltag-Chip (kein Popup nötig)', async () => {
      const user = userEvent.setup();
      const onRun = vi.fn();
      render(<ScenarioSelector ctx={CTX} onRun={onRun} />);

      await user.click(screen.getByRole('button', { name: /Alltag/ }));

      expect(onRun).toHaveBeenCalledTimes(1);
      expect(onRun.mock.calls[0][0]).toMatchObject({ scenarioType: 'base_check' });
    });

    it('öffnet erst auf Klick ein Popup mit Parametern und baut dann das Payload', async () => {
      const user = userEvent.setup();
      const onRun = vi.fn();
      render(<ScenarioSelector ctx={CTX} onRun={onRun} />);

      // Vor dem Öffnen liegen keine Parameterfelder/Buttons in der DOM.
      expect(screen.queryByRole('button', { name: 'Durchspielen' })).toBeNull();

      await user.click(screen.getByRole('button', { name: /Anschaffung/ }));

      const run = await screen.findByRole('button', { name: 'Durchspielen' });
      await user.click(run);

      expect(onRun).toHaveBeenCalledTimes(1);
      const payload = onRun.mock.calls[0][0];
      expect(payload.scenarioType).toBe('large_purchase');
      expect(payload.events[0]).toMatchObject({ eventType: 'expense', amount: 3000 });
    });

    it('übernimmt geänderte Parameter aus dem Popup ins Payload', async () => {
      const user = userEvent.setup();
      const onRun = vi.fn();
      render(<ScenarioSelector ctx={CTX} onRun={onRun} />);

      await user.click(screen.getByRole('button', { name: /Einkommen/ }));
      const ausfall = await screen.findByLabelText(/Ausfall\/Monat/);
      await user.clear(ausfall);
      await user.type(ausfall, '2500');
      await user.click(screen.getByRole('button', { name: 'Durchspielen' }));

      expect(onRun).toHaveBeenCalledTimes(1);
      const payload = onRun.mock.calls[0][0];
      expect(payload.scenarioType).toBe('income_loss');
      // Tagesbetrag = 2500 / 30,44.
      expect(payload.events[0].amount).toBeCloseTo(2500 / 30.44, 5);
    });
  });

  describe('Edge Cases', () => {
    it('markiert den aktiven Chip (auch bei parametrischer ID mit Suffix)', () => {
      render(
        <ScenarioSelector ctx={CTX} onRun={vi.fn()} activeId="large-purchase-3000-60" />,
      );
      expect(screen.getByRole('button', { name: /Anschaffung/ })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(screen.getByRole('button', { name: /Alltag/ })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    });
  });
});
