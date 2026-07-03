import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { RecurringFlowOverrideForm } from '../ForecastPlanner';
import type { RecurringFlow } from '@/lib/forecast-types';
import type { ForecastOverrides } from '@/services/forecast-overrides-service';

const flow = (over: Partial<RecurringFlow> = {}): RecurringFlow => ({
  id: 'f1',
  name: 'Miete',
  amount: -900,
  cadence: 'monthly',
  anchorDate: '2026-07-01',
  accountId: 'acc1',
  ...over,
});

const overrides = { recurringFlowOverrides: {} } as unknown as ForecastOverrides;

describe('RecurringFlowOverrideForm – Tabellen-Darstellung (Prinzip 8)', () => {
  it('sollte die Zahlungen als Tabelle mit Spalten rendern (statt Boxen)', () => {
    render(
      <RecurringFlowOverrideForm
        recurringFlows={[flow(), flow({ id: 'f2', name: 'Gehalt', amount: 2597 })]}
        overrides={overrides}
        onChange={() => {}}
      />,
    );
    const table = screen.getByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'Zahlung' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Betrag' })).toBeInTheDocument();
    expect(within(table).getByText('Miete')).toBeInTheDocument();
    expect(within(table).getByText('Gehalt')).toBeInTheDocument();
  });

  it('[REGRESSION] Bearbeiten klappt eine Inline-Zeile mit Betrag/End-Datum auf', () => {
    render(
      <RecurringFlowOverrideForm
        recurringFlows={[flow()]}
        overrides={overrides}
        onChange={() => {}}
      />,
    );
    expect(screen.queryByText('End-Datum (optional)')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    // Aufgeklappte Inline-Zeile zeigt die Bearbeitungsfelder.
    expect(screen.getByText('End-Datum (optional)')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton')).toBeInTheDocument();
  });

  it('sollte auto-deaktivierte Verträge als „beendet" markieren und die Checkbox sperren', () => {
    render(
      <RecurringFlowOverrideForm
        recurringFlows={[flow({ disabled: true })]}
        overrides={overrides}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('beendet')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });
});
