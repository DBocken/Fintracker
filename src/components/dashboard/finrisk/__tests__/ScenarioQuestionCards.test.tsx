import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ScenarioQuestionCards from '../ScenarioQuestionCards';
import type { QuestionContext } from '@/lib/finrisk/scenario-questions';

const CTX: QuestionContext = { horizonDays: 180, thresholdAmount: 1000 };

describe('ScenarioQuestionCards', () => {
  it('baut ein base_check-Payload beim Alltag-Prüfen', async () => {
    const user = userEvent.setup();
    const onRun = vi.fn();
    render(<ScenarioQuestionCards ctx={CTX} onRun={onRun} />);

    await user.click(screen.getByRole('button', { name: 'Alltag prüfen' }));
    expect(onRun).toHaveBeenCalledTimes(1);
    expect(onRun.mock.calls[0][0]).toMatchObject({ scenarioType: 'base_check' });
  });

  it('baut ein large_purchase-Payload mit den eingegebenen Werten', async () => {
    const user = userEvent.setup();
    const onRun = vi.fn();
    render(<ScenarioQuestionCards ctx={CTX} onRun={onRun} />);

    // Erste „Durchspielen"-Schaltfläche gehört zur Anschaffungs-Karte (Default 3000 €).
    const runButtons = screen.getAllByRole('button', { name: 'Durchspielen' });
    await user.click(runButtons[0]);

    expect(onRun).toHaveBeenCalledTimes(1);
    const payload = onRun.mock.calls[0][0];
    expect(payload.scenarioType).toBe('large_purchase');
    expect(payload.events[0]).toMatchObject({ eventType: 'expense', amount: 3000 });
  });
});
