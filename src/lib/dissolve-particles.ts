/**
 * Die Rechnung hinter der Auflösung — rein, ohne React, ohne Canvas (§3).
 *
 * Der Eindruck, den sie erzeugen soll: Was abgewählt wurde, zerfällt zu Asche,
 * die ein gedachter Wind nach links treibt und die danach aufsteigt. Genau
 * diese zwei Phasen stecken in {@link advanceParticle} — eine gleichförmige
 * Bewegung zur Seite und eine wachsende Auftriebsbeschleunigung, die die Bahn
 * nach oben abknicken lässt.
 *
 * **Warum ohne Rasterung des DOM.** Ein echter Schnappschuss des Elements
 * bräuchte eine Bibliothek wie html2canvas — eine neue Abhängigkeit, spürbar
 * im Bündelbudget und ohne Gewinn für den Eindruck. Die Partikel werden
 * stattdessen über der Bounding-Box gesät und in der Vordergrundfarbe des
 * Elements gezeichnet, während das Element selbst ausblendet. Das liest sich
 * als Zerfall und bleibt in jedem Skin farbrichtig.
 */

/**
 * Obergrenze über ALLE gleichzeitig zerfallenden Flächen.
 *
 * Keine Grenzkonstante ohne Prüfstelle (AGENTS.md §3): `seedParticles`
 * schneidet hier wirklich ab, und `dissolve-particles.test.ts` zählt nach.
 * Der Wert ist gemessen an der teuersten Fläche des Flusses (die Sprachwahl
 * mit drei Kacheln) und lässt auf einem Mittelklasse-Android Luft.
 */
export const DISSOLVE_MAX_PARTICLES = 900;

/** Partikel je 1000 px² Fläche, bevor die Obergrenze greift. */
const PARTICLE_DICHTE = 0.9;

/** Lebensdauer eines Partikels in Millisekunden. */
export const DISSOLVE_PARTICLE_LIFE_MS = 900;

/**
 * Zeitversatz über die Breite einer Fläche.
 *
 * Der Wind kommt von rechts, also erodiert die ihm zugewandte Kante zuerst.
 * Ohne diesen Versatz löste sich die Fläche überall gleichzeitig auf — das
 * sieht nach Ausblenden aus, nicht nach Zerfall.
 */
export const DISSOLVE_STAGGER_MS = 420;

/** Gesamtdauer, nach der garantiert nichts mehr zu sehen ist. */
export const DISSOLVE_DURATION_MS = DISSOLVE_STAGGER_MS + DISSOLVE_PARTICLE_LIFE_MS;

/** Windgeschwindigkeit nach links, in Pixeln pro Sekunde. */
const WIND_MIN = 40;
const WIND_MAX = 150;

/** Auftriebsbeschleunigung nach oben, in Pixeln pro Sekunde². */
const AUFTRIEB_MIN = 120;
const AUFTRIEB_MAX = 340;

export interface DissolveRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DissolveParticle {
  /** Startpunkt im Viewport. */
  x: number;
  y: number;
  /** Geschwindigkeit zur Seite (negativ = nach links), px/s. */
  vx: number;
  /** Anfangsgeschwindigkeit senkrecht, px/s. */
  vy: number;
  /** Auftriebsbeschleunigung nach oben, px/s². */
  auftrieb: number;
  /** Kantenlänge in Pixeln. */
  groesse: number;
  /** Zeitversatz bis zum Zerfall dieses Partikels, ms. */
  verzoegerung: number;
  /** Index der Fläche, aus der er stammt — bestimmt die Farbe. */
  quelle: number;
}

/**
 * Deterministischer Zufall (mulberry32).
 *
 * Nicht aus Sicherheitsgründen, sondern damit die Rechnung prüfbar ist: mit
 * `Math.random` liesse sich weder die Obergrenze noch die Bahn eines Partikels
 * in einem Test festnageln.
 */
export function createRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function zwischen(random: () => number, min: number, max: number): number {
  return min + random() * (max - min);
}

/**
 * Verteilt Partikel über die übergebenen Flächen.
 *
 * Die Zahl folgt der Fläche, damit eine grosse Kachel nicht dünner zerfällt
 * als eine kleine — gedeckelt durch {@link DISSOLVE_MAX_PARTICLES}, damit eine
 * grosse Fläche das Bildschirmgerät nicht in die Knie zwingt. Der Deckel wird
 * anteilig verteilt, nicht nach dem Windhundprinzip: sonst zerfiele die letzte
 * Kachel gar nicht.
 */
export function seedParticles(
  rects: readonly DissolveRect[],
  random: () => number = createRandom(1),
): DissolveParticle[] {
  const flaechen = rects.map((r) => Math.max(0, r.width) * Math.max(0, r.height));
  const gesamt = flaechen.reduce((summe, f) => summe + f, 0);
  if (gesamt <= 0) return [];

  const gewuenscht = (gesamt / 1000) * PARTICLE_DICHTE;
  const faktor = gewuenscht > DISSOLVE_MAX_PARTICLES ? DISSOLVE_MAX_PARTICLES / gewuenscht : 1;

  const partikel: DissolveParticle[] = [];
  rects.forEach((rect, index) => {
    const anzahl = Math.floor(((flaechen[index] / 1000) * PARTICLE_DICHTE) * faktor);
    for (let i = 0; i < anzahl; i += 1) {
      const x = rect.x + random() * rect.width;
      const y = rect.y + random() * rect.height;
      // Anteil von der RECHTEN Kante aus: 0 rechts, 1 links.
      const vonRechts = rect.width > 0 ? (rect.x + rect.width - x) / rect.width : 0;
      partikel.push({
        x,
        y,
        vx: -zwischen(random, WIND_MIN, WIND_MAX),
        vy: zwischen(random, -12, 12),
        auftrieb: zwischen(random, AUFTRIEB_MIN, AUFTRIEB_MAX),
        groesse: zwischen(random, 1, 2.6),
        verzoegerung: vonRechts * DISSOLVE_STAGGER_MS,
        quelle: index,
      });
    }
  });
  return partikel;
}

export interface DissolveSample {
  x: number;
  y: number;
  /** 0 = unsichtbar (noch nicht zerfallen oder schon verweht). */
  alpha: number;
}

/**
 * Ort und Deckkraft eines Partikels zum Zeitpunkt `zeitMs` nach dem Start.
 *
 * Erst zur Seite (gleichförmig), dann nach oben (beschleunigt) — die Bahn
 * knickt dadurch von selbst ab, ohne dass irgendwo eine Phase umgeschaltet
 * werden müsste.
 */
export function advanceParticle(partikel: DissolveParticle, zeitMs: number): DissolveSample {
  const lokal = zeitMs - partikel.verzoegerung;
  if (lokal <= 0 || lokal >= DISSOLVE_PARTICLE_LIFE_MS) {
    return { x: partikel.x, y: partikel.y, alpha: 0 };
  }
  const s = lokal / 1000;
  const fortschritt = lokal / DISSOLVE_PARTICLE_LIFE_MS;
  return {
    x: partikel.x + partikel.vx * s,
    y: partikel.y + partikel.vy * s - 0.5 * partikel.auftrieb * s * s,
    alpha: 1 - fortschritt ** 1.5,
  };
}
