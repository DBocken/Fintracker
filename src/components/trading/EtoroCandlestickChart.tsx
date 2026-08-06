import { ResponsiveContainer, ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { chartTooltipProps } from '@/lib/chart-tooltip';
import { ChartFigure } from '@/components/common/ChartFigure';
import { useI18n } from '@/i18n/useI18n';
import { useChartAnimation } from '@/hooks/useChartAnimation';
import { formatCurrency } from '@/lib/utils';
import type { CandlePoint } from '@/services/etoro-discover';

interface EtoroCandlestickChartProps {
  candles: CandlePoint[];
  height?: number;
}

const POSITIVE = 'hsl(var(--positive))';
const WARNING = 'hsl(var(--warning))';

function formatAxisDate(date: string, locale: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-US', { day: '2-digit', month: '2-digit' });
}

interface CandleShapeProps {
  x: number;
  y: number;
  width: number;
  height: number;
  payload: CandlePoint;
}

export interface CandleGeometry {
  color: string;
  centerX: number;
  bodyX: number;
  bodyWidth: number;
  bodyTop: number;
  bodyHeight: number;
  wickY1: number;
  wickY2: number;
}

/**
 * Berechnet Docht (high→low) und Körper (open→close) innerhalb der vom Bar
 * bereits auf [low, high] skalierten Pixel-Box — y entspricht `high`,
 * y+height entspricht `low` (Standard-Mapping für Range-Bars in Recharts).
 * Als reine Funktion exportiert, damit die Geometrie ohne Recharts/jsdom-
 * Layout-Quirks direkt getestet werden kann.
 */
export function computeCandleGeometry({ x, y, width, height, payload }: CandleShapeProps): CandleGeometry {
  const { open, close, high, low, isUp } = payload;
  const color = isUp ? POSITIVE : WARNING;
  const range = high - low || 1;

  const valueToY = (value: number) => y + height * ((high - value) / range);
  const bodyTop = valueToY(Math.max(open, close));
  const bodyBottom = valueToY(Math.min(open, close));
  const bodyHeight = Math.max(bodyBottom - bodyTop, 1);

  const centerX = x + width / 2;
  const bodyWidth = Math.max(width * 0.6, 1);
  const bodyX = centerX - bodyWidth / 2;

  return { color, centerX, bodyX, bodyWidth, bodyTop, bodyHeight, wickY1: y, wickY2: y + height };
}

function Candle(props: unknown) {
  const { color, centerX, bodyX, bodyWidth, bodyTop, bodyHeight, wickY1, wickY2 } = computeCandleGeometry(
    props as CandleShapeProps,
  );

  return (
    <g>
      <line x1={centerX} x2={centerX} y1={wickY1} y2={wickY2} stroke={color} strokeWidth={1} />
      <rect x={bodyX} y={bodyTop} width={bodyWidth} height={bodyHeight} fill={color} />
    </g>
  );
}

/**
 * OHLC-Candlestick-Chart für die Instrument-Detailansicht im Discover-Tab.
 * Nutzt einen Range-Bar (dataKey → [low, high]) mit eigenem Shape, damit
 * Docht+Körper aus echten OHLC-Daten gezeichnet werden (kein Recharts-
 * Candlestick-Preset vorhanden). Aufbau-Animation nutzt die zentralen
 * Motion-Tokens (WP-6.7), außer bei prefers-reduced-motion.
 */
export default function EtoroCandlestickChart({ candles, height = 300 }: EtoroCandlestickChartProps) {
  const { t, locale } = useI18n();
  const chartAnimation = useChartAnimation();

  const chartData = candles.map((candle) => ({
    ...candle,
    label: formatAxisDate(candle.date, locale),
    range: [candle.low, candle.high] as [number, number],
  }));

  return (
    // WP-6.10: OHLC-Werte auch ohne Diagramm zugaenglich.
    <ChartFigure
      caption={t('trading.etoro.discover.candlesTooltipLabel')}
      columns={[
        { key: 'label', label: t('balanceChart.dateColumn'), format: (row) => row.label },
        { key: 'open', label: 'O', numeric: true, format: (row) => formatCurrency(row.open, 'USD') },
        { key: 'high', label: 'H', numeric: true, format: (row) => formatCurrency(row.high, 'USD') },
        { key: 'low', label: 'L', numeric: true, format: (row) => formatCurrency(row.low, 'USD') },
        { key: 'close', label: 'C', numeric: true, format: (row) => formatCurrency(row.close, 'USD') },
      ]}
      rows={chartData}
      rowKey={(row, index) => `${row.label}-${index}`}
    >
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" />
        <YAxis domain={['auto', 'auto']} />
        <Tooltip
          {...chartTooltipProps()}
          formatter={(_value, _name, item) => {
            const point = item?.payload as CandlePoint | undefined;
            if (!point) return ['—', ''];
            return [
              `O ${formatCurrency(point.open, 'USD')} · H ${formatCurrency(point.high, 'USD')} · L ${formatCurrency(point.low, 'USD')} · C ${formatCurrency(point.close, 'USD')}`,
              t('trading.etoro.discover.candlesTooltipLabel'),
            ];
          }}
        />
        <Bar
          dataKey="range"
          shape={Candle}
          isAnimationActive={chartAnimation.animate}
          animationDuration={chartAnimation.animationDuration}
          animationEasing={chartAnimation.animationEasing}
        />
      </ComposedChart>
    </ResponsiveContainer>
    </ChartFigure>
  );
}
