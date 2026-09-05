/**
 * Die Rechnung hinter der Auflösung — rein, ohne React, ohne Canvas (§3).
 *
 * Der Eindruck, den sie erzeugen soll: Was abgewählt wurde, zerfällt zu Asche,
 * die ein gedachter Wind nach links treibt und die danach aufsteigt.
 *
 * **Ein Partikel ist ein Bildpunkt, kein Platzhalter.** Ein rotes 10×10-Feld
 * ergibt 100 rote Partikel; ein Buchstabe zerfällt in genau die Punkte, aus
 * denen er besteht. Woher diese Punkte kommen, weiss diese Datei nicht — sie
 * bekommt sie als {@link DissolvePoint}-Liste gereicht (erzeugt von
 * `features/shared/presentation/dissolve-raster.ts`, das dafür ein Canvas
 * braucht und deshalb nicht hier liegen kann).
 *
 * **Vor seinem Zerfall steht ein Partikel still und voll sichtbar.** Das ist
 * der Kern des Eindrucks und nicht bloss eine Feinheit: Solange die Fläche
 * erodiert, muss der noch nicht zerfallene Teil *unverändert dastehen*. Wäre
 * er unsichtbar, sähe man ein Ausblenden mit Funkenflug; wäre das echte
 * Element noch da, sähe man beides doppelt. Deshalb übernehmen die Partikel
 * das Bild vollständig, und das Element verschwindet im selben Augenblick.
 */

/**
 * Obergrenze über ALLE gleichzeitig zerfallenden Flächen.
 *
 * **Vorläufiger Wert zum Ausprobieren.** Er ist bewusst grosszügig, damit der
 * Zerfall bei einer Kachel wirklich pixelfein aussieht; der endgültige Wert
 * wird gemessen, nicht geschätzt (siehe `docs/architecture/…` bzw. die
 * Messnotiz im PR). Keine Grenzkonstante ohne Prüfstelle (AGENTS.md §3):
 * `seedParticles` schneidet hier wirklich ab, und
 * `dissolve-particles.test.ts` zählt nach.
 */
export const DISSOLVE_MAX_PARTICLES = 6000;

/** Lebensdauer eines Partikels in Millisekunden (Mittelwert; streut je Partikel). */
export const DISSOLVE_PARTICLE_LIFE_MS = 900;

/** Streuung der Lebensdauer: 0,5 heisst 50 %–150 % des Mittelwerts. */
const LEBENSDAUER_STREUUNG = 0.5;

/**
 * Zeitversatz über die Breite einer Fläche.
 *
 * Der Wind kommt von rechts, also erodiert die ihm zugewandte Kante zuerst.
 * Ohne diesen Versatz löste sich die Fläche überall gleichzeitig auf — das
 * sieht nach Ausblenden aus, nicht nach Zerfall.
 */
export const DISSOLVE_STAGGER_MS = 520;

/** Zufälliger Anteil des Zeitversatzes, damit die Kante ausfranst statt zu schneiden. */
const VERSATZ_RAUSCHEN_MS = 160;

/** Gesamtdauer, nach der garantiert nichts mehr zu sehen ist. */
export const DISSOLVE_DURATION_MS =
  DISSOLVE_STAGGER_MS + VERSATZ_RAUSCHEN_MS + DISSOLVE_PARTICLE_LIFE_MS * (1 + LEBENSDAUER_STREUUNG);

/** Grundwind nach links, in Pixeln pro Sekunde. */
const WIND_MIN = 30;
const WIND_MAX = 130;

/**
 * Böen — der Teil, der „manche ganz schnell" ausmacht.
 *
 * Ohne sie zieht die ganze Asche als gleichförmige Wolke ab, und das wirkt
 * mechanisch. Eine Minderheit deutlich schnellerer Partikel gibt dem Ganzen
 * erst den Eindruck von Wind: Die schnellen sind lange fort, während die
 * übrigen noch treiben.
 */
const BOEEN_ANTEIL = 0.14;
const BOEEN_FAKTOR_MIN = 2.4;
const BOEEN_FAKTOR_MAX = 4.5;

/** Auftriebsbeschleunigung nach oben, in Pixeln pro Sekunde². */
const AUFTRIEB_MIN = 100;
const AUFTRIEB_MAX = 380;

/**
 * Wirbel — echter Wind trägt nicht geradeaus.
 *
 * **Bewusst keine Partikelsimulation.** Ein Strömungsfeld zu rechnen hiesse,
 * für jeden Partikel in jedem Bild seine Nachbarschaft zu befragen; das kostet
 * genau auf dem Gerät am meisten, das am wenigsten Luft hat. Stattdessen
 * schwingt jeder Partikel für sich um seine Bahn — eigene Phase, eigene
 * Frequenz, eigene Auslenkung. Aus vielen unabhängigen Schwingungen entsteht
 * derselbe Eindruck von Verwirbelung, und die Rechnung bleibt eine
 * Sinusfunktion je Partikel.
 *
 * Die Auslenkung wächst über die Lebenszeit von null an: Der Partikel steht
 * ruhig, löst sich, und erst der Wind bringt ihn ins Trudeln.
 */
const WIRBEL_AMPLITUDE_MIN = 2;
const WIRBEL_AMPLITUDE_MAX = 16;
const WIRBEL_FREQUENZ_MIN = 2.5;
const WIRBEL_FREQUENZ_MAX = 9;
/** Senkrecht fällt der Wirbel flacher aus — sonst hüpft die Asche. */
const WIRBEL_Y_ANTEIL = 0.55;

/** Ein abgetasteter Bildpunkt der Fläche: Ort im Viewport und seine Farbe. */
export interface DissolvePoint {
  x: number;
  y: number;
  /** `rgba(r, g, b, a)` bzw. jede vom Canvas verstandene Farbe. */
  color: string;
  /** Anteil von der rechten Kante der Quellfläche (0 rechts, 1 links). */
  vonRechts: number;
}

export interface DissolveParticle {
  /** Ruheort im Viewport — dort steht der Partikel, bis sein Zerfall beginnt. */
  x: number;
  y: number;
  color: string;
  /** Geschwindigkeit zur Seite (negativ = nach links), px/s. */
  vx: number;
  /** Anfangsgeschwindigkeit senkrecht, px/s. */
  vy: number;
  /** Auftriebsbeschleunigung nach oben, px/s². */
  auftrieb: number;
  /** Zeitversatz bis zum Zerfall dieses Partikels, ms. */
  verzoegerung: number;
  /** Eigene Lebensdauer, ms. */
  lebensdauer: number;
  /** Startpunkt der eigenen Schwingung, damit nicht alle im Gleichtakt trudeln. */
  wirbelPhase: number;
  /** Auslenkung der Schwingung am Ende der Lebenszeit, px. */
  wirbelAmplitude: number;
  /** Schwingungen pro Sekunde (Bogenmass). */
  wirbelFrequenz: number;
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
 * Macht aus abgetasteten Bildpunkten Partikel.
 *
 * Übersteigt die Punktmenge {@link DISSOLVE_MAX_PARTICLES}, wird
 * **gleichmässig ausgedünnt** statt vorne abgeschnitten: Ein `slice` würde je
 * nach Abtastreihenfolge die untere Hälfte der Fläche gar nicht zerfallen
 * lassen.
 */
export function seedParticles(
  points: readonly DissolvePoint[],
  random: () => number = createRandom(1),
): DissolveParticle[] {
  if (points.length === 0) return [];

  const schritt = points.length > DISSOLVE_MAX_PARTICLES ? points.length / DISSOLVE_MAX_PARTICLES : 1;

  const partikel: DissolveParticle[] = [];
  // Die Schleifengrenze zählt PARTIKEL, nicht Fliesskomma-Schritte: Ein
  // gebrochener Schritt liefert sonst einen Durchlauf zu viel, und die
  // Obergrenze wäre um genau eins verfehlt.
  const anzahl = Math.min(points.length, DISSOLVE_MAX_PARTICLES);
  for (let n = 0; n < anzahl; n += 1) {
    const punkt = points[Math.floor(n * schritt)];
    if (!punkt) continue;

    const boe = random() < BOEEN_ANTEIL ? zwischen(random, BOEEN_FAKTOR_MIN, BOEEN_FAKTOR_MAX) : 1;
    partikel.push({
      x: punkt.x,
      y: punkt.y,
      color: punkt.color,
      vx: -zwischen(random, WIND_MIN, WIND_MAX) * boe,
      vy: zwischen(random, -14, 14),
      // Schnelle Partikel steigen flacher — sie sind fort, bevor der Auftrieb
      // greift. Das hält die Böen als Striche erkennbar statt als Fontänen.
      auftrieb: zwischen(random, AUFTRIEB_MIN, AUFTRIEB_MAX) / boe,
      verzoegerung: punkt.vonRechts * DISSOLVE_STAGGER_MS + random() * VERSATZ_RAUSCHEN_MS,
      lebensdauer:
        DISSOLVE_PARTICLE_LIFE_MS *
        zwischen(random, 1 - LEBENSDAUER_STREUUNG, 1 + LEBENSDAUER_STREUUNG),
      wirbelPhase: random() * Math.PI * 2,
      // Wer von einer Böe erfasst wird, trudelt weniger — er ist fort, bevor
      // ihn der Wirbel packt. Das hält die schnellen Partikel als Striche
      // erkennbar.
      wirbelAmplitude: zwischen(random, WIRBEL_AMPLITUDE_MIN, WIRBEL_AMPLITUDE_MAX) / boe,
      wirbelFrequenz: zwischen(random, WIRBEL_FREQUENZ_MIN, WIRBEL_FREQUENZ_MAX),
    });
  }
  return partikel;
}

export interface DissolveSample {
  x: number;
  y: number;
  /** 1 = unversehrt (noch nicht zerfallen), 0 = verweht. */
  alpha: number;
}

/**
 * Ort und Deckkraft eines Partikels zum Zeitpunkt `zeitMs` nach dem Start.
 *
 * Drei Abschnitte:
 * 1. **Vor der Verzögerung:** in Ruhe, voll sichtbar. Der noch nicht
 *    zerfallene Teil der Fläche steht unverändert da.
 * 2. **Zerfall:** erst zur Seite (gleichförmig), dann nach oben
 *    (beschleunigt) — die Bahn knickt von selbst ab, ohne dass irgendwo eine
 *    Phase umgeschaltet werden müsste. Darüber liegt der Wirbel: eine
 *    Schwingung je Partikel, deren Auslenkung von null an wächst.
 * 3. **Danach:** fort.
 */
export function advanceParticle(partikel: DissolveParticle, zeitMs: number): DissolveSample {
  const lokal = zeitMs - partikel.verzoegerung;
  if (lokal <= 0) return { x: partikel.x, y: partikel.y, alpha: 1 };
  if (lokal >= partikel.lebensdauer) return { x: partikel.x, y: partikel.y, alpha: 0 };

  const s = lokal / 1000;
  const fortschritt = lokal / partikel.lebensdauer;
  // Von null anwachsend: Am Anfang steht der Partikel ruhig, erst der Wind
  // bringt ihn ins Trudeln. Ohne das machte die Bahn im ersten Bild einen
  // Sprung zur Seite.
  const wirbel = partikel.wirbelAmplitude * fortschritt;
  const winkel = partikel.wirbelPhase + s * partikel.wirbelFrequenz;
  return {
    x: partikel.x + partikel.vx * s + Math.sin(winkel) * wirbel,
    y:
      partikel.y +
      partikel.vy * s -
      0.5 * partikel.auftrieb * s * s +
      // Andere Phase und Frequenz als in x — gleiche ergäbe eine Gerade
      // schräg zur Bahn statt einer Schleife.
      Math.cos(winkel * 0.7 + partikel.wirbelPhase) * wirbel * WIRBEL_Y_ANTEIL,
    alpha: 1 - fortschritt ** 1.5,
  };
}
