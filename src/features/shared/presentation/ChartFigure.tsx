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

/**
 * Die FORM einer Visualisierung — und damit ihr Seitenverhaeltnis.
 *
 * Bis hierher trug jede Aufrufstelle ihre eigene Pixelhoehe, und die Zahlen
 * sind auseinandergelaufen: 288, 300, 256, 250, 176, 500. Auf einem 360-px-
 * Telefon bleiben in einer Karte mit Inhaltsbereich nur 264 px Breite (zweimal
 * `p-4` = 64 px Polsterung), und damit standen SECHS Diagramme hochkant,
 * obwohl ihre Hauptachse eine Zeitachse ist — der Verlauf ueber Monate war
 * hoeher als breit.
 *
 * Sechs feste Hoehen durch EINE feste Hoehe zu ersetzen haette den Fehler nur
 * verschoben. Das Verhaeltnis ist eine Eigenschaft der Visualisierung:
 *
 * - `zeitreihe` — Kontostand, Prognose, Monatsverlauf. Deutlich breiter als
 *   hoch: Eine Zeitachse braucht waagerechten Raum, sonst ist die Steigung
 *   zwischen zwei Punkten nicht mehr ablesbar.
 * - `verteilung` — Ring, Sonnenblume, Anteile. Quadratisch, denn hier gibt es
 *   keine Achse, die mehr Platz braeuchte als die andere.
 * - `fluss` — Sankey. **Bekommt bewusst KEIN Seitenverhaeltnis.** Seine Hoehe
 *   haengt an der Zahl der Knoten, nicht an der Breite: Zehn Kategorien
 *   brauchen zehnmal Platz fuer eine Beschriftung, ob die Flaeche nun 264 oder
 *   900 px breit ist. Ein Verhaeltnis waere hier eine Scheingenauigkeit.
 */
export type DiagrammForm = 'zeitreihe' | 'verteilung' | 'fluss';

/**
 * Je Form eine zentral gepflegte Klasse.
 *
 * NUR IN `fokussiert`, und das ist eine Abwaegung, keine Selbstverstaendlichkeit.
 *
 * Dagegen spricht ein guter Grund: Ein Seitenverhaeltnis ist von der Breite
 * abgeleitet und passt sich von selbst an — es braucht eigentlich keine zweite
 * Entscheidung daneben, und der Deckel `max-h` faengt den breiten Desktop
 * ohnehin ab.
 *
 * Dafuer spricht der Umfang: Unbedingt gesetzt aendert die Regel das Aussehen
 * JEDER Aufrufstelle auch am Desktop, wo heute nichts kaputt ist — in der
 * kompakten Dichte steht der Verlauf mit `h-72 md:h-96` gegen rund 700 px
 * Breite laengst im Querformat. Ein Mobil-Umbau, der nebenbei den Desktop
 * umstellt, aendert mehr, als er geprueft hat.
 *
 * Bleibt die Regel eng, kostet das eine Zeile je Form; wird sie spaeter
 * unbedingt gebraucht, ist das Entfernen des Praefixes eine Textersetzung.
 * Umgekehrt waere es eine Regression, die niemand angefordert hat.
 *
 * Auf 264 px nutzbarer Breite ergibt 16:9 rund 148 px — breiter als hoch, wie
 * es sich fuer eine Zeitachse gehoert. Der Deckel greift an der oberen Kante
 * der fokussierten Dichte: Bei 768 px waeren es sonst 432 px, mehr als die
 * halbe Sichthoehe eines Telefons fuer EINE Aussage.
 *
 * `h-auto` und `flex-none` heben die Flex-Hoehe der Huelle auf; ohne sie
 * gewinnt `flex-1` und das Verhaeltnis bliebe wirkungslos.
 */
const FORM_KLASSEN: Record<DiagrammForm, string> = {
  zeitreihe: 'fokussiert:aspect-[16/9] fokussiert:max-h-[320px]',
  verteilung:
    'fokussiert:mx-auto fokussiert:aspect-square fokussiert:max-h-[320px] fokussiert:w-full fokussiert:max-w-[320px]',
  fluss: '',
};

export type ChartFigureProps<Row> = {
  /**
   * Form der Visualisierung. Ohne Angabe bleibt es bei der Hoehe der
   * Aufrufstelle — bestehende Diagramme aendern sich also nicht von selbst.
   */
  form?: DiagrammForm;
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
  form,
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
          gleichwertige Fassung, beides vorzulesen wäre Doppelung.

          `inert` gehört zwingend dazu und ist nicht Zierde: `aria-hidden`
          allein nimmt den Inhalt aus dem Baum, lässt ihn aber fokussierbar —
          Recharts setzt auf seiner Zeichenfläche `tabIndex`. Wer sich mit der
          Tabulatortaste bewegt, landete damit in einem Element, das sein
          Screenreader nicht vorliest: der Fokus verschwindet. Genau das meldet
          axe als `aria-hidden-focus` (auf sechs Screens, weil dieser Baustein
          zentral ist). React 18 kennt `inert` noch nicht als Prop und reicht
          es als unbekanntes Attribut unverändert an das DOM weiter — daher
          die Schreibweise. */}
      <div
        aria-hidden="true"
        className={cn(
          'min-h-0',
          // `flex-1` NUR ohne Form. Am Geraet gemessen: Stehen beide da,
          // entscheidet die Reihenfolge im erzeugten Stylesheet — die
          // Dichte-Variante steht in `:where(...)` und hat deshalb dieselbe
          // Spezifitaet wie `.flex-1`. Der Verlauf wurde dadurch rund dreimal
          // so hoch, wie sein Seitenverhaeltnis erlaubt. Eine Klasse, die man
          // ueberschreiben MUSS, gar nicht erst auszugeben, ist verlaesslicher
          // als sie zu ueberbieten.
          !form && 'flex-1',
          form && FORM_KLASSEN[form],
        )}
        {...{ inert: '' }}
      >
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
