/**
 * WP-7.7 — Motion: Performance-Grenzen & Degradation.
 *
 * Bewegung kostet auf jedem Gerät gleich viel Absicht, aber nicht gleich viel
 * Rechenzeit. Diese Datei legt fest, **wie viel** Bewegung ein Gerät bekommt —
 * nach demselben Muster wie WP-5.6 für die Finanzstadt: die Stufe wird VOR dem
 * ersten Frame aus dem Geräteprofil abgeleitet, nicht reaktiv aus gemessener
 * Bildrate. Eine reaktive Kaskade greift erst, NACHDEM der Nutzer das Ruckeln
 * gesehen hat; auf einem schwachen Telefon ist der erste Eindruck dann
 * systematisch der schlechteste.
 *
 * Die Geräteeinstufung selbst steht **nicht** hier, sondern in
 * `device-profile.ts` — geteilt mit der Stadt, damit es nicht zwei Meinungen
 * darüber gibt, was ein schwaches Gerät ist (der ausdrückliche Auftrag aus
 * `docs/aaa-plus/offene-punkte.md` §4: das Muster übernehmen statt eine zweite
 * Degradations-Logik zu bauen).
 *
 * Abgrenzung zu `prefers-reduced-motion`: Das ist **keine** Performance-Frage.
 * Die Nutzeraussage schlägt jede Hardware-Heuristik und führt als einzige zu
 * `durationScale === 0`, also zu gar keiner Bewegung. Ein schwaches Gerät
 * bewegt sich sparsamer, aber es bewegt sich — sonst ginge die
 * Objektkontinuität verloren, die Design-Prinzip 2 gerade herstellen will.
 */

import { classifyDevice, type DeviceProfile } from './device-profile';

/** Stufen von der aufwendigsten zur sparsamsten — die Reihenfolge IST die Ordnung. */
export const MOTION_TIERS = ['full', 'balanced', 'minimal'] as const;

export type MotionTier = (typeof MOTION_TIERS)[number];

export type MotionQualitySettings = {
  tier: MotionTier;
  /**
   * Faktor auf die Token-Dauern aus `motion-tokens.ts`. `0` bedeutet: keine
   * Bewegung (ausschließlich bei `prefers-reduced-motion`).
   */
  durationScale: number;
  /** Gestaffelter Auftritt von Listen/Karten — je Element ein eigener Zeitplan. */
  stagger: boolean;
  /** Parallaxe der Atmosphäre-Schicht: bewegt sich bei jedem Scroll-Frame neu. */
  parallax: boolean;
  /** Animierte `filter`/`backdrop-filter`-Effekte — auf mobilen GPUs die teuerste Klasse. */
  blur: boolean;
  /** Volle Choreografie der Signature Moments statt einer kurzen Bestätigung. */
  signatureMoments: boolean;
  /**
   * Obergrenze gleichzeitig animierter Listenelemente. Darüber hinausgehende
   * Elemente erscheinen ohne eigene Animation — die Liste bleibt lesbar,
   * ohne dass 400 Zeilen gleichzeitig interpoliert werden.
   */
  maxAnimatedItems: number;
};

/**
 * Effektumfang je Stufe. Monoton: was hier einmal `false` ist, bleibt auf jeder
 * sparsameren Stufe `false` (`motion-quality.test.ts` erzwingt das) — sonst
 * wäre „eine Stufe runter" keine verlässliche Entlastung.
 *
 * `signatureMoments` bleibt bis zur untersten Stufe an: ein erreichtes Ziel
 * bleibt ein erreichtes Ziel. Auf `minimal` wird die Rückmeldung durch
 * `durationScale` kürzer, nicht gestrichen. Gestrichen wird sie nur, wenn der
 * Nutzer reduzierte Bewegung verlangt.
 */
const TIER_SETTINGS: Record<MotionTier, Omit<MotionQualitySettings, 'tier'>> = {
  full: {
    durationScale: 1,
    stagger: true,
    parallax: true,
    blur: true,
    signatureMoments: true,
    maxAnimatedItems: 60,
  },
  balanced: {
    durationScale: 0.85,
    stagger: true,
    parallax: false,
    blur: false,
    signatureMoments: true,
    maxAnimatedItems: 24,
  },
  minimal: {
    durationScale: 0.6,
    stagger: false,
    parallax: false,
    blur: false,
    signatureMoments: true,
    maxAnimatedItems: 8,
  },
};

/** Was bei `prefers-reduced-motion` gilt — unabhängig vom Gerät. */
const REDUCED_MOTION_SETTINGS: MotionQualitySettings = {
  tier: 'minimal',
  durationScale: 0,
  stagger: false,
  parallax: false,
  blur: false,
  signatureMoments: false,
  maxAnimatedItems: 0,
};

const DEVICE_CLASS_TIER = {
  strong: 'full',
  phone: 'balanced',
  weak: 'minimal',
} as const satisfies Record<ReturnType<typeof classifyDevice>, MotionTier>;

export type MotionQualityOptions = {
  /** `prefers-reduced-motion` des Nutzers. Schlägt jede Geräteheuristik. */
  reducedMotion?: boolean;
  /** Übergeht die Heuristik — genutzt von Tests und von `stepDownMotionQuality`. */
  forceTier?: MotionTier;
};

function settingsFor(tier: MotionTier): MotionQualitySettings {
  return { tier, ...TIER_SETTINGS[tier] };
}

/** Wählt die Bewegungsstufe für ein Gerät. */
export function deriveMotionQuality(
  profile: DeviceProfile,
  options: MotionQualityOptions = {}
): MotionQualitySettings {
  if (options.reducedMotion) return REDUCED_MOTION_SETTINGS;
  if (options.forceTier) return settingsFor(options.forceTier);
  return settingsFor(DEVICE_CLASS_TIER[classifyDevice(profile)]);
}

/**
 * Eine Stufe herunter — Einbahnstraße wie bei der Stadt (`stepDownQuality`).
 * Ohne diese Einbahnstraße oszillierte die App bei einer Bildrate nahe der
 * Schwelle zwischen zwei Stufen, was sichtbar ruckelt statt sich zu
 * stabilisieren. Auf der untersten Stufe kommt dieselbe Instanz zurück, damit
 * ein Aufrufer per Identitätsvergleich sieht, dass nichts mehr geht.
 *
 * Ein `reducedMotion`-Ergebnis ist bereits die unterste Stufe und bleibt
 * unverändert — Herunterstufen darf eine Nutzeraussage nicht aufheben.
 */
export function stepDownMotionQuality(settings: MotionQualitySettings): MotionQualitySettings {
  const index = MOTION_TIERS.indexOf(settings.tier);
  const next = MOTION_TIERS[index + 1];
  if (!next) return settings;
  return settingsFor(next);
}

/**
 * Löst eine Token-Dauer gegen die Bewegungsstufe auf. Ganzzahlig, weil
 * Framer Motion und `requestAnimationFrame`-Zähler mit Millisekunden rechnen
 * und Bruchteile nur Rundungsrauschen in die Tests tragen.
 */
export function resolveMotionDuration(
  duration: number,
  settings: MotionQualitySettings
): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return Math.round(duration * settings.durationScale);
}
