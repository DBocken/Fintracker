import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SpendingSunburstChart } from '../SpendingSunburstChart';
import type { SunburstTree } from '@/lib/analysis-data';

// Reduzierte Bewegung erzwingen → Sweep ist sofort vollständig (sweep=1),
// damit die Segmente synchron (ohne rAF-Warten) gerendert werden.
beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('reduce'),
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false;
    },
  })) as unknown as typeof window.matchMedia;
});

const tree: SunburstTree = {
  total: 300,
  children: [
    {
      id: 'essenziell',
      name: 'Essenziell',
      value: 260,
      klasseId: 'essenziell',
      categoryId: null,
      children: [
        {
          id: 'essenziell::wohnen',
          name: 'Wohnen',
          value: 210,
          klasseId: 'essenziell',
          categoryId: 'wohnen',
          children: [
            { id: 'essenziell::wohnen::strom', name: 'Strom', value: 80, klasseId: 'essenziell', categoryId: 'strom', children: [] },
            { id: 'essenziell::wohnen::wasser', name: 'Wasser', value: 30, klasseId: 'essenziell', categoryId: 'wasser', children: [] },
            { id: 'essenziell::wohnen::__direct', name: 'Ohne Unterkategorie', value: 100, klasseId: 'essenziell', categoryId: 'wohnen', children: [] },
          ],
        },
        { id: 'essenziell::lebensmittel', name: 'Lebensmittel', value: 50, klasseId: 'essenziell', categoryId: 'lebensmittel', children: [] },
      ],
    },
    { id: 'unkategorisiert', name: 'Unkategorisiert', value: 40, klasseId: 'unkategorisiert', categoryId: null, children: [] },
  ],
};

const colorMap = new Map<string, string>([
  ['essenziell', '#22aa66'],
  ['unkategorisiert', '#cccccc'],
]);

function renderChart(overrides: Partial<React.ComponentProps<typeof SpendingSunburstChart>> = {}) {
  const onNavigateCategory = vi.fn();
  const onNavigateKlasse = vi.fn();
  const utils = render(
    <SpendingSunburstChart
      tree={tree}
      colorMap={colorMap}
      showPercent={false}
      onNavigateCategory={onNavigateCategory}
      onNavigateKlasse={onNavigateKlasse}
      {...overrides}
    />,
  );
  return { ...utils, onNavigateCategory, onNavigateKlasse };
}

describe('SpendingSunburstChart (grafisches, mehrstufiges Sunburst)', () => {
  describe('Normal Behavior', () => {
    it('sollte alle sichtbaren Ringe als Segmente zeichnen (Klassen + Hauptkat. + Unterkat.)', () => {
      const { container } = renderChart();
      // Ring0: 2 Klassen, Ring1: 2 Hauptkat. (unter Essenziell), Ring2: 3 Unterkat. (unter Wohnen) = 7
      expect(container.querySelectorAll('path').length).toBe(7);
    });

    it('sollte den Gesamtwert in der Mitte zeigen', () => {
      renderChart();
      expect(screen.getByText('300 €')).toBeInTheDocument();
      expect(screen.getByText('Gesamt')).toBeInTheDocument();
    });

    it('sollte in ein Segment mit Kindern reinzoomen (Mitte zeigt dann dessen Wert)', () => {
      const { container } = renderChart();
      fireEvent.click(container.querySelector('path[aria-label^="Essenziell:"]')!);
      // Mitte zeigt jetzt den Fokuswert der Klasse Essenziell.
      expect(screen.getByText('260 €')).toBeInTheDocument();
      expect(screen.getByText('Essenziell')).toBeInTheDocument();
    });

    it('sollte bei einem Blatt zur gefilterten Kategorie navigieren statt zu zoomen', () => {
      const { container, onNavigateCategory } = renderChart();
      fireEvent.click(container.querySelector('path[aria-label^="Lebensmittel:"]')!);
      expect(onNavigateCategory).toHaveBeenCalledWith('lebensmittel');
    });

    it('sollte aus einem gezoomten Fokus über die Mitte wieder herauszoomen', () => {
      const { container } = renderChart();
      fireEvent.click(container.querySelector('path[aria-label^="Essenziell:"]')!);
      expect(screen.getByText('260 €')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Zurück zu Gesamt/ }));
      expect(screen.getByText('300 €')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('sollte einen Hinweis statt eines leeren Diagramms zeigen, wenn keine Ausgaben vorliegen', () => {
      renderChart({ tree: { total: 0, children: [] } });
      expect(screen.getByText(/Noch keine Ausgaben erfasst/i)).toBeInTheDocument();
    });

    it('sollte Prozent statt Euro anzeigen, wenn showPercent aktiv ist', () => {
      renderChart({ showPercent: true });
      // 300 von 300 → 100 %
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });
});
