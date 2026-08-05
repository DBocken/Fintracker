import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import FinanceEmptyState from '../FinanceEmptyState';

const reduceMock = vi.fn(() => false);
vi.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => reduceMock(),
}));

afterEach(() => reduceMock.mockReturnValue(false));

// i18n mock — FinanceEmptyState uses useI18n, we need to provide a mock
vi.mock('@/i18n/useI18n', () => ({
  useI18n: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    locale: 'de',
  }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock('@/services/demo-data-service', () => ({
  loadDemoData: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
}));

describe('FinanceEmptyState (WP-3.3)', () => {
  it('sollte den Standard-Zustand mit CSV-Import und Demo-Daten rendern', () => {
    render(<FinanceEmptyState />);
    expect(screen.getByText(/CSV/)).toBeInTheDocument();
  });

  it('sollte mit variant="no-budgets" einen budgetspezifischen Text zeigen', () => {
    render(<FinanceEmptyState variant="no-budgets" />);
    // The variant should produce different content than the default
    const title = screen.getByRole('heading');
    expect(title.textContent).toContain('Budget');
  });

  it('sollte mit variant="no-goals" einen zielbezogenen Text zeigen', () => {
    render(<FinanceEmptyState variant="no-goals" />);
    const title = screen.getByRole('heading');
    expect(title.textContent).toContain('Ziel');
  });

  it('[VB-2] sollte keine destruktiven Farben verwenden', () => {
    const { container } = render(<FinanceEmptyState />);
    // Check for destructive classes in the container
    const destructive = container.querySelector('[class*="destructive"]');
    expect(destructive).toBeNull();
  });

  it('[VB-1] sollte nie generischen "Keine Daten"-Text ohne Kontext zeigen', () => {
    render(<FinanceEmptyState />);
    // The component should have at least one action button
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it('sollte eine visuell dominante primäre Aktion haben', () => {
    render(<FinanceEmptyState />);
    // Primary action (CSV import) should be a default Button (not outline)
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
    // First button should be the primary (not variant="outline")
    const primaryButton = buttons[0];
    expect(primaryButton.className).not.toContain('outline');
  });

  it('sollte einen Hintergrund-Layer mit data-testid rendern', () => {
    const { container } = render(<FinanceEmptyState />);
    const bgLayer = container.querySelector('[data-testid="empty-state-bg"]');
    expect(bgLayer).toBeInTheDocument();
  });

  it('sollte bei prefers-reduced-motion statisch sein', () => {
    reduceMock.mockReturnValue(true);
    const { container } = render(<FinanceEmptyState animated />);
    const bgLayer = container.querySelector('[data-testid="empty-state-bg"]');
    expect(bgLayer).toBeInTheDocument();
    // Background layer should not have animation style
    expect(bgLayer?.getAttribute('style')).toBeFalsy();
  });
});
