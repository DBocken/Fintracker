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
