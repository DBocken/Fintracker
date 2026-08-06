import { describe, it, expect } from 'vitest';
import {
  deriveCityQuality,
  stepDownQuality,
  QUALITY_TIERS,
  type CityDeviceProfile,
} from '../city-quality';

/**
 * WP-5.6 — Mobile Vereinfachung & Performance-Stufen.
 *
 * Die Stufe wird VOR dem ersten Frame aus den Geräteeigenschaften abgeleitet,
 * nicht erst reaktiv aus gemessener FPS. Die vorhandene FPS-Kaskade in
 * `CityCanvas` bleibt als zweite, nachgelagerte Sicherung bestehen — sie kann
 * ein schwaches Gerät erst NACH sichtbarem Ruckeln herunterstufen.
 */
const DESKTOP: CityDeviceProfile = {
  devicePixelRatio: 1,
  hardwareConcurrency: 12,
  deviceMemoryGb: 16,
  coarsePointer: false,
  viewportWidth: 1440,
};

const PHONE: CityDeviceProfile = {
  devicePixelRatio: 3,
  hardwareConcurrency: 8,
  deviceMemoryGb: 6,
  coarsePointer: true,
  viewportWidth: 390,
};

const WEAK_PHONE: CityDeviceProfile = {
  devicePixelRatio: 2,
  hardwareConcurrency: 4,
  deviceMemoryGb: 2,
  coarsePointer: true,
  viewportWidth: 360,
};

describe('deriveCityQuality', () => {
  it('sollte auf einem kräftigen Desktop die höchste Stufe wählen', () => {
    expect(deriveCityQuality(DESKTOP).tier).toBe('high');
  });

  it('sollte auf einem Telefon höchstens die mittlere Stufe wählen', () => {
    // Auch ein starkes Telefon bleibt unter 'high': der Engpass ist die
    // Pixelzahl (DPR 3 auf kleiner Fläche), nicht die Kernanzahl.
    expect(deriveCityQuality(PHONE).tier).toBe('balanced');
  });

  it('sollte bei wenig Kernen oder wenig Speicher auf die sparsamste Stufe fallen', () => {
    expect(deriveCityQuality(WEAK_PHONE).tier).toBe('lean');
    expect(deriveCityQuality({ ...DESKTOP, hardwareConcurrency: 2 }).tier).toBe('lean');
    expect(deriveCityQuality({ ...DESKTOP, deviceMemoryGb: 2 }).tier).toBe('lean');
  });

  it('sollte `saveData` als ausdrücklichen Nutzerwunsch respektieren', () => {
    // Save-Data ist eine Nutzerentscheidung für Sparsamkeit, kein Messwert —
    // sie überstimmt deshalb auch ein starkes Gerät.
    expect(deriveCityQuality({ ...DESKTOP, saveData: true }).tier).toBe('lean');
  });

  it('sollte ohne Angaben zu Kernen/Speicher nicht herunterstufen', () => {
    // hardwareConcurrency/deviceMemory sind nicht überall verfügbar (Safari
    // liefert deviceMemory gar nicht). Fehlend darf nicht wie „schwach"
    // behandelt werden, sonst bekämen alle iOS-Desktops die Sparstufe.
    const { hardwareConcurrency: _c, deviceMemoryGb: _m, ...withoutHints } = DESKTOP;
    expect(deriveCityQuality(withoutHints).tier).toBe('high');
  });

  it('sollte den Pixel-Ratio nie über das Gerät hinaus anheben', () => {
    // Ein DPR-1-Desktop darf nicht auf 2 „hochskaliert" werden — das wäre
    // Supersampling auf Kosten der Bildrate ohne sichtbaren Gewinn.
    expect(deriveCityQuality(DESKTOP).maxPixelRatio).toBe(1);
    expect(deriveCityQuality({ ...DESKTOP, devicePixelRatio: 3 }).maxPixelRatio).toBe(2);
  });

  it('sollte auf jeder Stufe einen gedeckelten Pixel-Ratio liefern', () => {
    for (const tier of QUALITY_TIERS) {
      const settings = deriveCityQuality({ ...DESKTOP, devicePixelRatio: 4 }, tier);
      expect(settings.maxPixelRatio).toBeLessThanOrEqual(2);
      expect(settings.maxPixelRatio).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('Stufen-Reihenfolge', () => {
  it('sollte teure Effekte monoton abschalten, nie einzeln wieder zuschalten', () => {
    // Kern der Vorgabe: die Stufen sind eine ECHTE Ordnung. Was auf einer
    // sparsameren Stufe aus ist, darf auf keiner noch sparsameren wieder an
    // sein — sonst ist „eine Stufe runter" keine verlässliche Entlastung.
    const settings = QUALITY_TIERS.map((tier) => deriveCityQuality({ ...DESKTOP, devicePixelRatio: 4 }, tier));
    const effects = ['contactShadows', 'facadeTexture', 'rimLight', 'edges', 'buildCascade', 'flowLines'] as const;

    for (const effect of effects) {
      const enabled = settings.map((s) => s[effect]);
      const firstOff = enabled.indexOf(false);
      if (firstOff === -1) continue;
      expect(enabled.slice(firstOff), `${effect} wird auf einer sparsameren Stufe wieder eingeschaltet`).not.toContain(
        true,
      );
    }

    const ratios = settings.map((s) => s.maxPixelRatio);
    expect([...ratios].sort((a, b) => b - a), 'maxPixelRatio fällt nicht monoton').toEqual(ratios);
  });

  it('sollte auf der sparsamsten Stufe alle Zusatz-Effekte abschalten', () => {
    const lean = deriveCityQuality(WEAK_PHONE);
    expect(lean.contactShadows).toBe(false);
    expect(lean.facadeTexture).toBe(false);
    expect(lean.rimLight).toBe(false);
    expect(lean.buildCascade).toBe(false);
    expect(lean.flowLines).toBe(false);
  });

  it('sollte Antialiasing nur bei niedrigem Pixel-Ratio zulassen', () => {
    // Hohe Pixeldichte glättet bereits; MSAA obendrauf verdoppelt nur die Last.
    expect(deriveCityQuality(DESKTOP).antialias).toBe(true);
    expect(deriveCityQuality({ ...DESKTOP, devicePixelRatio: 3 }).antialias).toBe(false);
  });
});

describe('stepDownQuality', () => {
  it('sollte genau eine Stufe heruntergehen', () => {
    expect(stepDownQuality(deriveCityQuality(DESKTOP)).tier).toBe('balanced');
    expect(stepDownQuality(deriveCityQuality(PHONE)).tier).toBe('lean');
  });

  it('[REGRESSION] sollte auf der untersten Stufe dieselbe Einstellung zurückgeben', () => {
    // Einbahnstraße wie die bestehende DPR-Kaskade: kein Oszillieren zwischen
    // zwei Stufen, und unten ist Schluss.
    const lean = deriveCityQuality(WEAK_PHONE);
    expect(stepDownQuality(lean)).toBe(lean);
  });

  it('sollte den Geräte-Pixel-Ratio auch beim Herunterstufen als Obergrenze behalten', () => {
    const stepped = stepDownQuality(deriveCityQuality(DESKTOP));
    expect(stepped.maxPixelRatio).toBeLessThanOrEqual(DESKTOP.devicePixelRatio);
  });
});
