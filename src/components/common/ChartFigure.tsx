/**
 * WP-6.10 — Barrierefreie Alternative zu jeder Datenvisualisierung.
 *
 * Ein Recharts-SVG ist für Screenreader ein Haufen `<path>`-Elemente. Die
 * Finanzstadt hat dieses Problem bereits gelöst (WP-C5: „3D ist nie der
 * einzige Zugriffsweg auf die Daten") — diese Komponente verallgemeinert das
 * Muster auf alle Charts.
 *
 * Aufbau, in dieser Reihenfolge:
 *
 * 1. **Ein Satz zur Aussage.** Die Tabelle macht die Zahlen zugänglich, aber
 *    nicht die Form der Kurve. Wer 24 Zeilen vorgelesen bekommt, weiß am Ende
 *    nicht, ob es bergauf ging.
 * 2. **Das Diagramm**, für Hilfstechnik ausgeblendet — sobald eine
 *    gleichwertige Textfassung existiert, ist das SVG Dekoration. Ohne
 *    `aria-hidden` läse ein Screenreader beides vor.
 * 3. **Eine echte Tabelle**, aufklappbar. Bewusst nicht dauerhaft sichtbar
 *    (das verdoppelte jede Seite) und bewusst nicht `sr-only`: die Zahlen
 *    nachlesen zu wollen ist kein Bedürfnis, das nur Screenreader-Nutzer
 *    haben — die Umschaltfläche steht deshalb allen zur Verfügung.
 *
 * Die Tabelle wird erst gerendert, wenn sie aufgeklappt ist. Bei 365
 * Tagespunkten × 4 Spalten wären das sonst 1460 DOM-Knoten je Chart, die
 * niemand sieht.
 */

import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/useI18n';
import { useMoneyFormat } from '@/hooks/useMoneyFormat';

export type ChartTableColumn<Row> = {
  /** Stabiler Schlüssel für React — nicht der Anzeigename (der wandert mit der Sprache). */
  key: string;
  label: string;
  /** Zellinhalt als fertiger Text; die Formatierung kennt nur die Aufrufstelle. */
  format: (row: Row) => string;
  /** Zahlenspalten rechtsbündig mit Tabellenziffern. */
  numeric?: boolean;
};

export type ChartFigureProps<Row> = {
  /** Beschriftung der Tabelle — üblicherweise der Titel des Diagramms. */
  caption: string;
  /**
   * Ein Satz, der die Aussage des Diagramms wiedergibt. Fehlt er, wird nur
   * die Tabelle angeboten.
   */
  summary?: string;
  columns: readonly ChartTableColumn<Row>[];
  rows: readonly Row[];
  /** Stabiler Schlüssel je Zeile. */
  rowKey: (row: Row, index: number) => string;
  /** Das Diagramm selbst. */
  children: ReactNode;
  className?: string;
};

export function ChartFigure<Row>({
  caption,
  summary,
  columns,
  rows,
  rowKey,
  children,
  className,
}: ChartFigureProps<Row>) {
  const { t } = useI18n();
  // WP-9.5: Die Zahlen der Tabelle laufen durch die Maske des Sanften Modus.
  // Zentral, weil jede Aufrufstelle ihren eigenen `format` mitbringt — dort
  // einzeln zu maskieren haette dieselbe Luecke erzeugt wie bei den Skeletten.
  const money = useMoneyFormat();
  const [open, setOpen] = useState(false);
  const tableId = useId();

  const hasData = rows.length > 0 && columns.length > 0;

  return (
    <figure className={cn('m-0 flex min-h-0 flex-1 flex-col', className)}>
      {summary && <p className="sr-only">{summary}</p>}

      {/* Für Hilfstechnik ausgeblendet: die Tabelle unten ist die
          gleichwertige Fassung, beides vorzulesen wäre Doppelung. */}
      <div aria-hidden="true" className="min-h-0 flex-1">
        {children}
      </div>

      {hasData && (
        <figcaption className="mt-2">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls={tableId}
            className="flex min-h-[44px] items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
            {open ? t('chartFigure.hideTable') : t('chartFigure.showTable')}
          </button>

          {/* Erst beim Aufklappen gerendert — sonst haengen an jedem Chart
              hunderte unsichtbare Zellen im DOM. */}
          {open && (
            <div id={tableId} className="mt-2 max-h-72 overflow-auto rounded-md border">
              <table className="w-full text-left text-xs">
                <caption className="sr-only">{caption}</caption>
                <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                  <tr>
                    {columns.map((column) => (
                      <th
                        key={column.key}
                        scope="col"
                        className={cn('px-2 py-1.5 font-medium', column.numeric && 'text-right')}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={rowKey(row, index)} className="border-t">
                      {columns.map((column) => (
                        <td
                          key={column.key}
                          className={cn(
                            'px-2 py-1.5',
                            column.numeric && 'text-right tabular-nums',
                          )}
                        >
                          {column.numeric ? money.mask(column.format(row)) : column.format(row)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </figcaption>
      )}
    </figure>
  );
}

export default ChartFigure;
