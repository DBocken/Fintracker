import { describe, expect, it } from 'vitest';
import {
  DISSOLVE_MAX_PARTICLES,
  advanceParticle,
  createRandom,
  seedParticles,
  type DissolvePoint,
} from '../dissolve-particles';

/** Bildpunkte einer Fläche, wie sie die Abtastung liefert. */
function punkte(breite: number, hoehe: number, farbe = 'rgba(255,0,0,1)'): DissolvePoint[] {
  const liste: DissolvePoint[] = [];
  for (let y = 0; y < hoehe; y += 1) {
    for (let x = 0; x < breite; x += 1) {
      liste.push({
        x: 100 + x,
        y: 200 + y,
        color: farbe,
        vonRechts: breite > 1 ? (breite - 1 - x) / (breite - 1) : 0,
      });
    }
  }
  return liste;
}

describe('seedParticles', () => {
  it('sollte aus einem 10x10-Feld 100 Partikel machen', () => {
    // Die tragende Zusicherung: Ein Partikel ist ein Bildpunkt, kein
    // Platzhalter. Ein rotes 10×10-Feld ergibt 100 rote Partikel.
    expect(seedParticles(punkte(10, 10), createRandom(7))).toHaveLength(100);
  });

  it('sollte die Farbe jedes Bildpunkts übernehmen', () => {
    const partikel = seedParticles(punkte(4, 4, 'rgba(12,34,56,0.5)'), createRandom(3));
    expect(partikel.every((p) => p.color === 'rgba(12,34,56,0.5)')).toBe(true);
  });

  it('sollte an den Ruheorten der Bildpunkte sitzen', () => {
    const quelle = punkte(3, 3);
    const partikel = seedParticles(quelle, createRandom(5));
    for (const p of partikel) {
      expect(quelle.some((q) => q.x === p.x && q.y === p.y)).toBe(true);
    }
  });

  it('sollte die Obergrenze auch bei einer riesigen Fläche einhalten', () => {
    // Die Grenze ist die Prüfstelle, nicht der Kommentar.
    expect(seedParticles(punkte(200, 200), createRandom(3)).length).toBeLessThanOrEqual(
      DISSOLVE_MAX_PARTICLES,
    );
  });

  it('sollte beim Ausdünnen die ganze Fläche treffen, nicht nur ihren Anfang', () => {
    // Ein `slice` auf die Obergrenze würde je nach Abtastreihenfolge die
    // untere Hälfte gar nicht zerfallen lassen.
    const quelle = punkte(200, 200);
    const partikel = seedParticles(quelle, createRandom(11));
    const untersteZeile = 200 + 199;
    expect(partikel.some((p) => p.y > untersteZeile - 10)).toBe(true);
    expect(partikel.some((p) => p.y < 210)).toBe(true);
  });

  it('sollte die dem Wind zugewandte rechte Kante zuerst zerfallen lassen', () => {
    const partikel = seedParticles(punkte(40, 10), createRandom(5));
    const rechts = partikel.filter((p) => p.x > 100 + 32);
    const links = partikel.filter((p) => p.x < 100 + 8);
    const schnitt = (liste: typeof partikel) =>
      liste.reduce((s, p) => s + p.verzoegerung, 0) / liste.length;
    expect(schnitt(rechts)).toBeLessThan(schnitt(links));
  });

  it('sollte eine Minderheit deutlich schnellerer Partikel erzeugen — die Böen', () => {
    // Ohne sie zieht die Asche als gleichförmige Wolke ab; erst die
    // Streuung macht daraus Wind.
    const partikel = seedParticles(punkte(60, 40), createRandom(23));
    const tempo = partikel.map((p) => Math.abs(p.vx));
    const schnitt = tempo.reduce((s, v) => s + v, 0) / tempo.length;
    const schnelle = tempo.filter((v) => v > schnitt * 2);
    expect(schnelle.length).toBeGreaterThan(0);
    expect(schnelle.length).toBeLessThan(partikel.length / 3);
  });

  it('sollte ohne Bildpunkte nichts erzeugen', () => {
    expect(seedParticles([])).toEqual([]);
  });
});

describe('advanceParticle', () => {
  const partikel = seedParticles(punkte(20, 20), createRandom(2))[0];

  it('sollte vor dem eigenen Zerfall unversehrt an seinem Platz stehen', () => {
    // Der Kern des Eindrucks: Was noch nicht zerfallen ist, steht
    // unverändert da. Wäre es unsichtbar, sähe man ein Ausblenden.
    const ruhe = advanceParticle({ ...partikel, verzoegerung: 200 }, 100);
    expect(ruhe.alpha).toBe(1);
    expect(ruhe.x).toBe(partikel.x);
    expect(ruhe.y).toBe(partikel.y);
  });

  it('sollte nach Ablauf seiner Lebensdauer verweht sein', () => {
    const t = partikel.verzoegerung + partikel.lebensdauer + 1;
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
    const ende = advanceParticle(partikel, partikel.verzoegerung + partikel.lebensdauer - 1);
    expect(ende.y).toBeLessThan(partikel.y);
  });

  it('sollte über die Lebensdauer verblassen', () => {
    const frueh = advanceParticle(partikel, partikel.verzoegerung + 20);
    const spaet = advanceParticle(partikel, partikel.verzoegerung + partikel.lebensdauer * 0.8);
    expect(spaet.alpha).toBeLessThan(frueh.alpha);
    expect(spaet.alpha).toBeGreaterThan(0);
  });
});
