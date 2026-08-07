import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithI18n } from '@/test-utils/render';
import { ChartFigure, type ChartTableColumn } from '../ChartFigure';

/**
 * WP-6.10 — barrierefreie Alternative zu jeder Datenvisualisierung.
 *
 * Ein Recharts-SVG ist für Screenreader ein Haufen `<path>`-Elemente. Diese
 * Komponente verallgemeinert das Muster, das die Finanzstadt schon hat
 * (WP-C5: „3D ist nie der einzige Zugriffsweg auf die Daten").
 */

type Row = { month: string; amount: number };

const ROWS: Row[] = [
  { month: 'Januar', amount: 1200 },
  { month: 'Februar', amount: 1450 },
  { month: 'März', amount: 980 },
];

const COLUMNS: ChartTableColumn<Row>[] = [
  { key: 'month', label: 'Monat', format: (row) => row.month },
  { key: 'amount', label: 'Betrag', format: (row) => `${row.amount} €`, numeric: true },
];

function setup(rows: Row[] = ROWS, locale: 'de' | 'en' = 'de') {
  return renderWithI18n(
    <ChartFigure
      caption="Ausgaben je Monat"
      summary="Die Ausgaben steigen von 1200 € auf 1450 € und fallen dann auf 980 €."
      columns={COLUMNS}
      rows={rows}
      rowKey={(row) => row.month}
    >
      <svg data-testid="chart" />
    </ChartFigure>,
    locale,
  );
}

describe('ChartFigure (WP-6.10)', () => {
  it('sollte das Diagramm für Hilfstechnik ausblenden', async () => {
    // Sobald eine gleichwertige Textfassung existiert, ist das SVG Dekoration.
    // Ohne aria-hidden läse ein Screenreader beides vor.
    const { container } = setup();
    const chart = container.querySelector('[data-testid="chart"]');
    expect(chart?.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('sollte die Aussage des Diagramms als Text bereitstellen', () => {
    // Die Tabelle macht die Zahlen zugänglich, aber nicht die Form der Kurve.
    setup();
    expect(
      screen.getByText(/Die Ausgaben steigen von 1200 € auf 1450 €/),
    ).toBeInTheDocument();
  });

  it('sollte die Tabelle erst beim Aufklappen in den DOM legen', async () => {
    // Bei 365 Tagespunkten × 4 Spalten wären das sonst 1460 unsichtbare
    // Knoten je Chart.
    setup();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Werte als Tabelle' }));
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('sollte alle Werte als echte Tabelle mit Spaltenköpfen zeigen', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Werte als Tabelle' }));

    const table = screen.getByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'Monat' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Betrag' })).toBeInTheDocument();
    // Kopfzeile plus drei Datenzeilen.
    expect(within(table).getAllByRole('row')).toHaveLength(4);
    expect(within(table).getByText('1450 €')).toBeInTheDocument();
  });

  it('sollte den Aufklappzustand über aria-expanded mitteilen', async () => {
    setup();
    const toggle = screen.getByRole('button', { name: 'Werte als Tabelle' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Tabelle ausblenden' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('sollte die Umschaltfläche mit der Tabelle verknüpfen', async () => {
    setup();
    const toggle = screen.getByRole('button', { name: 'Werte als Tabelle' });
    const controlledId = toggle.getAttribute('aria-controls');
    expect(controlledId).toBeTruthy();

    await userEvent.click(toggle);
    expect(document.getElementById(controlledId!)).toContainElement(screen.getByRole('table'));
  });

  it('sollte ohne Daten keine leere Tabelle anbieten', () => {
    // Eine Umschaltfläche, die eine leere Tabelle öffnet, ist ein Versprechen,
    // das nicht eingelöst wird.
    setup([]);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('sollte die Umschaltfläche auf Englisch beschriften', async () => {
    setup(ROWS, 'en');
    const toggle = screen.getByRole('button', { name: 'Values as a table' });
    await userEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Hide table' })).toBeInTheDocument();
  });

  it('sollte ein Touch-taugliches Umschaltziel bieten', () => {
    // 44 px ist die Untergrenze aus der Karten-Regel (AGENTS.md §9).
    setup();
    expect(screen.getByRole('button', { name: 'Werte als Tabelle' }).className).toContain(
      'min-h-[44px]',
    );
  });
});
