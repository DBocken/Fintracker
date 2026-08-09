/**
 * Die zwei ungefragten Wortbeiträge über der Stadt-Fläche — beide zeitlich
 * begrenzt, beide `pointer-events-none`. Herausgelöst aus `CityPage.tsx` in
 * WP 6.4.
 *
 * - **Erst-Besuch-Hinweis** (WP-D3, Klick-Affordanz): „Tippe auf ein Viertel",
 *   nur auf Stadt-Ebene, bis zum ersten Drill-down. Bewusst über dem
 *   Kontext-Chip (`bottom-12`), damit sich beide auf schmalen Viewports nicht
 *   überlagern. Er gleitet dezent von unten ein statt aufzupoppen
 *   (`docs/design-principles.md` Prinzip 2), verzögert, damit er erst nach dem
 *   Balken-Aufbau Aufmerksamkeit bekommt.
 * - **Signature Moment** (WP-5.5): „Das ist Ihre finanzielle Welt", einmalig
 *   nach dem erstmaligen Aufbau der Stadt.
 */

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useI18n } from '@/i18n/useI18n';
import { useMotionSafe, useReducedMotion } from '@/hooks/useReducedMotion';
import { MOTION_EASINGS_BEZIER } from '@/lib/motion-tokens';
import { isFirstVisit, markVisited } from './first-visit';

/** Wartezeit bis zum Signature Moment: BUILD_STAGGER_MS-Kaskade plus Höhen-Tweens. */
const SIGNATURE_DELAY_MS = 1500;
const SIGNATURE_VISIBLE_MS = 3000;

export function CityTapHint() {
  const { t } = useI18n();
  const motionProps = useMotionSafe({
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: 0.8, duration: 0.35 },
  });

  return (
    <motion.div
      {...motionProps}
      data-testid="city-tap-hint"
      className="pointer-events-none absolute inset-x-0 bottom-12 flex justify-center"
    >
      <span className="rounded-full bg-background/80 px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
        {t('city.tapHint')}
      </span>
    </motion.div>
  );
}

/** `active` = die Stadt steht (Daten geladen, Canvas gemountet). */
export function CitySignatureMoment({ active }: { active: boolean }) {
  const { t } = useI18n();
  const reducedMotion = useReducedMotion();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active || !isFirstVisit()) return;
    const timer = setTimeout(() => {
      setVisible(true);
      markVisited();
      const hideTimer = setTimeout(() => setVisible(false), SIGNATURE_VISIBLE_MS);
      return () => clearTimeout(hideTimer);
    }, SIGNATURE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [active]);

  if (!visible) return null;

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reducedMotion ? {} : { opacity: 0, y: -10 }}
      transition={{ duration: 0.6, ease: MOTION_EASINGS_BEZIER.precision }}
      className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center"
    >
      <div className="rounded-2xl bg-background/90 px-8 py-4 text-center shadow-lg backdrop-blur-sm">
        <p className="text-lg font-semibold text-foreground">{t('city.signatureMoment')}</p>
      </div>
    </motion.div>
  );
}
