import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SimulationWizard, { deriveWizardSuggestions } from './SimulationWizard';
import type { ForecastInput } from '@/lib/forecast-types';
import type { ForecastScenario } from '@/lib/forecast-scenario-types';

const input: ForecastInput = {
  accounts: [
    { id: 'giro', name: 'Giro', kind: 'checking', openingBalance: 2500 },
    { id: 'reserve', name: 'Tagesgeld', kind: 'savings', openingBalance: 5000 },
  ],
  recurringFlows: [
    { id: 'salary', name: 'Gehalt', amount: 3000, cadence: 'monthly', anchorDate: '2026-01-01', accountId: 'giro', confidence: 1 },
    { id: 'rent', name: 'Miete', amount: -1000, cadence: 'monthly', anchorDate: '2026-01-01', accountId: 'giro', confidence: 1 },
  ],
  variableExpenses: [
    { category: 'Lebensmittel', monthlyAmount: 600, confidence: 0.75, volatility: 0.2 },
  ],
};

const scenarios: ForecastScenario[] = [{
  id: 'preset-inflation',
  name: 'Inflation +10 %',
  modifiers: [{ id: 'm1', type: 'variable', percentChange: 10 }],
}];

describe('deriveWizardSuggestions', () => {
  it('begründet Vorschläge aus vorhandenen Finanzdaten', () => {
    const result = deriveWizardSuggestions(input);
    expect(result.operatingBalance).toBe(2500);
    expect(result.availableBalance).toBe(7500);
    expect(result.monthlyIncome).toBe(3000);
    expect(result.monthlyFixedExpenses).toBe(1000);
    expect(result.monthlyVariableExpenses).toBe(600);
    expect(result.recommendedBuffer).toBe(800);
    expect(result.reasons.join(' ')).toContain('zwei Wochen');
  });
});

describe('SimulationWizard', () => {
  it('führt in Alltagssprache zur Monte-Carlo-Konfiguration', async () => {
    const user = userEvent.setup();
    const onScenarioSelect = vi.fn();
    const onMonteCarloChange = vi.fn();
    const onSafetyBufferChange = vi.fn();
    render(
      <SimulationWizard
        input={input}
        scenarios={scenarios}
        activeScenarioId={null}
        safetyBuffer={1000}
        onSafetyBufferChange={onSafetyBufferChange}
        onScenarioSelect={onScenarioSelect}
        onMonteCarloChange={onMonteCarloChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: /leben teurer/i }));
    await user.click(screen.getByRole('button', { name: /weiter/i }));
    expect(screen.getByText(/bereits für dich übernommen/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /weiter/i }));
    expect(screen.getByText(/wie vorsichtig/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /simulation starten/i }));

    expect(onScenarioSelect).toHaveBeenCalledWith('preset-inflation');
    expect(onSafetyBufferChange).toHaveBeenCalledWith(1000);
    expect(onMonteCarloChange).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));
    expect(screen.getByText(/simulation ist vorbereitet/i)).toBeInTheDocument();
  });
});
