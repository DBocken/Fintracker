import { describe, it, expect, beforeAll } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';
import { TimelineChart } from '../TimelineChart';

beforeAll(() => {
  globalThis.ResizeObserver ||= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const emptyProps = { data: [], flowTransactions: [], categories: [] };

describe('TimelineChart – Einnahmen-Schalter', () => {
  // Gleiche Fehlerklasse wie die axe-critical `button-name`-Befunde aus dem
  // WP-4.6-Gate: Radix-Switch ohne zugänglichen Namen, Nachbartext nicht
  // programmatisch verknüpft.
  it('[REGRESSION] sollte den Einnahmen-Schalter zugänglich benennen (Deutsch)', () => {
    renderWithProviders(<TimelineChart {...emptyProps} />, { locale: 'de' });
    expect(screen.getByRole('switch', { name: 'Einnahmen anzeigen' })).toBeInTheDocument();
  });

  it('[REGRESSION] sollte den Einnahmen-Schalter zugänglich benennen (Englisch)', () => {
    renderWithProviders(<TimelineChart {...emptyProps} />, { locale: 'en' });
    expect(screen.getByRole('switch', { name: 'Show income' })).toBeInTheDocument();
  });
});
