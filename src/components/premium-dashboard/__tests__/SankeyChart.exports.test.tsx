/**
 * Regression: die Export-Schaltflächen standen doppelt.
 *
 * Gefunden nicht durch einen Test, sondern durch das Ansehen der
 * Visual-Regression-Baseline `dashboard-1440-win32.png`: unter der
 * Geldfluss-Visualisierung erschien „Export PNG / JPEG / PDF" zweimal
 * untereinander. Beide Blöcke waren `hidden sm:flex`, auf Desktop also
 * gleichzeitig sichtbar.
 *
 * Der Kommentar im Quelltext dokumentiert die Absicht („Höhen-Slider: auf
 * Mobile kompakt, auf SM+ in Reihe mit Export") — die Slider-Reihe trägt die
 * Schaltflächen, der obere Block war ein Überrest.
 *
 * Kein bestehender Test hat das bemerkt, weil keiner die ANZAHL geprüft hat.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test-utils/render';
import type { SankeyData } from '@/lib/analysis-data';
import { SankeyChart } from '../SankeyChart';

// Recharts' ResponsiveContainer und der Radix-Slider brauchen ResizeObserver,
// den jsdom nicht kennt (gleiche Stelle wie in den Trading-Chart-Tests).
beforeAll(() => {
  globalThis.ResizeObserver ||= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

vi.mock('html-to-image', () => ({ toPng: vi.fn(), toJpeg: vi.fn() }));
vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => false }));
vi.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));

const DATA: SankeyData = {
  totalIncome: 3000,
  accounts: [{ id: 'giro', name: 'Girokonto', income: 3000, expenses: 1200, net: 1800 }],
  mainCategories: [
    { id: 'housing', name: 'Wohnen', amount: 900, byAccount: { giro: 900 } },
    { id: 'food', name: 'Lebensmittel', amount: 300, byAccount: { giro: 300 } },
  ],
  subCategories: [],
};

describe('SankeyChart — Export-Schaltflächen', () => {
  it('[REGRESSION] sollte jede Export-Schaltfläche genau einmal rendern', () => {
    renderWithProviders(<SankeyChart data={DATA} />, { query: true });

    // Vorher: zwei identische Bloecke, beide hidden sm:flex — auf Desktop
    // beide sichtbar. Geprueft wird die ANZAHL, nicht die blosse Existenz;
    // getByRole waere bei Duplikaten zwar gescheitert, getAllByRole macht die
    // Absicht aber explizit.
    expect(screen.getAllByRole('button', { name: /PNG/i })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /JPEG/i })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /PDF/i })).toHaveLength(1);
  });

  it('sollte die Export-Schaltflächen weiterhin anbieten', () => {
    // Gegenprobe: der Fix darf sie nicht ersatzlos entfernt haben.
    renderWithProviders(<SankeyChart data={DATA} />, { query: true });
    expect(screen.getByRole('button', { name: /PNG/i })).toBeInTheDocument();
  });
});

describe('SankeyChart — Export auf beiden Plattformen (WP-8.3)', () => {
  /**
   * Befund der Paritäts-Durchsicht (AGENTS.md §4): Die Export-Reihe trug
   * `hidden sm:flex` OHNE Gegenstück. Auf dem Telefon fehlte der Export damit
   * ganz — das ist kein Dichte-Unterschied, sondern ein fehlendes Feature.
   *
   * jsdom wertet Media Queries nicht aus, beide Zweige stehen also gleichzeitig
   * im Baum. Geprüft wird deshalb die Weiche selbst: dass es zur
   * Desktop-Reihe ein `sm:hidden`-Gegenstück gibt und dass dieses zu denselben
   * drei Aktionen führt.
   */
  it('[REGRESSION] sollte den Export auch auf schmalen Breiten erreichbar halten', async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<SankeyChart data={DATA} />, { query: true });

    const desktopRow = container.querySelector('.hidden.sm\\:flex');
    expect(desktopRow, 'Desktop-Reihe vorhanden').not.toBeNull();

    const trigger = screen.getByRole('button', { name: 'Exportieren' });
    expect(trigger.className).toContain('sm:hidden');

    await user.click(trigger);

    // Jetzt stehen die drei Wege doppelt im Baum (Desktop-Reihe + offenes
    // Menue) — genau deshalb zaehlt dieser Test auf 2 statt auf 1. Waere das
    // Gegenstueck eine zweite immer sichtbare Reihe, faellt der Test darueber
    // oben („genau einmal") um.
    expect(await screen.findAllByText(/PNG/i)).toHaveLength(2);
    expect(screen.getAllByText(/JPEG/i)).toHaveLength(2);
    expect(screen.getAllByText(/PDF/i)).toHaveLength(2);
  });
});
