import type { ReactElement } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import FinanceEmptyState from '../FinanceEmptyState';
import { renderWithProviders, createHookWrapper } from '@/test-utils/render';
import { loadDemoData } from '@/services/demo-data-service';

const reduceMock = vi.fn(() => false);
vi.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => reduceMock(),
}));

// Nur das I/O gegen den Demo-Datensatz wird gemockt — Sprache, Router und
// QueryClient kommen aus `@/test-utils/render`. Ein lokaler `useI18n`-Mock
// (die Vorgängerfassung) liefert die Schlüssel statt der Texte zurück und
// prüft damit genau das nicht, was auf dem Bildschirm steht (AGENTS.md §6).
vi.mock('@/services/demo-data-service', () => ({
  loadDemoData: vi.fn(),
}));

afterEach(() => reduceMock.mockReturnValue(false));

/** Die Komponente braucht Router (`Link`) und QueryClient (`useQueryClient`). */
function renderEmptyState(ui: ReactElement, locale: 'de' | 'en' = 'de') {
  return renderWithProviders(ui, { locale, router: true, query: true });
}

describe('FinanceEmptyState (WP-3.3)', () => {
  it.each([
    ['de', 'CSV importieren', 'Beispieldaten ansehen'],
    ['en', 'Import CSV', 'View sample data'],
  ] as const)(
    'sollte den Standard-Zustand in %s mit CSV-Import und Beispieldaten rendern',
    (locale, csvLabel, demoLabel) => {
      renderEmptyState(<FinanceEmptyState />, locale);
      expect(screen.getByRole('link', { name: csvLabel })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: demoLabel })).toBeInTheDocument();
    },
  );

  it.each([
    ['de', 'Budget'],
    ['en', 'budget'],
  ] as const)('sollte mit variant="no-budgets" in %s einen budgetspezifischen Text zeigen', (locale, needle) => {
    renderEmptyState(<FinanceEmptyState variant="no-budgets" />, locale);
    expect(screen.getByRole('heading').textContent?.toLowerCase()).toContain(needle.toLowerCase());
  });

  it.each([
    ['de', 'Ziele'],
    ['en', 'goals'],
  ] as const)('sollte mit variant="no-goals" in %s einen zielbezogenen Text zeigen', (locale, needle) => {
    renderEmptyState(<FinanceEmptyState variant="no-goals" />, locale);
    expect(screen.getByRole('heading').textContent?.toLowerCase()).toContain(needle.toLowerCase());
  });

  it('[VB-2] sollte keine destruktiven Farben verwenden', () => {
    const { container } = renderEmptyState(<FinanceEmptyState />);
    expect(container.querySelector('[class*="destructive"]')).toBeNull();
  });

  it('[VB-1] sollte nie generischen "Keine Daten"-Text ohne Kontext zeigen', () => {
    renderEmptyState(<FinanceEmptyState />);
    // Mindestens eine konkrete Folgeaktion — der CSV-Import ist ein `Link`,
    // die Beispieldaten ein `button`; beide Rollen zusammen zählen.
    const actions = [...screen.queryAllByRole('link'), ...screen.queryAllByRole('button')];
    expect(actions.length).toBeGreaterThanOrEqual(1);
  });

  it('sollte eine visuell dominante primäre Aktion haben', () => {
    renderEmptyState(<FinanceEmptyState />);
    // Die primäre Aktion (CSV-Import) ist `Button asChild` um einen `Link` und
    // rendert deshalb als `<a>`, nicht als `<button>` — sie trägt die
    // Default-Variante (`bg-primary`). Die Beispieldaten daneben sind bewusst
    // `variant="outline"` (`border-input`) und damit optisch zurückgenommen.
    // NICHT auf das Fehlen von "outline" prüfen: die Button-Basisklasse
    // enthält `focus-visible:outline-none`, ein solcher Test kann nie bestehen.
    const primary = screen.getByRole('link', { name: 'CSV importieren' });
    const secondary = screen.getByRole('button', { name: 'Beispieldaten ansehen' });

    expect(primary.className).toContain('bg-primary');
    expect(primary.className).not.toContain('border-input');
    expect(secondary.className).toContain('border-input');
    expect(secondary.className).not.toContain('bg-primary');
  });

  it('sollte einen Hintergrund-Layer mit data-testid rendern', () => {
    const { container } = renderEmptyState(<FinanceEmptyState />);
    expect(container.querySelector('[data-testid="empty-state-bg"]')).toBeInTheDocument();
  });

  it('sollte bei prefers-reduced-motion statisch sein', () => {
    reduceMock.mockReturnValue(true);
    const { container } = renderEmptyState(<FinanceEmptyState animated />);
    const bgLayer = container.querySelector('[data-testid="empty-state-bg"]');
    expect(bgLayer).toBeInTheDocument();
    expect(bgLayer?.getAttribute('style')).toBeFalsy();
  });

  it('[REGRESSION] [PERF-5] sollte beim Laden der Beispieldaten die Finanz-Domäne neu laden, aber Trading unberührt lassen', async () => {
    const { wrapper, queryClient } = createHookWrapper({ locale: 'de' });
    // Vorbelegung: eine Finanz-Abfrage (Konten) und eine nachweislich
    // unabhängige Trading-Abfrage (Portfolios) sind bereits gecacht.
    queryClient.setQueryData(['accounts'], []);
    queryClient.setQueryData(['portfolios'], []);

    render(
      <MemoryRouter>
        <FinanceEmptyState />
      </MemoryRouter>,
      { wrapper },
    );

    await userEvent.click(screen.getByRole('button', { name: 'Beispieldaten ansehen' }));

    expect(loadDemoData).toHaveBeenCalled();
    // Die Fläche mit den Konten muss nach dem Laden frisch sein …
    expect(queryClient.getQueryState(['accounts'])?.isInvalidated).toBe(true);
    // … Trading (eine nachweislich unabhängige Domäne) darf nicht mit
    // angestoßen werden — genau das tat der vorherige Pauschal-Wipe.
    expect(queryClient.getQueryState(['portfolios'])?.isInvalidated).toBeFalsy();
  });
});
