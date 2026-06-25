import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ScenarioExplorer from './ScenarioExplorer';
import type { ForecastInput } from '@/lib/forecast-types';
import type { ForecastScenario } from '@/lib/forecast-scenario-types';

const input: ForecastInput = {
  accounts: [{ id: 'giro', name: 'Giro', kind: 'checking', openingBalance: 3000 }],
  recurringFlows: [
    { id: 'salary', name: 'Gehalt', amount: 2800, cadence: 'monthly', anchorDate: '2026-01-01', accountId: 'giro' },
    { id: 'rent', name: 'Miete', amount: -1000, cadence: 'monthly', anchorDate: '2026-01-01', accountId: 'giro' },
  ],
};

const presets: ForecastScenario[] = [
  {
    id: 'preset-job-change',
    name: 'Jobwechsel',
    description: 'Altes Einkommen endet, neues startet.',
    modifiers: [
      { id: 'm1', type: 'income', percentChange: -100, fromDate: '2026-02-01' },
      { id: 'm2', type: 'recurring', amount: 3200, cadence: 'monthly', anchorDate: '2026-03-01', label: 'Neues Gehalt' },
    ],
  },
];

describe('ScenarioExplorer', () => {
  it('personalisiert das neue Gehalt mit dem erkannten Einkommen beim Auswählen', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(
      <ScenarioExplorer presets={presets} input={input} comparison={null} activeId={null} onApply={onApply} />,
    );

    await user.click(screen.getByRole('button', { name: 'Jobwechsel' }));

    // Der recurring-Modifier (neues Gehalt) soll mit 2800 (erkanntes Einkommen)
    // statt dem generischen Preset-Wert 3200 vorbelegt werden.
    const applied = onApply.mock.calls.at(-1)?.[0] as ForecastScenario;
    const newSalary = applied.modifiers.find((m) => m.type === 'recurring');
    expect(newSalary?.amount).toBe(2800);
  });

  it('liefert bei jeder Parameteränderung ein aktualisiertes Szenario (Live-Vorschau)', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(
      <ScenarioExplorer presets={presets} input={input} comparison={null} activeId={null} onApply={onApply} />,
    );

    await user.click(screen.getByRole('button', { name: 'Jobwechsel' }));
    onApply.mockClear();

    // Den Betrag des neuen Gehalts (recurring) auf 4000 ändern.
    const salaryInput = screen.getByDisplayValue('2800');
    await user.clear(salaryInput);
    await user.type(salaryInput, '4000');

    expect(onApply).toHaveBeenCalled();
    const last = onApply.mock.calls.at(-1)?.[0] as ForecastScenario;
    expect(last.modifiers.find((m) => m.type === 'recurring')?.amount).toBe(4000);
  });

  it('setzt die Basis zurück, wenn „Basis" gewählt wird', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(
      <ScenarioExplorer presets={presets} input={input} comparison={null} activeId={null} onApply={onApply} />,
    );

    await user.click(screen.getByRole('button', { name: 'Jobwechsel' }));
    await user.click(screen.getByRole('button', { name: /Basis/i }));

    expect(onApply).toHaveBeenLastCalledWith(null);
  });
});
