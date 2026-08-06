/**
 * WP-6.4 — Vermögen als Volumen.
 *
 * Ersetzt den 2,5 px hohen Zusammensetzungsbalken. Der zeigte **Anteile**
 * korrekt, aber keine **Größenordnung**: Ein Vermögen aus 2.000 € und eines
 * aus 200.000 € sahen identisch aus, solange die Aufteilung dieselbe war.
 *
 * Jeder Posten ist jetzt ein Kreis, dessen **Fläche** proportional zum Betrag
 * ist (`@/lib/volume-scale` — Radius über die Wurzel, sonst wächst die Fläche
 * quadratisch mit dem Wert und die Grafik lügt).
 *
 * Die Kreise wachsen beim Erscheinen aus dem Nichts auf ihre Größe, statt
 * fertig dazustehen (Design-Prinzip 2). Bei reduzierter Bewegung stehen sie
 * sofort in Endgröße.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/useI18n';
import { useMotionQuality } from '@/hooks/useMotionQuality';
import { MOTION_DURATIONS, MOTION_EASINGS } from '@/lib/motion-tokens';
import { volumeSegments, type VolumeItem } from '@/lib/volume-scale';

/** Höchster Radius in Pixeln — der größte Posten füllt die Fläche. */
const MAX_RADIUS = 52;
/** Kleinster sichtbarer Radius: „sehr klein" ist eine andere Aussage als „nicht vorhanden". */
const MIN_RADIUS = 7;

export type AssetVolumeItem = VolumeItem & {
  label: string;
  /** Tailwind-Klasse für die Füllfarbe, z. B. `bg-brand`. */
  colorClass: string;
  formattedValue: string;
};

export type AssetVolumeProps = {
  items: readonly AssetVolumeItem[];
  className?: string;
};

export function AssetVolume({ items, className }: AssetVolumeProps) {
  const { t } = useI18n();
  const motion = useMotionQuality();
  const durationMs = motion.duration(MOTION_DURATIONS.slow);

  const segments = volumeSegments(items, { maxRadius: MAX_RADIUS, minRadius: MIN_RADIUS });

  // Erst nach dem ersten Paint auf die Zielgroesse gehen, damit der Uebergang
  // sichtbar von 0 aus waechst. Bei durationMs === 0 steht die Endgroesse
  // sofort — sonst gaebe es einen unsichtbaren, aber echten Sprung.
  const [grown, setGrown] = useState(durationMs === 0);
  useEffect(() => {
    if (durationMs === 0) {
      setGrown(true);
      return;
    }
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, [durationMs]);

  if (segments.length === 0) return null;

  const byKey = new Map(items.map((item) => [item.key, item]));

  return (
    <div className={cn('flex flex-wrap items-end gap-x-5 gap-y-3', className)}>
      {segments.map((segment, index) => {
        const item = byKey.get(segment.key)!;
        const size = segment.radius * 2;
        return (
          <div key={segment.key} className="flex flex-col items-center gap-1.5">
            <div
              className={cn('rounded-full', item.colorClass)}
              style={{
                width: grown ? size : 0,
                height: grown ? size : 0,
                transition:
                  durationMs === 0
                    ? undefined
                    : // Gestaffelt: die Posten erscheinen nacheinander, damit
                      // der Groessenvergleich lesbar bleibt statt alles
                      // gleichzeitig aufzugehen. Auf sparsamen Stufen ohne
                      // Staffelung (stagger === false).
                      `width ${durationMs}ms ${MOTION_EASINGS.build} ${motion.stagger ? index * 80 : 0}ms, height ${durationMs}ms ${MOTION_EASINGS.build} ${motion.stagger ? index * 80 : 0}ms`,
              }}
              aria-hidden="true"
            />
            <span className="text-[11px] leading-none text-muted-foreground">{item.label}</span>
          </div>
        );
      })}

      {/* WP-6.10: Die Kreise sind fuer Hilfstechnik ausgeblendet; hier steht
          dieselbe Aussage als Text. Betrag UND Anteil, weil die Grafik beides
          zeigt. */}
      <ul className="sr-only">
        {segments.map((segment) => (
          <li key={segment.key}>
            {t('netWorth.volumeShare')
              .replace('{label}', byKey.get(segment.key)!.label)
              .replace('{value}', byKey.get(segment.key)!.formattedValue)
              .replace('{percent}', String(Math.round(segment.share * 100)))}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default AssetVolume;
