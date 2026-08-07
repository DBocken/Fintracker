import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { I18nProvider } from '@/i18n/I18nProvider';
import { RecurringFlowOverrideForm } from '../forecast/ForecastForms';
import type { RecurringFlow } from '@/lib/forecast-types';
import type { ForecastOverrides } from '@/lib/forecast-types';

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
      <I18nProvider>
        <RecurringFlowOverrideForm
          recurringFlows={[flow(), flow({ id: 'f2', name: 'Gehalt', amount: 2597 })]}
          overrides={overrides}
          onChange={() => {}}
        />
      </I18nProvider>,
    );
    const table = screen.getByRole('table');
    expect(within(table).getByRole('columnheader', { name: /Zahlung|Payment/ })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: /Betrag|Amount/ })).toBeInTheDocument();
    expect(within(table).getByText('Miete')).toBeInTheDocument();
    expect(within(table).getByText('Gehalt')).toBeInTheDocument();
  });

  it('[REGRESSION] Bearbeiten klappt eine Inline-Zeile mit Betrag/End-Datum auf', () => {
    render(
      <I18nProvider>
        <RecurringFlowOverrideForm
          recurringFlows={[flow()]}
          overrides={overrides}
          onChange={() => {}}
        />
      </I18nProvider>,
    );
    expect(screen.queryByText(/End-Datum|End date/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Bearbeiten|Edit/ }));
    // Aufgeklappte Inline-Zeile zeigt die Bearbeitungsfelder.
    expect(screen.getByText(/End-Datum|End date/)).toBeInTheDocument();
    expect(screen.getByRole('spinbutton')).toBeInTheDocument();
  });

  it('sollte auto-deaktivierte Verträge als „beendet" markieren und die Checkbox sperren', () => {
    render(
      <I18nProvider>
        <RecurringFlowOverrideForm
          recurringFlows={[flow({ disabled: true })]}
          overrides={overrides}
          onChange={() => {}}
        />
      </I18nProvider>,
    );
    expect(screen.getByText(/beendet|ended/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  it('sollte englische Spaltenüberschriften rendern', () => {
    render(
      <I18nProvider initialLocale="en">
        <RecurringFlowOverrideForm
          recurringFlows={[flow(), flow({ id: 'f2', name: 'Salary', amount: 2597 })]}
          overrides={overrides}
          onChange={() => {}}
        />
      </I18nProvider>,
    );
    const table = screen.getByRole('table');
    expect(within(table).getByRole('columnheader', { name: /Payment/ })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: /Amount/ })).toBeInTheDocument();
    expect(within(table).getByText('Salary')).toBeInTheDocument();
  });
});
