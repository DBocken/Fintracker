/**
 * Kern des Schriftgrössen-Wächters: „Bildschirmtext ist lesbar."
 *
 * **Warum es diese Regel gibt.** `docs/design-principles.md` Prinzip 7 nennt
 * Kontrast und Tap-Ziele, aber nie die Schriftgrösse — und deshalb hat nie
 * etwas rot gemacht, was auf einem Telefon mit hoher Pixeldichte schlicht
 * nicht mehr zu lesen ist. Nachgemessen standen 21 Stellen unter 11 px
 * (`text-[10px]` 18×, `text-[9px]` 2×, `text-[8px]` 1×), und keine davon war
 * Dekoration: Es waren Beschriftungen der Bodennavigation, Abzeichen an
 * Kategorien, das Mitteltext-Label des Sunburst und die Beschriftungen der
 * Finanzlandschaft. Also gerade die Stellen, an denen jemand etwas ABLESEN
 * soll.
 *
 * **Warum die Grenze bei 11 px liegt.** Das ist die kleinste Grösse, bei der
 * die üblichen Barrierefreiheits-Kataloge funktionalen Text noch als lesbar
 * führen; die Tailwind-Skala fängt mit `text-xs` = 12 px ohnehin darüber an.
 * Die Grenze trifft damit ausschliesslich Stellen, an denen jemand die Skala
 * per Willkürwert UNTERBOTEN hat — und genau das ist die Aussage: Wer unter
 * die Skala greift, tut es, weil der Platz nicht reicht, und der richtige Zug
 * ist dann weniger Text, nicht kleinerer.
 *
 * **Was der Wächter bewusst NICHT sieht** — benannte Grenzen, keine Lücken:
 *
 *   - **Papier und WebGL — aber an der POSITION, nicht an der Datei.** Eine
 *     `fontSize`-EIGENSCHAFT in einem Objektliteral (`{ styles: { fontSize: 8 } }`)
 *     konfiguriert in einer Datei mit `jspdf` die Fusszeile eines Ausdrucks und
 *     in einer Datei mit `three` eine Sprite-Grösse in Weltkoordinaten. Beides
 *     ist kein Bildschirmtext mit fester Pixeldichte, und ein Wächter, der die
 *     8pt-Zeile eines PDF-Exports anmeckert, hätte am ersten Tag Fehlalarm.
 *
 *     Die erste Fassung dieses Wächters schloss deshalb die ganze DATEI aus —
 *     und lag falsch. `SankeyChart.tsx` lädt jsPDF nur für seinen Export und
 *     beschriftet seine Knoten daneben mit `fontSize={10}` auf dem Bildschirm;
 *     `CityLabels.tsx` bindet three ein und legt `text-[10px]`-Beschriftungen
 *     als DOM über die Szene. Vier echte Befunde wären stillgelegt worden,
 *     weil in derselben Datei anderswo legitim eine kleine Grösse steht — die
 *     Fehlerform, die `check:money-format` schon einmal gekostet hat.
 *
 *     Deshalb entscheidet die Form der Fundstelle: Eine Tailwind-Klasse steht
 *     immer im DOM, ein JSX-Attribut `fontSize={…}` immer an einem gerenderten
 *     Element. Nur die Objekt-Eigenschaft ist mehrdeutig — und ausschliesslich
 *     sie wird in Papier- und WebGL-Dateien übergangen.
 *   - **Berechnete Werte.** `fontSize: size * 0.6` ist statisch nicht
 *     entscheidbar. Wer eine Grösse rechnet, hat sie anderswo begründet —
 *     dieselbe Zurückhaltung wie bei `check:transaction-limits` gegenüber
 *     einem durchgereichten Limit.
 *
 * Die Erkennung steht hier und ist ohne Dateisystem testbar — dieselbe
 * Aufteilung wie bei `money-format-core.mjs` und `layers-core.mjs`.
 */

/** Kleinste Grösse, die als Bildschirmtext durchgeht. `text-xs` = 12 px liegt darüber. */
export const MIN_LESBAR_PX = 11;

/** Wurzelgrösse des Browsers — die Umrechnungsbasis für `rem`. */
const ROOT_PX = 16;

/**
 * Dateien, die eine andere Ausgabe als den Bildschirm bespielen. Der dynamische
 * Import zaehlt mit: `DataExport.tsx` laedt jsPDF ueber `import('jspdf')`, damit
 * die Bibliothek nicht im Startbuendel landet — eine statische Form haette
 * ausgerechnet den einzigen Papier-Fall des Bestands nicht erkannt.
 */
const FREMDE_AUSGABE = /(?:from\s+|import\s*\(\s*)['"](jspdf|jspdf-autotable|three)(\/[^'"]*)?['"]/;

/** `text-[10px]`, `text-[0.625rem]`, `text-[9pt]` — der Griff unter die Skala. */
const WILLKUER_KLASSE = /\btext-\[(\d+(?:\.\d+)?)(px|rem|em)\]/g;

/** `fontSize={10}` — JSX-Attribut, also immer an einem gerenderten Element. */
const FONT_SIZE_ATTRIBUT = /\bfontSize\s*=\s*\{\s*(\d+(?:\.\d+)?)\s*\}/g;

/** `fontSize: 9`, `fontSize: '9px'` — Objekt-Eigenschaft, in Papier/WebGL mehrdeutig. */
const FONT_SIZE_EIGENSCHAFT = /\bfontSize\s*:\s*(?:'|")?(\d+(?:\.\d+)?)(px|rem|em)?(?:'|")?/g;

/** Zeilenkommentare und Blockkommentare ausblenden, ohne Zeilennummern zu verschieben. */
function ohneKommentare(quelle) {
  return quelle
    .replace(/\/\*[\s\S]*?\*\//g, (treffer) => treffer.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (treffer, vor) => vor + ' '.repeat(treffer.length - vor.length));
}

function zeileVon(quelle, index) {
  return quelle.slice(0, index).split('\n').length;
}

function nachPixeln(wert, einheit) {
  if (einheit === 'rem' || einheit === 'em') return wert * ROOT_PX;
  return wert;
}

/**
 * Prüfen wir diese Datei überhaupt? Alles, was JSX enthalten kann, also jede
 * `.tsx` ausserhalb von Tests. Die shadcn-Primitive unter `src/components/ui/`
 * sind ausdrücklich MIT geprüft — anders als bei `check:a11y-names`, wo der
 * Fremdbaukasten ausgenommen ist: Eine unlesbare Grösse dort schlägt auf jede
 * Fläche der App durch, die das Primitiv benutzt.
 */
export function istBildschirmtext(pfad) {
  if (!pfad.endsWith('.tsx')) return false;
  if (pfad.includes('__tests__') || pfad.includes('/test-utils/')) return false;
  return true;
}

/**
 * Findet gerenderten Text unterhalb der Lesbarkeitsgrenze.
 * @returns {{ zeile: number, px: number, quelle: string }[]}
 */
export function findeZuKleinenText(quelle, _pfad) {
  const text = ohneKommentare(quelle);
  const fremdeAusgabe = FREMDE_AUSGABE.test(text);
  const funde = [];

  const melde = (treffer, einheit) => {
    const px = nachPixeln(Number(treffer[1]), einheit);
    if (px >= MIN_LESBAR_PX) return;
    funde.push({ zeile: zeileVon(text, treffer.index), px, quelle: treffer[0].trim() });
  };

  for (const treffer of text.matchAll(WILLKUER_KLASSE)) melde(treffer, treffer[2]);
  for (const treffer of text.matchAll(FONT_SIZE_ATTRIBUT)) melde(treffer, 'px');

  if (!fremdeAusgabe) {
    for (const treffer of text.matchAll(FONT_SIZE_EIGENSCHAFT)) melde(treffer, treffer[2] ?? 'px');
  }

  return funde.sort((a, b) => a.zeile - b.zeile);
}
