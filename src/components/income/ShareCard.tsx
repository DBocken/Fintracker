import { useI18n } from '@/i18n/useI18n';
import type { ShareCardData } from '@/lib/share-card';

export type ShareCardFormat = 'story' | 'square';

/**
 * Feste Hex-Palette (KEINE Theme-CSS-Variablen): html-to-image kann
 * `hsl(var(--…))` im geklonten Baum nicht zuverlässig auflösen, und der Export
 * soll unabhängig vom Dark-Mode konsistent aussehen.
 */
const SLICE_COLORS = ['#2e7d72', '#3a9d8e', '#5cb8a6', '#84c9bb', '#a9d9cf', '#c9c19a'];
const OTHER_COLOR = '#9aa0a6';
const BG_TOP = '#0f2e29';
const BG_BOTTOM = '#1d5c54';

const DIMENSIONS: Record<ShareCardFormat, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
};

/**
 * Teilbare Income-Mix-Karte in fester Export-Größe. Zeigt AUSSCHLIESSLICH
 * Prozentanteile — niemals Beträge (strukturelle Privacy-Garantie, siehe
 * buildShareCardData). Wird in `ShareCardDialog` skaliert vorgeschaut und per
 * `exportNodeAsPng` in Originalgröße als PNG exportiert.
 */
export default function ShareCard({ data, format }: { data: ShareCardData; format: ShareCardFormat }) {
  const { t } = useI18n();
  const { width, height } = DIMENSIONS[format];

  return (
    <div
      style={{
        width,
        height,
        background: `linear-gradient(160deg, ${BG_TOP} 0%, ${BG_BOTTOM} 100%)`,
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        padding: format === 'story' ? '120px 96px' : '88px 88px',
        boxSizing: 'border-box',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ fontSize: 34, letterSpacing: 4, textTransform: 'uppercase', opacity: 0.7 }}>
        {t('shell.appName')}
      </div>
      <div style={{ fontSize: format === 'story' ? 82 : 68, fontWeight: 700, marginTop: 40, lineHeight: 1.1 }}>
        {t('income.share.cardTitle')}
      </div>

      <div style={{ marginTop: 80, display: 'flex', flexDirection: 'column', gap: 44, flex: 1 }}>
        {data.slices.map((slice, i) => {
          const color = slice.isOther ? OTHER_COLOR : SLICE_COLORS[i % SLICE_COLORS.length];
          const label = slice.isOther ? t('income.share.cardOther') : slice.label;
          return (
            <div key={slice.key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18 }}>
                <span style={{ fontSize: 44, fontWeight: 600 }}>{label}</span>
                <span style={{ fontSize: 52, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{slice.percent} %</span>
              </div>
              <div style={{ height: 28, borderRadius: 14, background: 'rgba(255,255,255,0.15)', overflow: 'hidden' }}>
                <div style={{ width: `${slice.percent}%`, height: '100%', background: color, borderRadius: 14 }} />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 34, opacity: 0.7, marginTop: 60 }}>
        {t('income.share.cardStreamsCount').replace('{count}', String(data.streamCount))}
      </div>
    </div>
  );
}
