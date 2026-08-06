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
 */

/** Stufen von der aufwendigsten zur sparsamsten — die Reihenfolge IST die Ordnung (siehe `stepDownQuality`). */
export const QUALITY_TIERS = ['high', 'balanced', 'lean'] as const;

export type CityQualityTier = (typeof QUALITY_TIERS)[number];

/**
 * Was die Presentation über das Gerät weiß. Alle Felder außer
 * `devicePixelRatio`/`viewportWidth` sind optional, weil sie nicht überall
 * existieren (`navigator.deviceMemory` fehlt in Safari und Firefox komplett).
 * Fehlende Angaben werden bewusst NICHT als „schwach" gewertet.
 */
export type CityDeviceProfile = {
  devicePixelRatio: number;
  viewportWidth: number;
  hardwareConcurrency?: number;
  deviceMemoryGb?: number;
  /** `pointer: coarse` — Finger statt Maus, also praktisch immer ein Telefon/Tablet. */
  coarsePointer?: boolean;
  /** `navigator.connection.saveData` — ausdrücklicher Sparsamkeitswunsch des Nutzers. */
  saveData?: boolean;
};

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

/** Schwellen, ab denen ein Gerät als schwach gilt. Bewusst großzügig: lieber eine Stufe zu spät sparen als eine zu früh entwerten. */
const WEAK_CORE_COUNT = 4;
const WEAK_MEMORY_GB = 2;
/** Ab dieser Breite gilt ein Touch-Gerät als Tablet und nicht mehr als Telefon. */
const PHONE_MAX_WIDTH = 768;

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

function isWeakDevice(profile: CityDeviceProfile): boolean {
  if (profile.saveData) return true;
  if (profile.hardwareConcurrency !== undefined && profile.hardwareConcurrency <= WEAK_CORE_COUNT) return true;
  if (profile.deviceMemoryGb !== undefined && profile.deviceMemoryGb <= WEAK_MEMORY_GB) return true;
  return false;
}

function isPhone(profile: CityDeviceProfile): boolean {
  return Boolean(profile.coarsePointer) && profile.viewportWidth < PHONE_MAX_WIDTH;
}

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
 * Regeln, in dieser Reihenfolge:
 * 1. Ausdrücklicher Sparsamkeitswunsch oder erkennbar schwaches Gerät → `lean`.
 * 2. Telefon (Touch + schmaler Viewport) → höchstens `balanced`. Auch ein
 *    starkes Telefon bleibt darunter: der Engpass ist die Pixelzahl bei DPR 3,
 *    nicht die Kernanzahl.
 * 3. Sonst `high`.
 */
export function deriveCityQuality(profile: CityDeviceProfile, forceTier?: CityQualityTier): CityQualitySettings {
  if (forceTier) return settingsFor(forceTier, profile.devicePixelRatio);
  if (isWeakDevice(profile)) return settingsFor('lean', profile.devicePixelRatio);
  if (isPhone(profile)) return settingsFor('balanced', profile.devicePixelRatio);
  return settingsFor('high', profile.devicePixelRatio);
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
