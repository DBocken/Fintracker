import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useI18n } from '@/i18n/useI18n';
import { useMotionSafe } from '@/hooks/useReducedMotion';
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber';
import { useMotionQuality } from '@/hooks/useMotionQuality';
import { MOTION_DURATIONS, MOTION_EASINGS_BEZIER } from '@/lib/motion-tokens';
import { SignatureMoment } from '@/components/common/SignatureMoment';
import { Button } from '@/components/ui/button';
import { exportNodeAsPng } from '@/lib/png-export';
import type { WrappedStats } from '@/lib/income-wrapped';
import ShareCard from '../ShareCard';
import { useRef } from 'react';

const formatCurrency = (v: number) =>
  v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

type SlideId = 'intro' | 'total' | 'bestMonth' | 'growth' | 'loyal' | 'diversity' | 'final';

function SlideShell({ children }: { children: React.ReactNode }) {
  // WP-7.5: Dauer aus dem Token statt fest verdrahteter 0.35 — und ueber die
  // Bewegungsstufe aufgeloest (WP-7.7). Ein Rueckblick ist eine Folge von
  // Uebergaengen; genau dort faellt eine abweichende Dauer auf.
  const motionQuality = useMotionQuality();
  const motionProps = useMotionSafe({
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: motionQuality.seconds(MOTION_DURATIONS.default),
      ease: MOTION_EASINGS_BEZIER.spatial,
    },
  });
  return (
    <motion.div
      {...motionProps}
      className="flex h-full w-full flex-col items-center justify-center gap-4 px-8 text-center"
    >
      {children}
    </motion.div>
  );
}

function CountUp({ value, format }: { value: number; format: (v: number) => string }) {
  // WP-7.5: Das Hochzaehlen IST die Erzaehlung eines Rueckblicks — die Zahl
  // baut sich auf, statt dazustehen. Bewusst die `signature`-Dauer und nicht
  // die Standarddauer: hier soll man beim Zusehen mitgehen koennen.
  const motionQuality = useMotionQuality();
  const shown = useAnimatedNumber(value, {
    durationMs: motionQuality.duration(MOTION_DURATIONS.signature),
  });
  return <span className="tabular-nums">{format(shown)}</span>;
}

export default function WrappedSlides({ stats, onClose }: { stats: WrappedStats; onClose: () => void }) {
  const { t } = useI18n();
  const exportRef = useRef<HTMLDivElement>(null);

  const slides = useMemo<SlideId[]>(() => {
    const s: SlideId[] = ['intro', 'total', 'bestMonth'];
    if (stats.fastestGrowingStream) s.push('growth');
    if (stats.mostRegularStream) s.push('loyal');
    s.push('diversity', 'final');
    return s;
  }, [stats]);

  const [index, setIndex] = useState(0);
  // `useCallback` statt einer Closure im Render-Körper: der Tastatur-Effekt
  // unten braucht eine stabile Referenz, die trotzdem auf ein aktuelles
  // `slides.length` reagiert — sonst müsste er `clamp` selbst ignorieren.
  const clamp = useCallback((i: number) => Math.max(0, Math.min(slides.length - 1, i)), [slides.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setIndex((i) => clamp(i + 1));
      else if (e.key === 'ArrowLeft') setIndex((i) => clamp(i - 1));
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clamp, onClose]);

  const current = slides[index];
  const isFinal = current === 'final';

  const handleAdvance = () => {
    if (!isFinal) setIndex((i) => clamp(i + 1));
  };

  const handleExport = async () => {
    if (exportRef.current) await exportNodeAsPng(exportRef.current, `einkommens-jahr-${stats.year}.png`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-[#0f2e29] to-[#1d5c54] text-white"
      tabIndex={0}
      autoFocus
    >
      {/* Fortschritts-Dots */}
      <div className="flex items-center justify-between p-4">
        <div className="flex gap-1.5" aria-label={t('income.wrapped.progressAria').replace('{current}', String(index + 1)).replace('{total}', String(slides.length))}>
          {slides.map((s, i) => (
            <span
              key={s}
              className={`h-1.5 rounded-full transition-all ${i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/40'}`}
            />
          ))}
        </div>
        <button type="button" onClick={onClose} aria-label={t('income.wrapped.close')} className="rounded-full p-2 hover:bg-white/10">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Slide-Fläche (Klick/Tap = weiter) */}
      <div
        className="flex-1 cursor-pointer"
        onClick={handleAdvance}
        role="button"
        tabIndex={-1}
        aria-label={t('income.wrapped.introHint')}
      >
        <AnimatePresence mode="wait">
          <div key={current} className="h-full">
            {current === 'intro' && (
              <SlideShell>
                <div className="text-2xl font-semibold opacity-80">{t('income.wrapped.title')}</div>
                <div className="text-4xl font-bold md:text-5xl">
                  {t('income.wrapped.introTitle').replace('{year}', String(stats.year))}
                </div>
                {stats.partialYear && <div className="text-sm opacity-70">{t('income.wrapped.partialNote')}</div>}
                <div className="mt-4 text-sm opacity-70">{t('income.wrapped.introHint')}</div>
              </SlideShell>
            )}
            {current === 'total' && (
              <SlideShell>
                <div className="text-xl opacity-80">{t('income.wrapped.totalTitle')}</div>
                <div className="text-5xl font-bold md:text-6xl">
                  <CountUp value={stats.totalIncome} format={formatCurrency} />
                </div>
                <div className="text-sm opacity-70">
                  {t('income.wrapped.totalCount').replace('{count}', String(stats.transactionCount))}
                </div>
              </SlideShell>
            )}
            {current === 'bestMonth' && stats.bestMonth && (
              <SlideShell>
                <div className="text-xl opacity-80">{t('income.wrapped.bestMonthTitle')}</div>
                <div className="text-4xl font-bold md:text-5xl">{stats.bestMonth.month}</div>
                <div className="text-2xl font-semibold">
                  <CountUp value={stats.bestMonth.total} format={formatCurrency} />
                </div>
              </SlideShell>
            )}
            {current === 'growth' && stats.fastestGrowingStream && (
              <SlideShell>
                <div className="text-xl opacity-80">{t('income.wrapped.growthTitle')}</div>
                <div className="text-4xl font-bold md:text-5xl">{stats.fastestGrowingStream.label}</div>
                <div className="text-2xl font-semibold">
                  {t('income.wrapped.growthValue').replace('{percent}', String(stats.fastestGrowingStream.growthPercent))}
                </div>
              </SlideShell>
            )}
            {current === 'loyal' && stats.mostRegularStream && (
              <SlideShell>
                <div className="text-xl opacity-80">{t('income.wrapped.loyalTitle')}</div>
                <div className="text-4xl font-bold md:text-5xl">{stats.mostRegularStream.label}</div>
                <div className="text-2xl font-semibold">
                  {t('income.wrapped.loyalValue').replace('{months}', String(stats.mostRegularStream.monthsActive))}
                </div>
              </SlideShell>
            )}
            {current === 'diversity' && (
              <SlideShell>
                <div className="text-xl opacity-80">{t('income.wrapped.diversityTitle')}</div>
                <div className="text-5xl font-bold md:text-6xl">
                  <CountUp value={stats.streamCount} format={(v) => String(Math.round(v))} />
                </div>
                <div className="text-2xl font-semibold">
                  {stats.diversification === 'concentrated'
                    ? t('income.diversificationConcentrated')
                    : stats.diversification === 'moderate'
                      ? t('income.diversificationModerate')
                      : t('income.diversificationDiversified')}
                </div>
              </SlideShell>
            )}
            {current === 'final' && (
              <SlideShell>
                {/* WP-7.5: Der Abschluss ist ein Signature Moment, keine
                    Share-Karte mit Ueberschrift. Der Rueckblick laeuft auf
                    eine Aussage zu — und `SignatureMoment` bringt dieselbe
                    Choreografie und dieselbe Haptik mit wie die uebrigen
                    Erfolgsmomente der App (WP-6.5, WP-7.8), statt hier eine
                    zweite, abweichende Fassung zu bauen. */}
                <SignatureMoment
                  title={t('income.wrapped.finalTitle').replace('{year}', String(stats.year))}
                  subtitle={t('income.wrapped.finalSubtitle')}
                  icon="🎉"
                  variant="large"
                  className="w-full max-w-md"
                />
                <div className="my-2" style={{ width: 1080 * 0.24, height: 1080 * 0.24, overflow: 'hidden' }}>
                  <div ref={exportRef} style={{ transform: 'scale(0.24)', transformOrigin: 'top left' }}>
                    <ShareCard data={stats.shareCard} format="square" />
                  </div>
                </div>
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button onClick={handleExport} variant="secondary">
                    {t('income.share.exportButton')}
                  </Button>
                  <Button onClick={onClose} variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10">
                    {t('income.wrapped.close')}
                  </Button>
                </div>
              </SlideShell>
            )}
          </div>
        </AnimatePresence>
      </div>
    </div>
  );
}
