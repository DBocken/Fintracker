import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';
import FinanceEmptyState from '../FinanceEmptyState';

const reduceMock = vi.fn(() => false);
vi.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => reduceMock(),
}));

afterEach(() => reduceMock.mockReturnValue(false));

vi.mock('@/services/demo-data-service', () => ({
  loadDemoData: vi.fn(),
}));

// Bewusst KEIN lokaler useI18n-Mock: ein Mock der Form
// `t: (key, fallback) => fallback ?? key` liefert für Aufrufe ohne Fallback den
// rohen Key zurück. Die Variantentests bestanden damit nur zufällig — der
// Key-String 'financeEmptyState.noBudgetsTitle' enthält "Budget",
// 'financeEmptyState.noGoalsTitle' aber kein "Ziel". Gerendert wird deshalb
// über den zentralen Helfer aus @/test-utils/render (AGENTS.md §5/§6).
describe('FinanceEmptyState (WP-3.3)', () => {
  it('sollte den Standard-Zustand mit CSV-Import und Beispieldaten rendern', () => {
    renderWithProviders(<FinanceEmptyState />, { query: true });
    expect(screen.getByRole('heading').textContent).toBe('Noch keine Transaktionen');
    expect(screen.getByRole('link', { name: /CSV importieren/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Beispieldaten ansehen/ })).toBeInTheDocument();
  });

  it('sollte den Standard-Zustand auf Englisch rendern', () => {
    renderWithProviders(<FinanceEmptyState />, { query: true, locale: 'en' });
    expect(screen.getByRole('heading').textContent).toBe('No transactions yet');
    expect(screen.getByRole('link', { name: /Import CSV/ })).toBeInTheDocument();
  });

  it('sollte mit variant="no-budgets" einen budgetspezifischen Text zeigen', () => {
    renderWithProviders(<FinanceEmptyState variant="no-budgets" />, { query: true });
    expect(screen.getByRole('heading').textContent).toBe('Noch keine Budgets');
  });

  it('sollte mit variant="no-budgets" auf Englisch einen budgetspezifischen Text zeigen', () => {
    renderWithProviders(<FinanceEmptyState variant="no-budgets" />, { query: true, locale: 'en' });
    expect(screen.getByRole('heading').textContent).toBe('No budgets yet');
  });

  it('sollte mit variant="no-goals" einen zielbezogenen Text zeigen', () => {
    renderWithProviders(<FinanceEmptyState variant="no-goals" />, { query: true });
    expect(screen.getByRole('heading').textContent).toBe('Noch keine Ziele');
  });

  it('sollte mit variant="no-goals" auf Englisch einen zielbezogenen Text zeigen', () => {
    renderWithProviders(<FinanceEmptyState variant="no-goals" />, { query: true, locale: 'en' });
    expect(screen.getByRole('heading').textContent).toBe('No goals yet');
  });

  it('sollte mit variant="no-transactions" einen buchungsbezogenen Text zeigen', () => {
    renderWithProviders(<FinanceEmptyState variant="no-transactions" />, { query: true });
    expect(screen.getByRole('heading').textContent).toBe('Noch keine Buchungen');
  });

  it('[VB-2] sollte keine destruktiven Farben verwenden', () => {
    const { container } = renderWithProviders(<FinanceEmptyState />, { query: true });
    expect(container.querySelector('[class*="destructive"]')).toBeNull();
  });

  it('[VB-1] sollte nie generischen "Keine Daten"-Text ohne konkrete Aktion zeigen', () => {
    renderWithProviders(<FinanceEmptyState />, { query: true });
    // Jede Variante muss mindestens eine benannte Folgeaktion anbieten.
    const actions = [...screen.getAllByRole('link'), ...screen.getAllByRole('button')];
    expect(actions.length).toBeGreaterThanOrEqual(1);
    for (const action of actions) {
      expect(action.textContent?.trim()).not.toBe('');
    }
  });

  it('sollte eine visuell dominante primäre Aktion haben', () => {
    renderWithProviders(<FinanceEmptyState />, { query: true });
    // Die primäre Aktion ist der CSV-Import. Er rendert über `Button asChild`
    // als <a> — Rolle "link", nicht "button". Ein Zugriff über
    // getAllByRole('button')[0] greift deshalb den sekundären Outline-Button
    // und prüfte bisher das falsche Element.
    // Geprüft wird der Variantenmarker, nicht der Teilstring "outline": jede
    // Button-Variante trägt `focus-visible:outline-none`.
    const primary = screen.getByRole('link', { name: /CSV importieren/ });
    expect(primary.className).toContain('bg-primary');
    expect(primary.className).not.toContain('border-input');
    // Gegenprobe: die sekundäre Aktion ist bewusst zurückgenommen.
    const secondary = screen.getByRole('button', { name: /Beispieldaten ansehen/ });
    expect(secondary.className).toContain('border-input');
  });

  it('sollte einen Hintergrund-Layer mit data-testid rendern', () => {
    const { container } = renderWithProviders(<FinanceEmptyState />, { query: true });
    expect(container.querySelector('[data-testid="empty-state-bg"]')).toBeInTheDocument();
  });

  it('sollte bei prefers-reduced-motion statisch sein', () => {
    reduceMock.mockReturnValue(true);
    const { container } = renderWithProviders(<FinanceEmptyState animated />, { query: true });
    const bgLayer = container.querySelector('[data-testid="empty-state-bg"]');
    expect(bgLayer).toBeInTheDocument();
    expect(bgLayer?.getAttribute('style')).toBeFalsy();
  });

  it('sollte mit animated und ohne reduced-motion den Hintergrund bewegen', () => {
    const { container } = renderWithProviders(<FinanceEmptyState animated />, { query: true });
    const bgLayer = container.querySelector('[data-testid="empty-state-bg"]');
    expect(bgLayer?.getAttribute('style')).toContain('float-breathe');
  });

  it('sollte den Titel als Überschrift auszeichnen (Screenreader-Semantik)', () => {
    renderWithProviders(<FinanceEmptyState variant="no-goals" />, { query: true });
    const heading = screen.getByRole('heading');
    expect(within(heading).queryByRole('img')).toBeNull();
    expect(heading.textContent).toBe('Noch keine Ziele');
  });
});
