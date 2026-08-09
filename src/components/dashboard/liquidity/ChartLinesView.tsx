/**
 * Liniendarstellung der Liquiditätsprognose.
 *
 * Herausgelöst aus `LiquidityReport.tsx` (1.147 Zeilen). Die Komponente war
 * dort bereits als eigene Funktion geschrieben — sie lag nur in derselben
 * Datei wie die Abfragen und vier weitere Ansichten.
 */
import { useId } from 'react';
import { format, parseISO } from 'date-fns';
import { useDateFnsLocale } from '@/i18n/useDateFnsLocale';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useI18n } from '@/i18n/useI18n';
import { useMoneyFormat } from '@/hooks/useMoneyFormat';
import { useChartAnimation } from '@/hooks/useChartAnimation';
import { getChartColors } from '@/lib/chart-theme';
import { chartTooltipProps } from '@/lib/chart-tooltip';
import { useSeriesSummary } from '@/hooks/useSeriesSummary';
import { ChartFigure } from '@/components/common/ChartFigure';
import { BAND_LAYERS, eur, fmtDate, type ChartPoint } from './chart-shared';

/**
 * Lines view of the chart with theme-aware colors.
 * Uses gradients and line colors that adapt to light/dark mode.
 */
export function ChartLinesView({
  chartData,
  hasBand,
  safetyBuffer,
}: {
  chartData: ChartPoint[];
  hasBand: boolean;
  safetyBuffer: number;
}) {
  const money = useMoneyFormat();
  const { t } = useI18n();
  const dateFnsLocale = useDateFnsLocale();
  const seriesSummary = useSeriesSummary();
  const colors = getChartColors();
  // Baseline: Daten bauen sich auf; bei prefers-reduced-motion direkt Zielzustand.
  const chartAnimation = useChartAnimation();
  // WP-6.8: Gradient-IDs aus `useId()`. Vorher `Date.now()` — das erzeugte bei
  // JEDEM Render eine neue ID (der Browser behaelt die alten `<defs>` im
  // Dokument) und kollidierte, sobald zwei Charts in derselben Millisekunde
  // montieren. `useId()` ist stabil und je Instanz eindeutig.
  const reactId = useId().replace(/:/g, '');
  const gradientId = `liqFill-${reactId}`;
  const mcBandGradientId = `mcBandFill-${reactId}`;
  const horizonMaskId = `horizonMask-${reactId}`;

  // Serien-Namen uebersetzt statt hartkodiert (AGENTS.md Paragraf 6). Die
  // Zuordnung steht in der Komponente und nicht als Modul-Konstante: eine
  // Modul-`const` mit `t()` friert beim Import ein und ignoriert jeden
  // spaeteren Sprachwechsel (AGENTS.md Paragraf 6, Fallen-Tabelle).
  const seriesLabels = {
    operating: t('liquidityReport.seriesOperating'),
    median: t('liquidityReport.seriesMedian'),
  };

  return (
    // WP-6.10: Der Verlauf ist die Kernaussage der Prognose — ohne
    // nicht-visuelle Fassung waere sie fuer Screenreader gar nicht vorhanden.
    <ChartFigure
      caption={t('liquidityReport.liquidityChartCaption')}
      summary={seriesSummary({
        title: t('liquidityReport.liquidityChartCaption'),
        values: chartData.map((point) => point.operating),
        formatValue: (value) => money.mask(eur.format(value)),
        labelAt: (index) => fmtDate(chartData[index]?.date ?? '', dateFnsLocale),
      })}
      columns={[
        { key: 'date', label: t('balanceChart.dateColumn'), format: (row) => fmtDate(row.date, dateFnsLocale) },
        {
          key: 'operating',
          label: t('liquidityReport.seriesOperating'),
          numeric: true,
          format: (row) => money.mask(eur.format(row.operating)),
        },
        {
          key: 'median',
          label: t('liquidityReport.seriesMedian'),
          numeric: true,
          format: (row) => (row.median === undefined ? '—' : money.mask(eur.format(row.median))),
        },
        {
          // WP-6.1/6.10: Die Unsicherheit gehoert auch in die nicht-visuelle
          // Fassung. Ohne sie laese sich der Median wie eine Zusage.
          key: 'range',
          label: t('liquidityReport.rangeColumn'),
          numeric: true,
          format: (row) =>
            row.outerFloor === undefined || row.outerHeight === undefined
              ? '—'
              : `${money.mask(eur.format(row.outerFloor))} – ${money.mask(eur.format(row.outerFloor + row.outerHeight))}`,
        },
      ]}
      rows={chartData}
      rowKey={(row) => row.date}
    >
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={colors.operatingFillStart} stopOpacity={colors.operatingFillStartOpacity} />
              <stop offset="95%" stopColor={colors.operatingFillStart} stopOpacity={colors.operatingFillEndOpacity} />
            </linearGradient>
            {/* WP-6.1: Drei Fuellungen derselben Farbe, nach aussen schwaecher.
                Weil die Flaechen einander ueberlagern, addiert sich die Deckkraft
                zur Mitte hin — der Rand franst aus, statt zu schneiden. */}
            {/*
              WP-6.2 — Horizont-Perspektive.

              Eine Prognose ist am Tag 1 fast eine Tatsache und am Tag 365 eine
              Vermutung. Bisher sah beides gleich aus: dieselbe Deckkraft ueber
              die gesamte Breite, die Ferne also genauso behauptet wie die Naehe.

              Dieser Verlauf laeuft WAAGERECHT ueber die Zeitachse und laesst
              die spaeten Tage ausduennen. Als Maske und nicht als zweite
              Farbe, damit er auf alle drei Konfidenz-Ebenen gleich wirkt und
              sich nicht mit deren eigener Deckkraft verrechnet.

              Bis zur Haelfte des Horizonts bleibt die Darstellung voll: der
              naechste Monat ist die Aussage, mit der man plant, und ihn
              vorzeitig auszublenden waere Effekt statt Information.
            */}
            <linearGradient id={`${horizonMaskId}-gradient`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="white" stopOpacity={1} />
              <stop offset="50%" stopColor="white" stopOpacity={1} />
              <stop offset="100%" stopColor="white" stopOpacity={0.35} />
            </linearGradient>
            <mask id={horizonMaskId} maskUnits="objectBoundingBox" x="0" y="0" width="1" height="1">
              <rect x="0" y="0" width="1" height="1" fill={`url(#${horizonMaskId}-gradient)`} />
            </mask>
            {BAND_LAYERS.map((layer) => (
              <linearGradient key={layer.key} id={`${mcBandGradientId}-${layer.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor={colors.mcBandStart}
                  stopOpacity={colors.mcBandStartOpacity * layer.opacityFactor}
                />
                <stop
                  offset="95%"
                  stopColor={colors.mcBandStart}
                  stopOpacity={colors.mcBandEndOpacity * layer.opacityFactor}
                />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.gridStroke} />
          <XAxis
            dataKey="date"
            tickFormatter={(v: string) => format(parseISO(v), 'MMM', { locale: dateFnsLocale })}
            minTickGap={32}
            tick={{ fontSize: 12, fill: colors.axisText }}
            axisLine={{ stroke: colors.axisStroke }}
          />
          <YAxis
            tickFormatter={(v: number) => money.mask(eur.format(v))}
            width={72}
            tick={{ fontSize: 12, fill: colors.axisText }}
            axisLine={{ stroke: colors.axisStroke }}
          />
          <Tooltip
            {...chartTooltipProps({
              formatValue: (v) => money.mask(eur.format(v)),
              formatLabel: (l) => fmtDate(l, dateFnsLocale),
              seriesLabels,
            })}
          />
          {/* WP-6.1: Von aussen nach innen gezeichnet. Je Ebene ein
              unsichtbarer Sockel plus die sichtbare Hoehe darueber — Recharts
              kennt keine Flaeche zwischen zwei Kurven, nur Stapel. Jede Ebene
              braucht ihre EIGENE stackId, sonst stapelten sich die drei
              Baender uebereinander statt ineinander. */}
          {hasBand &&
            BAND_LAYERS.map((layer) => (
              <Area
                key={`${layer.key}-floor`}
                type="monotone"
                dataKey={layer.floorKey}
                name={layer.floorKey}
                stackId={layer.key}
                stroke="none"
                fill="transparent"
                isAnimationActive={chartAnimation.animate}
                animationDuration={chartAnimation.animationDuration}
                animationEasing={chartAnimation.animationEasing}
                legendType="none"
                tooltipType="none"
              />
            ))}
          {hasBand &&
            BAND_LAYERS.map((layer) => (
              <Area
                key={`${layer.key}-height`}
                type="monotone"
                dataKey={layer.heightKey}
                name={layer.heightKey}
                stackId={layer.key}
                stroke="none"
                fill={`url(#${mcBandGradientId}-${layer.key})`}
                // WP-6.2: laesst die Flaeche zum Horizont hin ausduennen.
                mask={`url(#${horizonMaskId})`}
                isAnimationActive={chartAnimation.animate}
                animationDuration={chartAnimation.animationDuration}
                animationEasing={chartAnimation.animationEasing}
                legendType="none"
                tooltipType="none"
              />
            ))}
          <Area
            type="monotone"
            dataKey="operating"
            name="operating"
            stroke={colors.operatingStroke}
            strokeWidth={2}
            fill={hasBand ? 'transparent' : `url(#${gradientId})`}
            isAnimationActive={chartAnimation.animate}
            animationDuration={chartAnimation.animationDuration}
            animationEasing={chartAnimation.animationEasing}
          />
          {hasBand && (
            <Line
              type="monotone"
              dataKey="median"
              name="median"
              stroke={colors.medianStroke}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={chartAnimation.animate}
              animationDuration={chartAnimation.animationDuration}
              animationEasing={chartAnimation.animationEasing}
            />
          )}
          {safetyBuffer > 0 && (
            <ReferenceLine
              y={safetyBuffer}
              stroke={colors.bufferLine}
              strokeDasharray="4 4"
              label={{ value: 'Puffer', position: 'insideTopRight', fontSize: 11, fill: colors.axisText }}
            />
          )}
          <ReferenceLine
            y={0}
            stroke={colors.zeroLine}
            strokeDasharray="2 2"
            label={{ value: '0 €', position: 'insideBottomRight', fontSize: 11, fill: colors.axisText, offset: -8 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
    </ChartFigure>
  );
}
