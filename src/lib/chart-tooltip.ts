/**
 * Hilfsfunktionen für Recharts-Tooltips.
 *
 * recharts 3 typisiert die Werte, die an `formatter`/`labelFormatter` gehen,
 * bewusst weit: `ValueType` deckt `number | string | Array` ab und darf
 * `undefined` sein, `NameType`/`label` sind ReactNode. Vorher waren die
 * Callbacks in dieser Codebasis auf `number`/`string` annotiert — das war eine
 * Zusicherung, die die Bibliothek nie gegeben hat.
 *
 * In Fintracker zeigen alle `dataKey`s auf numerische Felder (die Chart-Daten
 * kommen aus `@/lib/analysis-data` und Co.), der nicht-numerische Fall tritt
 * also praktisch nicht ein. Die Helfer machen die Konvertierung an einer
 * Stelle total, statt sie an 15 Aufrufstellen per Cast zu übergehen.
 */

/** Tooltip-Wert als Zahl; nicht-numerische Eingaben werden zu 0. */
export function chartNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (Array.isArray(value)) return chartNumber(value[0]);
  return 0;
}

/** Tooltip-Name/-Label als String; `null`/`undefined` werden zu ''. */
export function chartText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

/* -------------------------------------------------------------------------
 * WP-6.8 — Tooltip-Standardisierung
 *
 * Die 13 Chart-Komponenten trugen je eine eigene Abschrift von `contentStyle`
 * und `cursor`. Die Abschriften waren bereits auseinandergelaufen — einmal
 * `hsl(var(--background))`, einmal `var(--background)` —, weshalb genau ein
 * Chart einen anderen Tooltip-Hintergrund hatte als alle anderen.
 *
 * Warum eine Props-Fabrik und keine `<ChartTooltip>`-Komponente: Recharts
 * erkennt seine Kinder am Komponententyp. Ein eigener Wrapper wäre für die
 * Chart-Wurzel unsichtbar und der Tooltip verschwände ersatzlos. Deshalb
 * bleibt `<Tooltip>` direktes Kind und bekommt seine Props von hier.
 * ---------------------------------------------------------------------- */

/**
 * Einheitliche Tooltip-Fläche. Ausschließlich Design-Tokens, damit der
 * Dunkelmodus mitwandert — ein Hex-Wert bliebe dort stehen.
 */
export const CHART_TOOLTIP_CONTENT_STYLE = {
  backgroundColor: 'hsl(var(--background))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 'var(--radius)',
  color: 'hsl(var(--foreground))',
} as const;

/** Einheitlicher Cursor-Hinterlegung beim Überfahren einer Kategorie. */
export const CHART_TOOLTIP_CURSOR = {
  fill: 'hsl(var(--muted))',
  opacity: 0.4,
} as const;

export interface ChartTooltipOptions {
  /**
   * Formatiert den Zahlenwert. Bekommt bereits eine echte Zahl — die
   * Konvertierung aus Recharts' weitem `ValueType` passiert hier, nicht an
   * jeder Aufrufstelle per Cast.
   */
  formatValue?: (value: number) => string;
  /**
   * Formatiert die Kopfzeile (Datum, Monat, Kategorie). Bekommt bereits einen
   * String.
   */
  formatLabel?: (label: string) => string;
  /**
   * Übersetzt `dataKey`/`name` einer Serie in den sichtbaren Namen. Fehlt ein
   * Eintrag, bleibt der Rohname stehen — sichtbar falsch ist besser als
   * unsichtbar leer.
   */
  seriesLabels?: Record<string, string>;
}

/** Die aufgelösten Props für ein `<Tooltip>` von Recharts. */
export interface ChartTooltipProps {
  contentStyle: typeof CHART_TOOLTIP_CONTENT_STYLE;
  cursor: typeof CHART_TOOLTIP_CURSOR;
  formatter?: (
    value: unknown,
    name: unknown,
    item: unknown,
    index: number,
    payload: unknown
  ) => [string, string];
  labelFormatter?: (label: unknown, payload: unknown) => string;
}

/**
 * Baut die Props für ein `<Tooltip>`.
 *
 * ```tsx
 * <Tooltip {...chartTooltipProps({ formatValue: (v) => euro(v) })} />
 * ```
 */
export function chartTooltipProps(options: ChartTooltipOptions = {}): ChartTooltipProps {
  const { formatValue, formatLabel, seriesLabels } = options;

  const props: ChartTooltipProps = {
    contentStyle: CHART_TOOLTIP_CONTENT_STYLE,
    cursor: CHART_TOOLTIP_CURSOR,
  };

  if (formatValue || seriesLabels) {
    props.formatter = (value, name) => {
      const rawName = chartText(name);
      const label = seriesLabels?.[rawName] ?? rawName;
      return [formatValue ? formatValue(chartNumber(value)) : chartText(value), label];
    };
  }

  if (formatLabel) {
    props.labelFormatter = (label) => formatLabel(chartText(label));
  }

  return props;
}
