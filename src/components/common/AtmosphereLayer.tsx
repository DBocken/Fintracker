/**
 * AtmosphereLayer — datengesteuerte atmosphärische Hintergrundschicht (WP-3.1).
 *
 * Rendert ein fixiertes, klick-durchlässiges Div mit CSS-Gradients, deren
 * Farben und Opazität vom AtmosphereState gesteuert werden. Die Schicht ist
 * subtil (Opazität ≤ 0.1) und verleiht der App eine emotionale Grundstimmung,
 * die auf die Finanzsituation reagiert.
 *
 * Designentscheidung:
 * - Warm = dezenter Amber/Petrol-Mix (Stabilität, positive Entwicklung)
 * - Cool = dezenter Indigo/Eisblau-Mix (Vorsicht, Risiko)
 * - Neutral = transparent (keine Aussage, ruhig)
 *
 * @see docs/aaa-plus/tdd-specs.md — WP-3.1
 */

import { memo } from 'react';
import type { AtmosphereState, AtmosphereTemperature } from '@/hooks/useAtmosphereState';

/**
 * Akzentfarben je Temperatur für kleine Stimmungs-Hinweise außerhalb der
 * Schicht selbst (z. B. die Stadt-Karte auf dem Dashboard, Befund A-3).
 * Dieselben Farbtöne wie die Gradients unten — eine Stimmungssprache, zwei
 * Intensitäten. `neutral` ist bewusst `null`: keine Aussage, keine Färbung.
 */
export const ATMOSPHERE_ACCENTS: Record<
  AtmosphereTemperature,
  { background: string; color: string } | null
> = {
  warm: { background: 'hsla(38, 70%, 55%, 0.16)', color: 'hsl(38, 65%, 45%)' },
  cool: { background: 'hsla(210, 60%, 50%, 0.16)', color: 'hsl(210, 60%, 50%)' },
  neutral: null,
};

type AtmosphereLayerProps = {
  state: AtmosphereState;
};

/** Maximale Opazität — subtil, niemals dominant (VB-2). */
const MAX_OPACITY = 0.08;

/** Farbverläufe je Temperatur. */
const GRADIENTS = {
  warm: [
    'radial-gradient(900px 600px at 70% 10%, hsla(38, 70%, 55%, 1), transparent 60%)',
    'radial-gradient(700px 500px at 15% 85%, hsla(174, 45%, 35%, 0.6), transparent 55%)',
  ].join(', '),
  cool: [
    'radial-gradient(900px 600px at 70% 10%, hsla(210, 60%, 50%, 1), transparent 60%)',
    'radial-gradient(700px 500px at 15% 85%, hsla(195, 40%, 40%, 0.5), transparent 55%)',
  ].join(', '),
  neutral: 'transparent',
} as const;

function AtmosphereLayerImpl({ state }: AtmosphereLayerProps) {
  const { temperature, intensity } = state;

  // Opazität proportional zur Intensity, gecapped bei MAX_OPACITY
  const opacity = Math.min(MAX_OPACITY, intensity * MAX_OPACITY);
  const gradient = GRADIENTS[temperature];

  return (
    <div
      data-testid="atmosphere-layer"
      data-temperature={temperature}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        backgroundImage: gradient,
        opacity,
        transition: 'opacity var(--motion-duration-slow, 600ms) var(--motion-easing-spatial, ease), background-image var(--motion-duration-slow, 600ms) var(--motion-easing-spatial, ease)',
      }}
    />
  );
}

export const AtmosphereLayer = memo(AtmosphereLayerImpl);
