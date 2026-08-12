import { describe, expect, it, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';

import { I18nProvider } from '@/i18n/I18nProvider';
import { TutorialControlProvider } from '@/hooks/useTutorialControl';
import { getUserSettings } from '@/services/user-settings-service';
import { collectDataReadiness } from '@/services/data-readiness-service';
import type { DataReadiness } from '@/lib/tutorial-sequence';
import type { UserSettings } from '@/types';
import TutorialLauncher from '../TutorialLauncher';

vi.mock('@/services/user-settings-service', () => ({ getUserSettings: vi.fn() }));
vi.mock('@/services/data-readiness-service', () => ({ collectDataReadiness: vi.fn() }));
vi.mock('@/hooks/useTier', () => ({ useTier: () => 'free' }));

const ready: DataReadiness = {
  transactionCount: 180,
  monthsOfHistory: 6,
  categorizedMonths: 6,
  accountCount: 2,
  hasSalaryDetected: true,
  hasRecurringDetected: true,
  hasBudget: true,
  hasDebt: true,
  hasOccasion: true,
  hasAssetsBeyondAccounts: true,
  hasDeductibleCategory: true,
  businessMode: false,
  hasPortfolio: false,
  hasPremiumAccess: false,
};

beforeEach(() => {
  vi.mocked(getUserSettings).mockResolvedValue({} as UserSettings);
  vi.mocked(collectDataReadiness).mockResolvedValue(ready);
});

/**
 * Eigener Aufbau statt `renderWithProviders`: Der Ort ist hier der
 * Prüfgegenstand („was gilt auf DIESER Seite"), und der Helfer kennt keine
 * `initialEntries`.
 */
function renderLauncher(pathname: string, start = vi.fn(), startSeries = vi.fn()) {
  render(
    <I18nProvider initialLocale="de">
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={[pathname]}>
          <TutorialControlProvider value={{ start, startSeries, startAll: vi.fn(), active: false }}>
            <TutorialLauncher />
          </TutorialControlProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nProvider>,
  );
  return start;
}

describe('TutorialLauncher', () => {
  it('sollte auf jeder Seite erreichbar sein', async () => {
    renderLauncher('/budgets');
    expect(screen.getByRole('button', { name: 'Führungen' })).toBeInTheDocument();
  });

  it('sollte die Führung DIESER Seite starten', async () => {
    const start = renderLauncher('/transactions');
    await userEvent.click(screen.getByRole('button', { name: 'Führungen' }));
    await userEvent.click(await screen.findByRole('button', { name: /Diese Seite erklären/ }));
    expect(start).toHaveBeenCalledWith('transactions');
  });

  it('sollte auf einer Seite ohne Führung sagen, dass es keine gibt, statt einen toten Knopf zu zeigen', async () => {
    renderLauncher('/csv');
    await userEvent.click(screen.getByRole('button', { name: 'Führungen' }));
    expect(await screen.findByText('Für diese Seite gibt es noch keine Führung.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Diese Seite erklären/ })).not.toBeInTheDocument();
  });

  it('sollte den Weg zur Gesamtübersicht offen halten', async () => {
    renderLauncher('/dashboard');
    await userEvent.click(screen.getByRole('button', { name: 'Führungen' }));
    const link = await screen.findByRole('link', { name: 'Alle Tutorials' });
    expect(link).toHaveAttribute('href', '/tutorials');
  });
});
