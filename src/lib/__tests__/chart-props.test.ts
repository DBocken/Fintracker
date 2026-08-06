import { describe, it, expect } from 'vitest';
import {
  chartTooltipProps,
  CHART_TOOLTIP_CONTENT_STYLE,
  CHART_TOOLTIP_CURSOR,
} from '../chart-tooltip';
import { niceTicksForData, niceTicksForStackedData, valueAxisProps } from '../chart-axis';

/**
 * WP-6.8 — Chart-Tooltip-Standardisierung und Achsen-Hygiene.
 *
 * Die 13 Chart-Komponenten trugen bisher je eine eigene Abschrift von
 * `contentStyle`, `cursor` und den YAxis-Attributen. Die Abschriften waren
 * bereits auseinandergelaufen (`hsl(var(--background))` gegen
 * `var(--background)`), was in genau einem Chart einen anderen Tooltip-
 * Hintergrund ergab als überall sonst. Recharts erkennt seine Kinder am
 * Komponententyp — ein `<ChartTooltip>`-Wrapper wäre unsichtbar. Deshalb
 * Props-Fabriken statt Wrapper-Komponenten.
 */

describe('chartTooltipProps', () => {
  it('sollte einheitliches contentStyle und cursor liefern', () => {
    const props = chartTooltipProps();
    expect(props.contentStyle).toEqual(CHART_TOOLTIP_CONTENT_STYLE);
    expect(props.cursor).toEqual(CHART_TOOLTIP_CURSOR);
  });

  it('sollte Farben ausschließlich über Design-Tokens beziehen', () => {
    // Ein hartkodierter Hex-Wert würde im Dunkelmodus nicht mitwandern.
    const values = Object.values(CHART_TOOLTIP_CONTENT_STYLE).join(' ');
    expect(values).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(CHART_TOOLTIP_CONTENT_STYLE.backgroundColor).toContain('var(--');
  });

  it('sollte einen Wert-Formatter durchreichen und den Rohwert total machen', () => {
    const props = chartTooltipProps({ formatValue: (value) => `${value.toFixed(2)} €` });
    // Recharts typisiert den Wert weit (string | number | Array | undefined);
    // der Formatter darf davon nichts sehen.
    expect(props.formatter?.('12.5', 'x', {}, 0, [])).toEqual(['12.50 €', 'x']);
  });

  it('sollte einen Serien-Namen über die übergebene Zuordnung übersetzen', () => {
    const props = chartTooltipProps({
      formatValue: (value) => String(value),
      seriesLabels: { income: 'Einnahmen' },
    });
    expect(props.formatter?.(1, 'income', {}, 0, [])).toEqual(['1', 'Einnahmen']);
  });

  it('sollte einen unbekannten Serien-Namen unverändert durchreichen', () => {
    const props = chartTooltipProps({
      formatValue: (value) => String(value),
      seriesLabels: { income: 'Einnahmen' },
    });
    expect(props.formatter?.(1, 'unbekannt', {}, 0, [])).toEqual(['1', 'unbekannt']);
  });

  it('sollte das Label über den übergebenen Formatter führen', () => {
    const props = chartTooltipProps({ formatLabel: (label) => `Am ${label}` });
    expect(props.labelFormatter?.('1.3.', [])).toBe('Am 1.3.');
  });

  it('[REGRESSION] sollte einen nicht-numerischen Wert nicht als NaN anzeigen', () => {
    // chartNumber() macht die Konvertierung total; ohne sie stand hier NaN €.
    const props = chartTooltipProps({ formatValue: (value) => `${value.toFixed(2)} €` });
    expect(props.formatter?.(undefined, 'x', {}, 0, [])).toEqual(['0.00 €', 'x']);
  });
});

describe('niceTicksForData', () => {
  const data = [
    { income: 100, expenses: 40 },
    { income: 890, expenses: 1795 },
    { income: 2695, expenses: 300 },
  ];

  it('sollte über ALLE angegebenen Serien rechnen, nicht nur über die erste', () => {
    // Sonst fällt eine Serie aus der Achse — genau der Fehler, den die
    // Handrechnung in AdvancedBalanceChart vermied und den jede Abschrift
    // erneut riskiert hätte.
    const ticks = niceTicksForData(data, ['income', 'expenses']);
    expect(ticks).not.toBeNull();
    expect(ticks![0]).toBeLessThanOrEqual(40);
    expect(ticks![ticks!.length - 1]).toBeGreaterThanOrEqual(2695);
  });

  it('sollte runde Schrittweiten liefern statt interpolierter Zwischenwerte', () => {
    const ticks = niceTicksForData(data, ['income', 'expenses'])!;
    const step = ticks[1] - ticks[0];
    // 1/2/5 × 10^n — die Prüfung, die Befund D-1 zugrunde lag.
    const mantissa = step / Math.pow(10, Math.floor(Math.log10(step)));
    expect([1, 2, 5]).toContain(Math.round(mantissa));
  });

  it('sollte bei leeren Daten null liefern', () => {
    expect(niceTicksForData([], ['income'])).toBeNull();
  });

  it('sollte nicht-numerische und fehlende Werte überspringen', () => {
    const mixed = [{ v: 10 }, { v: undefined }, { v: Number.NaN }, { v: 50 }];
    const ticks = niceTicksForData(mixed, ['v'])!;
    expect(ticks[0]).toBeLessThanOrEqual(10);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(50);
    expect(ticks.every(Number.isFinite)).toBe(true);
  });

  it('[REGRESSION] sollte bei ausschließlich unbrauchbaren Werten null liefern statt einer NaN-Achse', () => {
    expect(niceTicksForData([{ v: Number.NaN }], ['v'])).toBeNull();
  });
});

describe('niceTicksForStackedData', () => {
  it('sollte die Stapelsumme abdecken, nicht das größte Einzelsegment', () => {
    // Der Fehler, den diese Funktion verhindert: eine Achse, die bei drei
    // Segmenten à 400 € bei 400 € endet — die Balken ragen dann sichtbar über
    // ihr eigenes Diagramm hinaus.
    const data = [{ a: 400, b: 400, c: 400 }];
    const ticks = niceTicksForStackedData(data, ['a', 'b', 'c'])!;
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(1200);
  });

  it('sollte positive und negative Segmente getrennt summieren', () => {
    // Sonst verrechnete sich ein Stapel mit beiden Vorzeichen zu null und die
    // Achse zeigte einen viel zu kleinen Bereich.
    const data = [{ up: 500, down: -300 }];
    const ticks = niceTicksForStackedData(data, ['up', 'down'])!;
    expect(ticks[0]).toBeLessThanOrEqual(-300);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(500);
  });

  it('sollte die Nulllinie immer einschließen', () => {
    // Ein Stapel wächst von 0 aus — eine Achse, die dort nicht beginnt, wäre
    // in der Balkenlänge nicht mehr proportional lesbar.
    const ticks = niceTicksForStackedData([{ a: 900 }, { a: 1000 }], ['a'])!;
    expect(ticks[0]).toBeLessThanOrEqual(0);
  });

  it('sollte bei leeren Daten null liefern', () => {
    expect(niceTicksForStackedData([], ['a'])).toBeNull();
    expect(niceTicksForStackedData([{ a: undefined }], ['a'])).toBeNull();
  });
});

describe('valueAxisProps', () => {
  it('sollte Ticks und die passende Domain gemeinsam setzen', () => {
    // Recharts skaliert nach `domain`, nicht nach `ticks`. Nur Ticks zu setzen
    // schneidet die äußeren Beschriftungen ab — der Grund, beides hier zu
    // koppeln statt an 13 Aufrufstellen von Hand.
    const ticks = [0, 500, 1000];
    const props = valueAxisProps({ ticks });
    expect(props.ticks).toEqual(ticks);
    expect(props.domain).toEqual([0, 1000]);
  });

  it('sollte ohne Ticks keine Domain erzwingen', () => {
    const props = valueAxisProps({ ticks: null });
    expect(props.ticks).toBeUndefined();
    expect(props.domain).toBeUndefined();
  });

  it('sollte einheitliche Achsen-Optik liefern', () => {
    const props = valueAxisProps({ ticks: null });
    expect(props.tickLine).toBe(false);
    expect(props.axisLine).toBe(false);
    expect(props.stroke).toContain('var(--');
  });

  it('sollte einen Tick-Formatter durchreichen', () => {
    const props = valueAxisProps({ ticks: null, tickFormatter: (v) => `${v} €` });
    expect(props.tickFormatter?.(5, 0)).toBe('5 €');
  });
});
