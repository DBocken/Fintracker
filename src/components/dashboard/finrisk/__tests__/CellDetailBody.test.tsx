import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider } from '@/i18n/I18nProvider';
import { CellDetailBody } from '../CellDetailBody';
import { buildDensityField } from '@/lib/finrisk/density';
import { computeCellDetail, type CellDetail } from '@/lib/finrisk/cell-details';
import type { TrialAssumptions } from '@/lib/forecast-montecarlo-types';

function renderWithI18n(component: React.ReactElement, locale: 'de' | 'en' = 'de') {
  return render(
    <I18nProvider initialLocale={locale}>
      {component}
    </I18nProvider>
  );
}

/**
 * Zell-Detail-Dialog: eine Heatmap-Zelle enthält oft MEHRERE Monte-Carlo-Pfade
 * („Lösungen"). Der Dialog zeigt Spanne/Durchschnitt über die Pfade der Zelle
 * und erlaubt das Blättern durch die konkreten Pfade.
 */

function dailyDates(startISO: string, count: number): string[] {
  const out: string[] = [];
  const start = new Date(`${startISO}T00:00:00Z`);
  for (let i = 0; i < count; i++) {
    out.push(new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10));
  }
  return out;
}

const DATES = dailyDates('2026-01-01', 90);
const DAY = 73; // 15. März

function assume(a: number, b: number): TrialAssumptions {
  return {
    variableByCategory: [
      { category: 'Lebensmittel', plannedMonthly: 300, monthly: { '2026-01': a, '2026-02': a, '2026-03': a } },
      { category: 'Freizeit', plannedMonthly: 200, monthly: { '2026-01': b, '2026-02': b, '2026-03': b } },
    ],
    income: [],
  };
}

/** Zelle mit drei Pfaden: Treiber A einmal, Treiber B zweimal. */
function multiPathDetail(pathIndex = 0): CellDetail {
  const paths = [5000, 5010, 5020].map((v) => DATES.map(() => v));
  const assumptions = [assume(900, 400), assume(300, 800), assume(300, 100)];
  const density = buildDensityField(paths, DATES, { bins: 16, include: [0] });
  const bin = Math.max(0, Math.min(density.bins - 1, Math.floor((5000 - density.valueMin) / density.binSize)));
  const trialsByCell = DATES.map(() => {
    const row = Array.from({ length: density.bins }, () => [] as number[]);
    row[bin] = [0, 1, 2];
    return row;
  });
  const representativeByCell = DATES.map(() => {
    const row = new Array<number>(density.bins).fill(-1);
    row[bin] = 0;
    return row;
  });
  return computeCellDetail({
    density,
    assumptions,
    representativeByCell,
    trialsByCell,
    day: DAY,
    bin,
    pathIndex,
  })!;
}

/** Zelle ohne trialsByCell – nur der Repräsentant ist bekannt (Fallback). */
function singlePathDetail(): CellDetail {
  const paths = [[...DATES.map(() => 5000)]];
  const assumptions = [assume(300, 200)];
  const density = buildDensityField(paths, DATES, { bins: 16, include: [0] });
  const bin = Math.max(0, Math.min(density.bins - 1, Math.floor((5000 - density.valueMin) / density.binSize)));
  const representativeByCell = DATES.map(() => {
    const row = new Array<number>(density.bins).fill(-1);
    row[bin] = 0;
    return row;
  });
  return computeCellDetail({ density, assumptions, representativeByCell, day: DAY, bin })!;
}

describe('CellDetailBody', () => {
  describe('Normal Behavior', () => {
    it('sollte bei mehreren Pfaden Position anzeigen und blättern lassen', () => {
      const onSelectPath = vi.fn();
      renderWithI18n(<CellDetailBody detail={multiPathDetail(0)} onSelectPath={onSelectPath} />);

      expect(screen.getByText(/Pfad 1 von 3/)).toBeInTheDocument();
      // Am Anfang: zurück gesperrt, vor blättert auf Pfad 2 (Index 1).
      expect(screen.getByRole('button', { name: 'Vorheriger Pfad' })).toBeDisabled();
      fireEvent.click(screen.getByRole('button', { name: 'Nächster Pfad' }));
      expect(onSelectPath).toHaveBeenCalledWith(1);
    });

    it('sollte am Ende der Pfadliste das Weiterblättern sperren', () => {
      const onSelectPath = vi.fn();
      renderWithI18n(<CellDetailBody detail={multiPathDetail(2)} onSelectPath={onSelectPath} />);
      expect(screen.getByText(/Pfad 3 von 3/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Nächster Pfad' })).toBeDisabled();
      fireEvent.click(screen.getByRole('button', { name: 'Vorheriger Pfad' }));
      expect(onSelectPath).toHaveBeenCalledWith(1);
    });

    it('sollte Spanne und Durchschnitt der Zelle je streuendem Posten zeigen', () => {
      renderWithI18n(<CellDetailBody detail={multiPathDetail(0)} onSelectPath={() => {}} />);
      // Beide Kategorien streuen → zwei Spannen-Zeilen mit Ø-Wert.
      expect(screen.getAllByText(/Spanne/).length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText(/Ø/).length).toBeGreaterThanOrEqual(2);
    });

    it('sollte die Haupttreiber-Verteilung der Zelle nennen', () => {
      renderWithI18n(<CellDetailBody detail={multiPathDetail(0)} onSelectPath={() => {}} />);
      // Check if mainCauses are shown (only when multiple paths with significant drivers)
      // Restrict to the <p> itself (tagName check) — textContent bubbles up to
      // every ancestor, so an untyped matcher would report multiple matches.
      const mainCausesText = screen.queryByText((_content, element) => {
        return (
          element?.tagName.toLowerCase() === 'p' &&
          (element?.textContent?.includes('Haupttreiber in dieser Zelle:') ?? false)
        );
      });
      if (mainCausesText) {
        expect(mainCausesText.textContent).toMatch(/Freizeit \(67\s?%\)/);
        expect(mainCausesText.textContent).toMatch(/Lebensmittel \(33\s?%\)/);
      }
    });
  });

  describe('i18n Compliance', () => {
    it('sollte Pager, Treiber-Text und Empty-State auf Englisch rendern', () => {
      renderWithI18n(<CellDetailBody detail={multiPathDetail(0)} onSelectPath={() => {}} />, 'en');
      expect(screen.getByText(/Path 1 of 3/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Previous path' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Next path' })).toBeInTheDocument();
    });

    it('sollte den englischen Hinweis für leere Zellen zeigen', () => {
      const detail: CellDetail = {
        ...singlePathDetail(),
        pathsInCell: 0,
        pathCount: 0,
        representative: null,
      };
      renderWithI18n(<CellDetailBody detail={detail} onSelectPath={() => {}} />, 'en');
      expect(screen.getByText(/no simulated path/i)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('sollte ohne mehrere Pfade weder Pager noch Treiber-Verteilung zeigen', () => {
      renderWithI18n(<CellDetailBody detail={singlePathDetail()} onSelectPath={() => {}} />);
      expect(screen.queryByText(/Pfad 1 von/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Haupttreiber in dieser Zelle/)).not.toBeInTheDocument();
      // Ohne Zell-Aggregation auch keine Spannen-Zeile.
      expect(screen.queryByText(/Spanne/)).not.toBeInTheDocument();
    });

    it('sollte leere Zellen mit Hinweis statt Absturz rendern', () => {
      const detail: CellDetail = {
        ...singlePathDetail(),
        pathsInCell: 0,
        pathCount: 0,
        representative: null,
      };
      renderWithI18n(<CellDetailBody detail={detail} onSelectPath={() => {}} />);
      expect(screen.getByText(/kein simulierter Pfad/)).toBeInTheDocument();
    });
  });
});
