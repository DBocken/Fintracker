/**
 * SignatureMoment — WP-6.5: Der Signature Moment für Zielerreichung.
 *
 * Ein 2-sekündiger, vollständiger Feier-Moment:
 * 1. CelebrationBurst (Strahlen-Burst aus dem Zentrum)
 * 2. Titel mit Scale-Animation (1.0 → 1.1 → 1.0)
 * 3. Dezenter Glow-Effekt (positive border + gradient)
 * 4. Optionales Subtitle (Betrag, Beschreibung)
 *
 * Designentscheidung:
 * - Maximal 2s Gesamtdauer, dann ist es vorbei
 * - Kein aufdringlicher Konfetti-Regen, kein "Spielzeug"
 * - Würdevoll, nicht albern
 * - Respektiert prefers-reduced-motion (statischer Glow, kein Burst)
 *
 * @see docs/aaa-plus/tdd-specs.md — WP-6.5
 */

import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/utils';
import CelebrationBurst from './CelebrationBurst';
import { MOTION_EASINGS_BEZIER } from '@/lib/motion-tokens';

type SignatureMomentVariant = 'small' | 'default' | 'large';

type SignatureMomentProps = {
  /** Der erreichte Meilenstein-Titel. */
  title: string;
  /** Icon/Emoji des Meilensteins. */
  icon: string;
  /** Optionaler Subtitle (z.B. "1.000 € gespart"). */
  subtitle?: string;
  /** Größenvariante: 'small' für kompakte Einbindung, 'large' für Signature Moments. */
  variant?: SignatureMomentVariant;
  /** Zusätzliche CSS-Klassen. */
  className?: string;
};

const BURST_SIZES: Record<SignatureMomentVariant, number> = {
  small: 24,
  default: 32,
  large: 48,
};

export function SignatureMoment({
  title,
  icon,
  subtitle,
  variant = 'default',
  className,
}: SignatureMomentProps) {
  const reduce = useReducedMotion();
  const burstSize = BURST_SIZES[variant];

  return (
    <motion.div
      data-testid="signature-moment"
      className={cn(
        'rounded-xl border border-positive/50 bg-gradient-to-r from-positive/15 to-transparent p-4',
        className,
      )}
      initial={reduce ? false : { scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={reduce ? { duration: 0 } : { duration: 0.4, ease: MOTION_EASINGS_BEZIER.precision }}
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-positive">
        <CelebrationBurst size={burstSize} />
        <span aria-hidden>{icon}</span>
        <motion.span
          data-testid="signature-title"
          initial={reduce ? false : { scale: 1 }}
          animate={reduce ? {} : { scale: [1, 1.08, 1] }}
          transition={{ duration: 0.6, delay: 0.3, ease: MOTION_EASINGS_BEZIER.confirm }}
        >
          {title}
        </motion.span>
      </div>
      {subtitle && (
        <motion.div
          className="mt-1 text-xs text-muted-foreground"
          initial={reduce ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          // Wie beim Container an `reduce` gekoppelt. Heute traegt schon
          // `initial={false}` den statischen Fall; ohne die Kopplung bliebe
          // aber eine 0.3s-Bewegung mit 0.5s Verzoegerung stehen, sobald hier
          // jemals ein Wert animiert wird.
          transition={reduce ? { duration: 0 } : { duration: 0.3, delay: 0.5 }}
        >
          {subtitle}
        </motion.div>
      )}
    </motion.div>
  );
}
