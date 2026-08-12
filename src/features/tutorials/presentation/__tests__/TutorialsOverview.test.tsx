import { describe, expect, it, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '@/test-utils/render';
import { TutorialControlProvider } from '@/hooks/useTutorialControl';
import { getUserSettings } from '@/services/user-settings-service';
import { collectDataReadiness } from '@/services/data-readiness-service';
import type { DataReadiness } from '@/lib/tutorial-sequence';
import type { UserSettings } from '@/types';
import TutorialsOverview from '../TutorialsOverview';

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

const settings = { tutorial_completed_chapters: ['transactions'] } as UserSettings;

beforeEach(() => {
  vi.mocked(getUserSettings).mockResolvedValue(settings);
  vi.mocked(collectDataReadiness).mockResolvedValue(ready);
});

function renderOverview(start = vi.fn(), locale: 'de' | 'en' = 'de', startSeries = vi.fn()) {
  renderWithProviders(
    <TutorialControlProvider value={{ start, startSeries, active: false }}>
      <TutorialsOverview />
    </TutorialControlProvider>,
    { locale, query: true },
  );
  return start;
}

describe('TutorialsOverview', () => {
  it('sollte die Bereiche mit ihren Kapiteln auflisten', async () => {
    renderOverview();
    // Bereichsüberschrift (Nav-Beschriftung) …
    expect(await screen.findByRole('heading', { name: 'Buchungen' })).toBeInTheDocument();
    // … und darunter die einzelnen Führungen dieses Bereichs.
    expect(screen.getByText('Die Liste lesen')).toBeInTheDocument();
    expect(screen.getByText('Suchen & Filtern')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Steuer' })).toBeInTheDocument();
  });

  it('sollte ein angesehenes Kapitel als erledigt ausweisen und trotzdem startbar lassen', async () => {
    const start = renderOverview();
    const row = await screen.findByRole('button', { name: /Die Liste lesen — Angesehen/ });
    // Der Haken ist eine Auskunft, keine Sperre: Nachschlagen ist der
    // häufigste Grund, eine Führung ein zweites Mal zu öffnen.
    await userEvent.click(row);
    expect(start).toHaveBeenCalledWith('transactions');
  });

  it('sollte den Gesamtfortschritt benennen', async () => {
    renderOverview();
    await screen.findByRole('heading', { name: 'Buchungen' });
    expect(screen.getByText('Angesehene Kapitel')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('sollte ein Kapitel ohne Datengrundlage nicht startbar machen', async () => {
    vi.mocked(collectDataReadiness).mockResolvedValue({ ...ready, hasPortfolio: false, businessMode: true });
    const start = renderOverview();
    // Die EÜR braucht den Einzelunternehmer-Modus; ohne Daten für die
    // Steuerkapitel bleibt der Eintrag stehen, aber grau.
    const waiting = await screen.findAllByRole('button', { name: /Braucht noch Daten/ });
    expect(waiting.length).toBeGreaterThan(0);
    await userEvent.click(waiting[0]).catch(() => undefined);
    expect(start).not.toHaveBeenCalled();
  });

  it('sollte auf Englisch dieselbe Übersicht zeigen', async () => {
    renderOverview(vi.fn(), 'en');
    expect(await screen.findByRole('heading', { name: 'Transactions' })).toBeInTheDocument();
    expect(screen.getByText('Reading the list')).toBeInTheDocument();
  });

  it('sollte das zusammenhängende Tutorial als Folge starten, nicht als Einzelkapitel', async () => {
    const startSeries = vi.fn();
    renderOverview(vi.fn(), 'de', startSeries);
    await userEvent.click(await screen.findByRole('button', { name: /der Reihe nach/ }));

    const [series] = startSeries.mock.calls[0] as [string[]];
    // Lehrplan-Reihenfolge über alle Bereiche hinweg …
    expect(series[0]).toBe('transactions');
    expect(series).toContain('dashboard');
    // … und nichts, was mangels Daten nur einen leeren Bildschirm zeigte.
    expect(series).not.toContain('trading');
  });

  it('[ZUSTAND /tutorials:fehler] sollte den Ladefehler benennen statt eine leere Liste zu zeigen', async () => {
    vi.mocked(collectDataReadiness).mockRejectedValue(new Error('IndexedDB weg'));
    renderOverview();
    await waitFor(() =>
      expect(screen.getByText(/konnten nicht geladen werden|Daten/i)).toBeInTheDocument(),
    );
    // Kein „es gibt nichts" — das wäre eine falsche Auskunft über einen
    // Katalog, der fest im Code steht.
    expect(screen.queryByRole('heading', { name: 'Buchungen' })).not.toBeInTheDocument();
  });
});
