import { describe, expect, it } from 'vitest';
import {
  DISSOLVE_MAX_PARTICLES,
  DISSOLVE_PARTICLE_LIFE_MS,
  advanceParticle,
  createRandom,
  seedParticles,
  type DissolveRect,
} from '../dissolve-particles';

const kachel: DissolveRect = { x: 100, y: 200, width: 240, height: 160 };

describe('seedParticles', () => {
  it('sollte Partikel innerhalb der Fläche säen', () => {
    const partikel = seedParticles([kachel], createRandom(7));
    expect(partikel.length).toBeGreaterThan(0);
    for (const p of partikel) {
      expect(p.x).toBeGreaterThanOrEqual(kachel.x);
      expect(p.x).toBeLessThanOrEqual(kachel.x + kachel.width);
      expect(p.y).toBeGreaterThanOrEqual(kachel.y);
      expect(p.y).toBeLessThanOrEqual(kachel.y + kachel.height);
    }
  });

  it('sollte die Obergrenze auch bei einer riesigen Fläche einhalten', () => {
    // Die Grenze ist die Prüfstelle, nicht der Kommentar: ohne sie wären das
    // hier über 4000 Partikel je Bild.
    const riesig: DissolveRect = { x: 0, y: 0, width: 2560, height: 1600 };
    expect(seedParticles([riesig], createRandom(3)).length).toBeLessThanOrEqual(
      DISSOLVE_MAX_PARTICLES,
    );
  });

  it('sollte den Deckel anteilig verteilen, statt die letzte Fläche leer zu lassen', () => {
    const flaechen: DissolveRect[] = [
      { x: 0, y: 0, width: 2000, height: 1200 },
      { x: 0, y: 0, width: 300, height: 200 },
    ];
    const partikel = seedParticles(flaechen, createRandom(11));
    expect(partikel.some((p) => p.quelle === 0)).toBe(true);
    expect(partikel.some((p) => p.quelle === 1)).toBe(true);
  });

  it('sollte die dem Wind zugewandte rechte Kante zuerst zerfallen lassen', () => {
    const partikel = seedParticles([kachel], createRandom(5));
    const rechts = partikel.filter((p) => p.x > kachel.x + kachel.width * 0.8);
    const links = partikel.filter((p) => p.x < kachel.x + kachel.width * 0.2);
    const schnitt = (liste: typeof partikel) =>
      liste.reduce((s, p) => s + p.verzoegerung, 0) / liste.length;
    expect(schnitt(rechts)).toBeLessThan(schnitt(links));
  });

  it('sollte bei einer Fläche ohne Ausdehnung nichts säen', () => {
    expect(seedParticles([{ x: 0, y: 0, width: 0, height: 0 }])).toEqual([]);
    expect(seedParticles([])).toEqual([]);
  });
});

describe('advanceParticle', () => {
  const partikel = seedParticles([kachel], createRandom(2))[0];

  it('sollte vor dem eigenen Zeitversatz unsichtbar sein', () => {
    expect(advanceParticle({ ...partikel, verzoegerung: 200 }, 100).alpha).toBe(0);
  });

  it('sollte nach Ablauf der Lebensdauer unsichtbar sein', () => {
    const t = partikel.verzoegerung + DISSOLVE_PARTICLE_LIFE_MS + 1;
    expect(advanceParticle(partikel, t).alpha).toBe(0);
  });

  it('sollte den Partikel nach links treiben', () => {
    const start = advanceParticle(partikel, partikel.verzoegerung + 1);
    const spaeter = advanceParticle(partikel, partikel.verzoegerung + 400);
    expect(spaeter.x).toBeLessThan(start.x);
  });

  it('sollte den Partikel im weiteren Verlauf aufsteigen lassen', () => {
    // Erst zur Seite, dann nach oben: gegen Ende MUSS er über dem Startpunkt
    // stehen, sonst fehlt die zweite Phase.
    const ende = advanceParticle(partikel, partikel.verzoegerung + DISSOLVE_PARTICLE_LIFE_MS - 1);
    expect(ende.y).toBeLessThan(partikel.y);
  });

  it('sollte über die Lebensdauer verblassen', () => {
    const frueh = advanceParticle(partikel, partikel.verzoegerung + 50);
    const spaet = advanceParticle(partikel, partikel.verzoegerung + 700);
    expect(spaet.alpha).toBeLessThan(frueh.alpha);
    expect(spaet.alpha).toBeGreaterThan(0);
  });
});
