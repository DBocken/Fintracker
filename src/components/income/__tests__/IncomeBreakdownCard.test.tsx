import { describe, it, expect, beforeAll } from 'vitest';
import { screen, within, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';
import IncomeBreakdownCard from '../IncomeBreakdownCard';
import type { IncomeBreakdown } from '@/lib/analysis-data';

beforeAll(() => {
  globalThis.ResizeObserver ||= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const breakdown: IncomeBreakdown = {
  total: 3300,
  groups: [
    {
      id: 'anstellung',
      name: 'Anstellung',
      value: 3000,
      share: 3000 / 3300,
      children: [{ id: 'gehalt', name: 'Gehalt', value: 3000, share: 1 }],
    },
    {
      id: 'verkaeufe',
      name: 'Verkäufe',
      value: 300,
      share: 300 / 3300,
      children: [{ id: 'onlineverkauf', name: 'Online-Verkäufe', value: 300, share: 1 }],
    },
  ],
};

function mobileList(container: HTMLElement): HTMLElement {
  const list = container.querySelector('ul');
  if (!list) throw new Error('Mobile Aufschlüsselungs-Liste nicht gefunden');
  return list as HTMLElement;
}

describe('IncomeBreakdownCard – Prozent-Schalter', () => {
  // Gleiche Fehlerklasse wie die axe-critical `button-name`-Befunde aus dem
  // WP-4.6-Gate: Radix-Switch ohne zugänglichen Namen, Nachbartext nicht
  // programmatisch verknüpft.
  it('[REGRESSION] sollte den Prozent-Schalter zugänglich benennen (Deutsch)', () => {
    renderWithProviders(<IncomeBreakdownCard breakdown={breakdown} />, { locale: 'de' });
    expect(screen.getByRole('switch', { name: 'Prozent' })).toBeInTheDocument();
  });

  it('[REGRESSION] sollte den Prozent-Schalter zugänglich benennen (Englisch)', () => {
    renderWithProviders(<IncomeBreakdownCard breakdown={breakdown} />, { locale: 'en' });
    expect(screen.getByRole('switch', { name: 'Percent' })).toBeInTheDocument();
  });
});

describe('IncomeBreakdownCard – mobile Aufschlüsselung', () => {
  it('listet alle Einkommens-Hauptkategorien als Gruppen (Deutsch)', () => {
    const { container } = renderWithProviders(<IncomeBreakdownCard breakdown={breakdown} />, { locale: 'de' });
    const list = mobileList(container);
    expect(within(list).getByText('Anstellung')).toBeInTheDocument();
    expect(within(list).getByText('Verkäufe')).toBeInTheDocument();
  });

  it('listet alle Einkommens-Hauptkategorien als Gruppen (Englisch)', () => {
    const { container } = renderWithProviders(<IncomeBreakdownCard breakdown={breakdown} />, { locale: 'en' });
    const list = mobileList(container);
    expect(within(list).getByText('Anstellung')).toBeInTheDocument();
    expect(within(list).getByText('Verkäufe')).toBeInTheDocument();
    expect(screen.getByText('Where does my money come from?')).toBeInTheDocument();
  });

  it('klappt eine Gruppe auf und zeigt ihre Unterkategorien', () => {
    const { container } = renderWithProviders(<IncomeBreakdownCard breakdown={breakdown} />);
    const list = mobileList(container);
    expect(within(list).queryByText('Online-Verkäufe')).not.toBeInTheDocument();
    fireEvent.click(within(list).getByRole('button', { name: /Verkäufe aufklappen/i }));
    expect(within(list).getByText('Online-Verkäufe')).toBeInTheDocument();
  });

  it('zeigt einen Hinweis, wenn keine Einnahmen vorliegen', () => {
    renderWithProviders(<IncomeBreakdownCard breakdown={{ total: 0, groups: [] }} />);
    expect(screen.getAllByText(/Noch keine Einnahmen erfasst/i).length).toBeGreaterThan(0);
  });
});
