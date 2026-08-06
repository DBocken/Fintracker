import { describe, it, expect, beforeAll } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';
import { ContractsDashboard } from '../ContractsDashboard';

beforeAll(() => {
  globalThis.ResizeObserver ||= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

describe('ContractsDashboard – Veränderungs-Filter', () => {
  // Gleiche Fehlerklasse wie die axe-critical `button-name`-Befunde aus dem
  // WP-4.6-Gate: Radix-Switch ohne zugänglichen Namen, Nachbartext nicht
  // programmatisch verknüpft.
  it('[REGRESSION] sollte den Veränderungs-Filter zugänglich benennen (Deutsch)', async () => {
    renderWithProviders(<ContractsDashboard />, { locale: 'de', query: true });
    expect(await screen.findByRole('switch', { name: 'Nur Veränderungen zeigen' })).toBeInTheDocument();
  });

  it('[REGRESSION] sollte den Veränderungs-Filter zugänglich benennen (Englisch)', async () => {
    renderWithProviders(<ContractsDashboard />, { locale: 'en', query: true });
    expect(await screen.findByRole('switch', { name: 'Show changes only' })).toBeInTheDocument();
  });
});
