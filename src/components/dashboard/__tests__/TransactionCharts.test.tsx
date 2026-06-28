import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SpendingBreakdownCard } from '../TransactionCharts';

// Recharts' ResponsiveContainer (Desktop-Donut) braucht ResizeObserver, den
// jsdom nicht kennt. Ein No-op-Shim genügt fürs Rendern im Test.
beforeAll(() => {
  globalThis.ResizeObserver ||= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

/**
 * Regression-Schutz für die mobile Sunburst-Aufschlüsselung: Auf Touch greift
 * der Donut-Hover nicht, deshalb müssen *alle* tieferen Ebenen (Hauptkategorien
 * je Klasse) als lesbarer, antippbarer Text erscheinen — nicht nur die
 * Klassen-Legende.
 */
const sunburst = {
  total: 290,
  inner: [
    { id: 'essenziell', name: 'Essenziell', value: 230 },
    { id: 'diskretionaer', name: 'Nicht-Essenziell', value: 60 },
  ],
  outer: [
    { id: 'essenziell::wohnen', parentId: 'essenziell', name: 'Wohnen', value: 180 },
    { id: 'essenziell::lebensmittel', parentId: 'essenziell', name: 'Lebensmittel', value: 50 },
    { id: 'diskretionaer::unterhaltung', parentId: 'diskretionaer', name: 'Unterhaltung', value: 60 },
  ],
};

function renderCard() {
  return render(
    <MemoryRouter>
      <SpendingBreakdownCard sunburst={sunburst} />
    </MemoryRouter>,
  );
}

/** Die mobile Liste (md:hidden); die Desktop-Legende ist strukturell dieselbe Klasse, daher gezielt über die Liste suchen. */
function mobileList(container: HTMLElement): HTMLElement {
  const list = container.querySelector('ul');
  if (!list) throw new Error('Mobile Aufschlüsselungs-Liste nicht gefunden');
  return list as HTMLElement;
}

describe('SpendingBreakdownCard – mobile Aufschlüsselung', () => {
  describe('Normal Behavior', () => {
    it('[REGRESSION] sollte Hauptkategorien der größten Klasse mobil als Text zeigen (nicht nur Hover)', () => {
      const { container } = renderCard();
      const list = mobileList(container);
      // Größte Klasse (Essenziell) ist initial offen → ihre Hauptkategorien sind sichtbar.
      expect(within(list).getByText('Wohnen')).toBeInTheDocument();
      expect(within(list).getByText('Lebensmittel')).toBeInTheDocument();
    });

    it('sollte alle Ausgabenklassen als Gruppen auflisten', () => {
      const { container } = renderCard();
      const list = mobileList(container);
      expect(within(list).getByText('Essenziell')).toBeInTheDocument();
      expect(within(list).getByText('Nicht-Essenziell')).toBeInTheDocument();
    });

    it('sollte eine zugeklappte Klasse aufklappen und ihre Hauptkategorien enthüllen', () => {
      const { container } = renderCard();
      const list = mobileList(container);
      // Nicht-Essenziell ist initial zu → Unterhaltung noch nicht sichtbar.
      expect(within(list).queryByText('Unterhaltung')).not.toBeInTheDocument();

      fireEvent.click(within(list).getByRole('button', { name: /Nicht-Essenziell aufklappen/i }));
      expect(within(list).getByText('Unterhaltung')).toBeInTheDocument();
    });

    it('sollte Klassen- und Kategorie-Zeilen als antippbare Buttons mit ≥44px Touch-Ziel rendern', () => {
      const { container } = renderCard();
      const list = mobileList(container);
      const buttons = within(list).getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
      for (const btn of buttons) {
        expect(btn.className).toMatch(/min-h-\[44px\]/);
      }
    });
  });

  describe('Edge Cases', () => {
    it('sollte einen Hinweis statt einer leeren Liste zeigen, wenn keine Ausgaben vorliegen', () => {
      render(
        <MemoryRouter>
          <SpendingBreakdownCard sunburst={{ total: 0, inner: [], outer: [] }} />
        </MemoryRouter>,
      );
      expect(screen.getByText(/Noch keine Ausgaben erfasst/i)).toBeInTheDocument();
    });
  });
});
