/**
 * WP-5.6 — Mobile Vereinfachung & Performance-Stufen.
 *
 * Die Stadt lief bisher auf jedem Gerät mit demselben Effektumfang; die einzige
 * Anpassung war die FPS-getriebene DPR-Kaskade in `CityCanvas`. Die greift aber
 * erst, NACHDEM der Nutzer das Ruckeln gesehen hat — auf einem schwachen
 * Telefon ist der erste Eindruck der Stadt damit systematisch der schlechteste.
 *
 * Diese Datei leitet die Stufe deshalb VOR dem ersten Frame aus den
 * Geräteeigenschaften ab. Die FPS-Kaskade bleibt als zweite Sicherung bestehen
 * (`stepDownQuality`) — sie fängt ab, was die Heuristik nicht sehen kann
 * (Hintergrundlast, thermisches Drosseln, schwache GPU bei vielen Kernen).
 *
 * Rein und browserfrei nach der Architekturtabelle in `../README.md`: das
 * Auslesen von `window`/`navigator` passiert in `presentation/`, hier kommt nur
 * das fertige Profil an. Genau deshalb ist die Ableitung überhaupt testbar.
 *
 * WP-7.7: Die Einstufung „stark / Telefon / schwach" wurde nach
 * `@/lib/device-profile` gezogen und wird dort mit der Bewegungssprache der
 * App geteilt. Hier bleibt nur, was die Stadt allein betrifft — der
 * Effektumfang je Stufe. Zwei Heuristiken würden auseinanderdriften, und ein
 * Gerät wäre dann für die Stadt schwach und für die Bewegung stark.
 */

import { classifyDevice, type DeviceProfile } from '@/lib/device-profile';

/** Stufen von der aufwendigsten zur sparsamsten — die Reihenfolge IST die Ordnung (siehe `stepDownQuality`). */
export const QUALITY_TIERS = ['high', 'balanced', 'lean'] as const;

export type CityQualityTier = (typeof QUALITY_TIERS)[number];

/**
 * Was die Presentation über das Gerät weiß.
 *
 * Seit WP-7.7 identisch mit dem geteilten {@link DeviceProfile}; der Name
 * bleibt als sprechender Alias an den Aufrufstellen der Stadt bestehen.
 */
export type CityDeviceProfile = DeviceProfile;

export type CityQualitySettings = {
  tier: CityQualityTier;
  /** Obergrenze für `renderer.setPixelRatio` — nie über dem echten Geräte-DPR (kein Supersampling). */
  maxPixelRatio: number;
  antialias: boolean;
  /** WP-E1-Kontaktschatten: eine transparente Ebene je Baukörper-Fuß (Overdraw). */
  contactShadows: boolean;
  /** WP-E1-Fassadentextur (AO-Gradient + Fenster-Raster) auf allen `solid`-Materialien. */
  facadeTexture: boolean;
  /** WP-D6-Gegenlicht: eine dritte Lichtquelle kostet Fragment-Last auf JEDEM Material. */
  rimLight: boolean;
  /** Kantenlinien der Baukörper: ein zusätzlicher Draw-Call je Box. */
  edges: boolean;
  /** WP-E1-Aufbau-Kaskade (`BUILD_STAGGER_MS`) — gestaffelter Aufbau statt gleichzeitig. */
  buildCascade: boolean;
  /** WP-5.1-Flusslinien: je Linie ein eigener Draw-Call mit Transparenz. */
  flowLines: boolean;
};

/** Pixel-Ratio-Deckel je Stufe. Quadratischer Effekt auf die Fragment-Last — der wirksamste einzelne Hebel. */
const TIER_PIXEL_RATIO: Record<CityQualityTier, number> = {
  high: 2,
  balanced: 1.5,
  lean: 1,
};

/**
 * Effektumfang je Stufe. Monoton: was hier einmal `false` ist, bleibt auf jeder
 * sparsameren Stufe `false` (`city-quality.test.ts` erzwingt das) — sonst wäre
 * „eine Stufe runter" keine verlässliche Entlastung, und die FPS-Kaskade könnte
 * eine Stufe wählen, die an anderer Stelle wieder teurer ist.
 */
const TIER_EFFECTS: Record<CityQualityTier, Omit<CityQualitySettings, 'tier' | 'maxPixelRatio' | 'antialias'>> = {
  high: { contactShadows: true, facadeTexture: true, rimLight: true, edges: true, buildCascade: true, flowLines: true },
  balanced: { contactShadows: true, facadeTexture: true, rimLight: false, edges: true, buildCascade: true, flowLines: true },
  lean: { contactShadows: false, facadeTexture: false, rimLight: false, edges: false, buildCascade: false, flowLines: false },
};

/**
 * Antialiasing lohnt nur bei niedriger Pixeldichte. Ab ~1.5 übernimmt das
 * Downsampling durch die Pixeldichte bereits einen Großteil der Kantenglättung,
 * MSAA obendrauf verdoppelt dann nur die Last (gleiche Begründung wie bisher
 * bei der Renderer-Erstellung in `city-scene.ts`).
 */
const ANTIALIAS_MAX_PIXEL_RATIO = 1.5;

/** Welche Stufe eine Geräteklasse bekommt. */
const DEVICE_CLASS_TIER = {
  strong: 'high',
  phone: 'balanced',
  weak: 'lean',
} as const satisfies Record<ReturnType<typeof classifyDevice>, CityQualityTier>;

function settingsFor(tier: CityQualityTier, devicePixelRatio: number): CityQualitySettings {
  // Nie über den echten Geräte-DPR hinaus: ein DPR-1-Bildschirm auf 2 zu
  // rendern wäre Supersampling — volle Kosten, kein sichtbarer Gewinn.
  const maxPixelRatio = Math.min(TIER_PIXEL_RATIO[tier], Math.max(devicePixelRatio, 1));

  return {
    tier,
    maxPixelRatio,
    antialias: maxPixelRatio <= ANTIALIAS_MAX_PIXEL_RATIO,
    ...TIER_EFFECTS[tier],
  };
}

/**
 * Wählt die Stufe für ein Gerät. `forceTier` übergeht die Heuristik — genutzt
 * von den Tests und von `stepDownQuality`.
 *
 * Die Einstufung selbst kommt aus `classifyDevice` (`@/lib/device-profile`),
 * geteilt mit der Bewegungssprache der App; hier wird sie nur auf den
 * Effektumfang der Stadt abgebildet.
 */
export function deriveCityQuality(profile: CityDeviceProfile, forceTier?: CityQualityTier): CityQualitySettings {
  if (forceTier) return settingsFor(forceTier, profile.devicePixelRatio);
  return settingsFor(DEVICE_CLASS_TIER[classifyDevice(profile)], profile.devicePixelRatio);
}

/**
 * Eine Stufe herunter — Einbahnstraße, genau wie die bestehende DPR-Kaskade in
 * `CityCanvas`. Ohne diese Einbahnstraße würde die App bei einer Bildrate nahe
 * der Schwelle zwischen zwei Stufen oszillieren (Stufe rauf → Last steigt →
 * FPS fällt → Stufe runter → …), was sichtbar ruckelt statt sich zu
 * stabilisieren. Auf der untersten Stufe wird dieselbe Instanz zurückgegeben,
 * damit ein Aufrufer per Identitätsvergleich sieht, dass nichts mehr geht.
 */
export function stepDownQuality(settings: CityQualitySettings): CityQualitySettings {
  const index = QUALITY_TIERS.indexOf(settings.tier);
  const next = QUALITY_TIERS[index + 1];
  if (!next) return settings;

  // Den Geräte-DPR aus der aktuellen Einstellung rekonstruieren: `maxPixelRatio`
  // ist bereits min(Stufe, Gerät), der Deckel der Stufe ist bekannt — die
  // Obergrenze des Geräts ist damit alles, was <= dem bisherigen Wert liegt.
  return settingsFor(next, settings.maxPixelRatio);
}
