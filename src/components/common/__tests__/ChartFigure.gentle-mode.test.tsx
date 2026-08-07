/**
 * WP-9.5 — Der Sanfte Modus greift auch in Diagrammen, zentral.
 *
 * Rund zwanzig Charts reichen `ChartFigure` je einen eigenen Formatierer
 * herein. Sie alle einzeln zu maskieren wäre wieder eine Frage der
 * Aufmerksamkeit gewesen — dieselbe Lücke, die schon bei den Skeletten
 * entstanden ist. Deshalb sitzt die Maske in `ChartFigure` selbst, und dieser
 * Test sichert genau das ab.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithI18n } from '@/test-utils/render';
import { GENTLE_AMOUNT_MASK, type GentleLevel } from '@/lib/gentle-mode';
import { ChartFigure } from '../ChartFigure';

const gentleLevel = vi.fn<() => GentleLevel>(() => 0);

vi.mock('@/components/providers/GentleModeProvider', () => ({
  useGentleMode: () => ({ level: gentleLevel(), enabled: gentleLevel() > 0, setLevel: vi.fn() }),
}));

type Row = { monat: string; betrag: number };

const ROWS: Row[] = [
  { monat: 'Januar', betrag: 1234 },
  { monat: 'Februar', betrag: 5678 },
];

async function openTable(locale: 'de' | 'en' = 'de') {
  const user = userEvent.setup();
  renderWithI18n(
    <ChartFigure<Row>
      caption="Ausgaben"
      columns={[
        { key: 'monat', label: 'Monat', format: (row) => row.monat },
        { key: 'betrag', label: 'Betrag', numeric: true, format: (row) => `${row.betrag} €` },
      ]}
      rows={ROWS}
      rowKey={(row) => row.monat}
    >
      <div>Diagramm</div>
    </ChartFigure>,
    locale,
  );
  // Die Tabelle wird erst beim Aufklappen gerendert (WP-6.10: sonst 1460
  // DOM-Knoten je Chart, die niemand sieht).
  await user.click(screen.getByRole('button'));
}

describe('ChartFigure — Sanfter Modus (WP-9.5)', () => {
  it('sollte Betraege normal zeigen', async () => {
    gentleLevel.mockReturnValue(0);
    await openTable();
    expect(screen.getByText('1234 €')).toBeInTheDocument();
  });

  it('sollte Zahlenspalten im Sanften Modus maskieren', async () => {
    gentleLevel.mockReturnValue(3);
    await openTable();
    expect(screen.queryByText('1234 €')).toBeNull();
    expect(screen.getAllByText(GENTLE_AMOUNT_MASK)).toHaveLength(2);
  });

  it('sollte Nicht-Zahlenspalten unangetastet lassen', async () => {
    // Ein maskiertes Datum waere keine Schonung, sondern Datenverlust: Ohne
    // die Zeitachse ist die Tabelle nicht mehr lesbar, nur noch leer.
    gentleLevel.mockReturnValue(3);
    await openTable();
    expect(screen.getByText('Januar')).toBeInTheDocument();
    expect(screen.getByText('Februar')).toBeInTheDocument();
  });
});
