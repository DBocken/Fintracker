/**
 * Abtastung einer Fläche in Bildpunkte — die Vorlage für die Auflösung.
 *
 * **Warum das ohne neue Abhängigkeit geht.** Eine Bibliothek wie html2canvas
 * rastert beliebiges DOM; sie ist gross, langsam und in der Wiedergabe
 * ungenau. Gebraucht wird hier aber nur, was man *sieht*: Textzeichen und
 * eingefärbte Kästen. Beides lässt sich selbst zeichnen — die Schrift mit
 * `ctx.fillText` in genau der berechneten Schriftart, die Kästen als Rechteck
 * in genau der berechneten Hintergrundfarbe. Danach ein einziges
 * `getImageData`, und jeder deckende Bildpunkt wird ein Partikel.
 *
 * Emoji sind dabei kein Sonderfall, sondern der beste Beleg: Eine Flagge
 * zeichnet der Browser in `fillText` als farbige Grafik, und die Abtastung
 * liefert genau deren rote, goldene und schwarze Punkte zurück.
 *
 * **Rahmen gehören dazu.** Eine Karte besteht sichtbar aus ihrem Rahmen, nicht
 * aus ihrer Füllung — im dunklen Thema liegt `bg-card` dicht am Seitengrund,
 * die Kontur ist das, was man sieht. Wer nur Text und Füllung abtastet, löst
 * die Schrift auf und lässt den Rahmen verschwinden statt zerfallen. Deshalb
 * werden Hintergrund UND Rahmen gezeichnet, beide mit dem echten Eckradius.
 *
 * **Benannte Grenzen.** Nicht abgetastet werden Bilder, SVG, Schatten und
 * Verläufe. Für den Einstieg reicht das (dort gibt es Text, Emoji, gefüllte
 * Kästen und Rahmen); wo es einmal nicht reicht, ist das hier die Stelle.
 *
 * Kein Netzzugriff, kein fremdes Bild — das Canvas bleibt „untainted" und
 * `getImageData` damit erlaubt.
 */

import type { DissolvePoint } from '@/lib/dissolve-particles';

/**
 * Abstand der Abtastung in CSS-Pixeln. `1` heisst: jeder Bildpunkt wird ein
 * Partikel — ein rotes 10×10-Feld ergibt 100 Partikel.
 *
 * Vorläufig `1`; die endgültige Zahl wird gemessen. Die Obergrenze in
 * `dissolve-particles.ts` fängt den Ausreisser ohnehin ab.
 */
export const DISSOLVE_SAMPLE_STRIDE = 1;

/** Ab dieser Deckkraft gilt ein Bildpunkt als sichtbar. */
const MIN_ALPHA = 24;

/** Eine Farbe, die nichts einfärbt (transparent oder gar nicht gesetzt). */
function istUnsichtbar(farbe: string): boolean {
  if (!farbe) return true;
  const f = farbe.replace(/\s/g, '');
  return f === 'transparent' || f === 'rgba(0,0,0,0)' || f === 'none';
}

/**
 * Zerlegt Text in **Graphemcluster**, nicht in Codepunkte.
 *
 * Eine Flagge besteht aus zwei „Regional Indicator"-Zeichen. Wer sie einzeln
 * zeichnet, bekommt zwei Buchstaben in Kästchen statt einer Flagge — genau
 * das Element, das im Einstieg an erster Stelle steht.
 */
interface GraphemeSegmenter {
  segment(input: string): Iterable<{ segment: string }>;
}

/**
 * `Intl.Segmenter` steht nicht in der `lib`-Zielversion dieses Projekts
 * (`es2020`), die Laufzeit kennt es aber in jedem unterstützten Browser.
 * Beschrieben wird deshalb nur die Form, die hier wirklich benutzt wird —
 * statt die Zielversion der ganzen App für eine Zeile anzuheben.
 */
type SegmenterKonstruktor = new (
  locales?: string | string[],
  options?: { granularity?: 'grapheme' | 'word' | 'sentence' },
) => GraphemeSegmenter;

function graphemes(text: string): string[] {
  const Segmenter = (Intl as { Segmenter?: SegmenterKonstruktor }).Segmenter;
  if (Segmenter) {
    const seg = new Segmenter(undefined, { granularity: 'grapheme' });
    return [...seg.segment(text)].map((s) => s.segment);
  }
  // Rückfall ohne Intl.Segmenter: immer noch besser als eine Zerlegung in
  // UTF-16-Einheiten, aber Flaggen zerfallen dann in ihre Bestandteile.
  return [...text];
}

/** Eine Länge aus den berechneten Stilen (`"16px"`) als Zahl. */
function px(wert: string): number {
  const zahl = Number.parseFloat(wert);
  return Number.isFinite(zahl) ? zahl : 0;
}

/**
 * Pfad eines Rechtecks mit abgerundeten Ecken.
 *
 * Bewusst über `arcTo` statt über `ctx.roundRect`: Letzteres fehlt in älteren
 * Browsern und in jsdom, und ein fehlender Rahmen wäre genau der Fehler, den
 * dieser Abschnitt behebt.
 */
function rundesRechteck(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  breite: number,
  hoehe: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, breite / 2, hoehe / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + breite, y, x + breite, y + hoehe, r);
  ctx.arcTo(x + breite, y + hoehe, x, y + hoehe, r);
  ctx.arcTo(x, y + hoehe, x, y, r);
  ctx.arcTo(x, y, x + breite, y, r);
  ctx.closePath();
}

/** Die Schriftangabe, die `ctx.font` versteht, aus den berechneten Stilen. */
function fontOf(style: CSSStyleDeclaration): string {
  return `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
}

/**
 * Zeichnet die Fläche in ein Offscreen-Canvas und gibt ihre sichtbaren
 * Bildpunkte im Viewport-Koordinatensystem zurück.
 *
 * Liefert eine leere Liste, wenn kein Canvas-Kontext verfügbar ist (Tests,
 * ältere Umgebungen) — die Auflösung fällt dann auf ein Ausblenden zurück,
 * statt zu scheitern.
 */
export function samplePoints(element: HTMLElement): DissolvePoint[] {
  const rect = element.getBoundingClientRect();
  const breite = Math.ceil(rect.width);
  const hoehe = Math.ceil(rect.height);
  if (breite <= 0 || hoehe <= 0) return [];

  let ctx: CanvasRenderingContext2D | null = null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = breite;
    canvas.height = hoehe;
    ctx = canvas.getContext('2d', { willReadFrequently: true });
  } catch {
    return [];
  }
  if (!ctx) return [];

  zeichneFlaechen(ctx, element, rect);
  zeichneText(ctx, element, rect);

  let bild: ImageData;
  try {
    bild = ctx.getImageData(0, 0, breite, hoehe);
  } catch {
    return [];
  }

  const punkte: DissolvePoint[] = [];
  const daten = bild.data;
  for (let y = 0; y < hoehe; y += DISSOLVE_SAMPLE_STRIDE) {
    for (let x = 0; x < breite; x += DISSOLVE_SAMPLE_STRIDE) {
      const i = (y * breite + x) * 4;
      const a = daten[i + 3];
      if (a < MIN_ALPHA) continue;
      punkte.push({
        x: rect.left + x,
        y: rect.top + y,
        color: `rgba(${daten[i]},${daten[i + 1]},${daten[i + 2]},${(a / 255).toFixed(3)})`,
        vonRechts: breite > 1 ? (breite - 1 - x) / (breite - 1) : 0,
      });
    }
  }
  return punkte;
}

/**
 * Flächen und Rahmen in Dokumentreihenfolge — hinten zuerst.
 *
 * Beides mit dem echten Eckradius: Ein rechteckig gefüllter Kasten liesse an
 * den Ecken Asche stehen, wo die Karte gar keine hat.
 */
function zeichneFlaechen(
  ctx: CanvasRenderingContext2D,
  wurzel: HTMLElement,
  rect: DOMRect,
): void {
  const elemente = [wurzel, ...Array.from(wurzel.querySelectorAll<HTMLElement>('*'))];
  for (const el of elemente) {
    const style = window.getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') continue;

    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    const x = r.left - rect.left;
    const y = r.top - rect.top;
    const radius = px(style.borderTopLeftRadius);

    if (!istUnsichtbar(style.backgroundColor)) {
      ctx.fillStyle = style.backgroundColor;
      rundesRechteck(ctx, x, y, r.width, r.height, radius);
      ctx.fill();
    }

    zeichneRahmen(ctx, style, x, y, r.width, r.height, radius);
  }
}

/**
 * Der Rahmen eines Elements.
 *
 * Der häufige Fall — vier gleich breite Kanten in einer Farbe — wird als
 * gestrichenes rundes Rechteck gezeichnet; alles andere Kante für Kante als
 * Rechteck. Ungleiche Kanten mit Radius kommen in dieser App nicht vor, und
 * ein exakter Nachbau lohnte den Aufwand nicht.
 */
function zeichneRahmen(
  ctx: CanvasRenderingContext2D,
  style: CSSStyleDeclaration,
  x: number,
  y: number,
  breite: number,
  hoehe: number,
  radius: number,
): void {
  const breiten = [
    px(style.borderTopWidth),
    px(style.borderRightWidth),
    px(style.borderBottomWidth),
    px(style.borderLeftWidth),
  ];
  const farben = [
    style.borderTopColor,
    style.borderRightColor,
    style.borderBottomColor,
    style.borderLeftColor,
  ];
  if (style.borderTopStyle === 'none' || breiten.every((b) => b <= 0)) return;

  const gleich =
    breiten.every((b) => b === breiten[0]) && farben.every((f) => f === farben[0]);

  if (gleich && !istUnsichtbar(farben[0])) {
    const b = breiten[0];
    ctx.strokeStyle = farben[0];
    ctx.lineWidth = b;
    // Um die halbe Breite einwärts: Ein Strich sitzt mittig auf dem Pfad,
    // sonst läge die Hälfte des Rahmens ausserhalb der Fläche.
    rundesRechteck(ctx, x + b / 2, y + b / 2, breite - b, hoehe - b, Math.max(0, radius - b / 2));
    ctx.stroke();
    return;
  }

  const kanten: [number, number, number, number][] = [
    [x, y, breite, breiten[0]],
    [x + breite - breiten[1], y, breiten[1], hoehe],
    [x, y + hoehe - breiten[2], breite, breiten[2]],
    [x, y, breiten[3], hoehe],
  ];
  kanten.forEach(([kx, ky, kb, kh], i) => {
    if (breiten[i] <= 0 || istUnsichtbar(farben[i])) return;
    ctx.fillStyle = farben[i];
    ctx.fillRect(kx, ky, kb, kh);
  });
}

/** Jedes sichtbare Schriftzeichen an seinem echten Platz. */
function zeichneText(ctx: CanvasRenderingContext2D, wurzel: HTMLElement, rect: DOMRect): void {
  const walker = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT);
  ctx.textBaseline = 'middle';

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.nodeValue ?? '';
    if (!text.trim()) continue;
    const eltern = node.parentElement;
    if (!eltern) continue;

    const style = window.getComputedStyle(eltern);
    if (style.visibility === 'hidden' || style.display === 'none') continue;
    ctx.font = fontOf(style);
    ctx.fillStyle = style.color;

    // Zeichenweise über einen Range: Der Browser hat den Umbruch schon
    // gerechnet, jedes Zeichen bringt seinen echten Platz mit. Selbst Text zu
    // setzen hiesse, Zeilenumbruch und Laufweite nachzubauen — und dann würde
    // die Asche neben der Schrift stehen, aus der sie entsteht.
    let offset = 0;
    for (const cluster of graphemes(text)) {
      const range = document.createRange();
      try {
        range.setStart(node, offset);
        range.setEnd(node, offset + cluster.length);
      } catch {
        break;
      }
      offset += cluster.length;
      if (!cluster.trim()) continue;

      for (const r of Array.from(range.getClientRects())) {
        if (r.width <= 0 || r.height <= 0) continue;
        ctx.fillText(cluster, r.left - rect.left, r.top - rect.top + r.height / 2);
      }
    }
  }
}
