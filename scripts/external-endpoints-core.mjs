/**
 * Erkennung für den EU-Regel-Wächter (WP 0.8) — ohne Dateisystem testbar,
 * dieselbe Aufteilung wie `i18n-core.mjs` und `store-serialization-core.mjs`.
 *
 * **Warum es diesen Wächter gibt.** Die EU-only-Regel
 * (`docs/architecture/eu-souveraenitaet.md`) stand als Text da, während der
 * Ist-Zustand sie an mehreren Stellen verletzte, ohne dass irgendetwas rot
 * wurde. Die ADR zieht daraus selbst die Lehre: „Eine Anbieterregel ohne
 * Wächter ist eine Absichtserklärung."
 *
 * Geprüft wird in **beide** Richtungen:
 *   Code → Register:  jeder externe Host im Produktivcode ist erklärt.
 *   Register → Code:  jede aktive Zeile kommt im Code oder in der CSP vor
 *                     (sonst führt das Register einen Anbieter, den es nicht
 *                     mehr gibt — und ein falsches Register ist schlimmer als
 *                     keines, weil VVT und Datenschutztext daraus abgeleitet
 *                     werden).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Welche Dateien geprüft werden
// ─────────────────────────────────────────────────────────────────────────────

const GEPRUEFTE_BAEUME = [/^src\//, /^api\//, /^supabase\/functions\//, /^public\//];
const GEPRUEFTE_EINZELDATEIEN = new Set(['index.html']);

/**
 * Binärdateien werden nicht als Text gelesen.
 *
 * Gemessen beim Erstlauf: `public/assets/illustrations/background.png` trägt
 * XMP-Provenienz-Metadaten und meldete damit `trufo.ai` und `www.w3.org` als
 * Hosts. Eine PNG ruft nichts auf — eingebettete Metadaten sind kein
 * Datenfluss, und `grep` über Binärdateien erzeugt ohnehin Zufallstreffer.
 */
const BINAER = /\.(png|jpe?g|gif|ico|webp|avif|bmp|woff2?|ttf|otf|eot|pdf|zip|gz|br|wasm|traineddata|mp[34]|webm|ogg)$/i;

/**
 * Tests sind ausgenommen — dort sind fremde Hosts der **Zweck**:
 * `safe-url.test.ts` beweist mit `gocardless.com.evil.tld`, dass genau dieser
 * Host abgelehnt wird. Ein Wächter, der ihn meldet, verlangt, den Angriff aus
 * dem Angriffstest zu entfernen. Testcode wird ausserdem nie ausgeliefert —
 * er ist kein Datenfluss.
 */
export function istZuPruefen(relPath) {
  if (relPath.includes('__tests__/')) return false;
  if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(relPath)) return false;
  if (BINAER.test(relPath)) return false;
  if (GEPRUEFTE_EINZELDATEIEN.has(relPath)) return true;
  return GEPRUEFTE_BAEUME.some((re) => re.test(relPath));
}

// ─────────────────────────────────────────────────────────────────────────────
// Kommentare ausblenden
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Entfernt Kommentare, **ohne Zeichenketten anzufassen** — und ohne
 * Zeilennummern zu verschieben.
 *
 * Ein naives `line.split('//')` wäre hier falsch herum: In `"https://stooq.com"`
 * stehen die beiden Schrägstriche INNERHALB der Zeichenkette. Der Wächter
 * würde genau die Hosts verlieren, die er sucht, und genau die Hosts melden,
 * die nur als Gegenbeispiel im Kommentar stehen (`safe-url.ts:35` nennt
 * `https://evil@ob.gocardless.com` als das, was NICHT durchgehen darf).
 */
export function ohneKommentare(quelltext) {
  let out = '';
  let zustand = 'code'; // code | zeile | block | sq | dq | tpl
  let i = 0;

  while (i < quelltext.length) {
    const c = quelltext[i];
    const c2 = quelltext[i + 1];

    if (zustand === 'code') {
      if (c === '/' && c2 === '/') { zustand = 'zeile'; i += 2; continue; }
      if (c === '/' && c2 === '*') { zustand = 'block'; i += 2; continue; }
      if (c === "'") zustand = 'sq';
      else if (c === '"') zustand = 'dq';
      else if (c === '`') zustand = 'tpl';
      out += c; i += 1; continue;
    }

    if (zustand === 'zeile') {
      if (c === '\n') { zustand = 'code'; out += c; }
      i += 1; continue;
    }

    if (zustand === 'block') {
      if (c === '*' && c2 === '/') { zustand = 'code'; i += 2; continue; }
      if (c === '\n') out += c; // Zeilennummern erhalten
      i += 1; continue;
    }

    // innerhalb einer Zeichenkette
    if (c === '\\') { out += c + (c2 ?? ''); i += 2; continue; }
    if ((zustand === 'sq' && c === "'") || (zustand === 'dq' && c === '"') || (zustand === 'tpl' && c === '`')) {
      zustand = 'code';
    }
    out += c; i += 1;
  }

  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Was als Host gilt
// ─────────────────────────────────────────────────────────────────────────────

/** RFC 2606 / RFC 6761 / RFC 6762 — für Beispiele und Tests reservierte Namen. */
const RESERVIERTE_TLDS = new Set(['example', 'test', 'invalid', 'localhost', 'local']);
const RESERVIERTE_DOMAINS = ['example.com', 'example.net', 'example.org'];

/**
 * Dateiendungen. `sankey.ts` und `de-DE.json` sehen wie Domains aus; ohne
 * diese Liste wäre jeder Dateiname ein Fund.
 */
const DATEIENDUNGEN = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'json', 'css', 'scss', 'html', 'md',
  'svg', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'ico', 'sql', 'yml', 'yaml',
  'toml', 'lock', 'txt', 'xml', 'wasm', 'traineddata', 'woff', 'woff2', 'map',
  'sh', 'env', 'gz', 'zip', 'pdf', 'csv',
]);

export function istReserviert(host) {
  const h = host.toLowerCase();
  if (h === 'localhost') return true;
  if (/^\d+(\.\d+)*$/.test(h)) return true; // IP-Literale
  const letzte = h.split('.').pop();
  if (RESERVIERTE_TLDS.has(letzte)) return true;
  return RESERVIERTE_DOMAINS.some((d) => h === d || h.endsWith(`.${d}`));
}

/**
 * Ist die Zeichenkette überhaupt ein Hostname?
 *
 * Ein Punkt allein genügt nicht — `1.2.0`, `0.75rem`, `MM.yy` und `sankey.ts`
 * haben alle einen. Verlangt wird eine letzte Silbe aus mindestens zwei
 * Buchstaben.
 *
 * **`streng` steuert die Dateinamen-Prüfung, und zwar aus einem gemessenen
 * Grund.** `.sh` ist beides: Endung eines Shell-Skripts UND die ccTLD, unter
 * der `esm.sh` läuft — ein Host, den fünf Edge Functions zur Laufzeit
 * importieren. Eine Endungsliste, die `esm.sh` verwirft, macht ausgerechnet
 * eine Lieferketten-Abhängigkeit unsichtbar; eine Liste ohne `.sh` würde
 * `deploy.sh` durchlassen.
 *
 * Die Auflösung liegt nicht in der Liste, sondern in der Herkunft: Hinter
 * `https://` IST die Zeichenkette bereits erwiesen ein Host, dort braucht es
 * die Heuristik gar nicht (`streng: false`). Nur beim blanken Literal, wo
 * allein die Position für einen Host spricht, muss sie greifen.
 */
export function istHostartig(wert, streng = true) {
  if (typeof wert !== 'string' || !wert.includes('.')) return false;
  if (/[\s/@:?#]/.test(wert)) return false;
  if (/^\d+(\.\d+)*$/.test(wert)) return false;          // 1.2.0
  if (/^[\d.]+[a-z]{1,4}$/i.test(wert)) return false;    // 0.75rem
  const teile = wert.toLowerCase().split('.');
  if (teile.length < 2 || teile.some((t) => !/^[a-z0-9-]+$/.test(t))) return false;
  const letzte = teile[teile.length - 1];
  if (streng && DATEIENDUNGEN.has(letzte)) return false;
  return /^[a-z]{2,}$/.test(letzte);
}

// ─────────────────────────────────────────────────────────────────────────────
// Hosts im Quelltext finden
// ─────────────────────────────────────────────────────────────────────────────

/** `https://host/…`, optionale Userinfo (`user@`) wird übersprungen. */
const URL_FORM = /\bhttps?:\/\/(?:[^/@\s"'`]*@)?([A-Za-z0-9._-]+)/g;

/**
 * Ein blanker Host wird nur gelesen, wenn die **Position** ihn ausweist —
 * dieselbe Idee wie bei `check:i18n` (dort weist die Prop-Position einen
 * String als Bildschirmtext aus).
 *
 * Der Grund ist gemessen: Blanke Domain-Erkennung ohne Positionsprüfung
 * meldet jeden i18n-Schlüssel (`accountService.accountTypeLabelCash` besteht
 * jede Hostname-Prüfung), jede Versionsnummer und jede CSS-Einheit. Eine
 * Ausnahmeliste dagegen wäre genau der Fehlalarm, der Wächter abschaltet
 * statt sie durchzusetzen.
 *
 * Erfasst wird damit die Bauform, auf die es ankommt:
 * `GOCARDLESS_AUTH_HOST_SUFFIXES = ['gocardless.com']` entscheidet, welche
 * Redirect-Ziele akzeptiert werden — eine Änderung dort ist ein Datenfluss,
 * auch wenn nie ein `https://` daneben steht.
 *
 * **Benannte Grenze:** nur dieselbe Zeile. Ein über mehrere Zeilen verteiltes
 * Array hinter einem HOST-Bezeichner wird nicht gesehen.
 */
const AUSWEISENDER_BEZEICHNER = /\b[A-Za-z0-9_$]*(?:HOST|ORIGIN|DOMAIN|ENDPOINT)[A-Za-z0-9_$]*\s*[:=]/i;
const ZEICHENKETTE = /['"`]([^'"`\n]+)['"`]/g;

/**
 * `$schema`, `$id` und `xmlns` tragen **Bezeichner**, keine Endpunkte: Die
 * URI benennt eine Sprache oder einen Namensraum und wird nie abgerufen.
 *
 * Das ist keine Ausnahme für einen Anbieter (die gäbe es hier nicht), sondern
 * eine Einordnung: `https://json-schema.org/draft/2020-12/schema` in
 * `scenario_payload.schema.json` ist so wenig ein Datenfluss wie
 * `http://www.w3.org/2000/svg` in jedem SVG. Erkannt wird das an derselben
 * Stelle wie überall in diesem Wächter — an der Position, nicht am Namen.
 */
const BEZEICHNER_URI = /(?:\$schema|\$id|xmlns(?::[A-Za-z-]+)?)["']?\s*[:=]\s*["']?$/;

export function findeHosts(quelltext, datei) {
  const zeilen = ohneKommentare(quelltext).split('\n');
  const funde = [];
  const gesehen = new Set();

  const merke = (host, zeile, form) => {
    const h = host.toLowerCase().replace(/\.$/, '');
    if (!istHostartig(h, form === 'literal') || istReserviert(h)) return;
    const schluessel = `${h}:${zeile}`;
    if (gesehen.has(schluessel)) return;
    gesehen.add(schluessel);
    funde.push({ host: h, zeile, datei, form });
  };

  zeilen.forEach((zeile, idx) => {
    const nr = idx + 1;

    for (const treffer of zeile.matchAll(URL_FORM)) {
      if (BEZEICHNER_URI.test(zeile.slice(0, treffer.index))) continue;
      merke(treffer[1], nr, 'url');
    }

    if (AUSWEISENDER_BEZEICHNER.test(zeile)) {
      for (const treffer of zeile.matchAll(ZEICHENKETTE)) merke(treffer[1], nr, 'literal');
    }
  });

  return funde;
}

// ─────────────────────────────────────────────────────────────────────────────
// Das Register lesen
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Liest die Host-Spalte der Registertabellen.
 *
 * Nur „Aktiv" und „Zu entfernen" führen Hosts. **„Geplant" hat gar keine
 * Host-Spalte** (erste Spalte ist der Anbieter) — ein Anbieter ohne Host ist
 * noch kein Endpunkt. Die Zeile bekommt ihren Host, wenn sie aktiv wird.
 */
export function parseRegister(markdown) {
  const aktiv = [];
  const zuEntfernen = [];
  let abschnitt = null;

  for (const zeile of markdown.split('\n')) {
    const ueberschrift = zeile.match(/^##\s+(.+)$/);
    if (ueberschrift) {
      const titel = ueberschrift[1].toLowerCase();
      if (titel.startsWith('aktiv')) abschnitt = 'aktiv';
      else if (titel.startsWith('zu entfernen')) abschnitt = 'zuEntfernen';
      else abschnitt = null;
      continue;
    }

    if (!abschnitt || !zeile.trimStart().startsWith('|')) continue;
    if (/^\s*\|[\s|:-]+\|\s*$/.test(zeile)) continue; // Trennzeile

    const spalten = zeile.split('|').slice(1, -1).map((s) => s.trim());
    if (spalten.length === 0) continue;
    if (/^host\(s\)$/i.test(spalten[0])) continue; // Kopfzeile

    const rolle = abschnitt === 'aktiv' ? (spalten[3] ?? '') : '';

    for (const roh of spalten[0].matchAll(/`([^`]+)`/g)) {
      const host = roh[1].trim().toLowerCase();
      // Die Host-Spalte ist eine Deklaration, keine Vermutung — deshalb ohne
      // Dateinamen-Heuristik (`esm.sh`). Der Pfad `/api/mcp` fällt am `/` weg.
      if (!istHostartig(host, false)) continue;
      if (abschnitt === 'aktiv') aktiv.push({ host, rolle });
      else zuEntfernen.push(host);
    }
  }

  return { aktiv, zuEntfernen };
}

// ─────────────────────────────────────────────────────────────────────────────
// Vergleich
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `www.` fällt weg: Das Register führt `schufa.de`, der Code ruft
 * `https://www.schufa.de`. Das ist derselbe Anbieter, nicht zwei.
 */
function normalisiere(host) {
  return host.toLowerCase().replace(/^www\./, '');
}

/** Deckt eine Registerzeile diesen Host? Subdomains zählen mit. */
function deckt(registerHost, host) {
  const r = normalisiere(registerHost);
  const h = normalisiere(host);
  return h === r || h.endsWith(`.${r}`);
}

export function vergleiche({ codeHosts = [], register, cspHosts = [] }) {
  const bekannt = [...register.aktiv.map((z) => z.host), ...register.zuEntfernen];

  const alleFunde = [
    ...codeHosts,
    ...cspHosts.map((host) => ({ host, zeile: 0, datei: 'vercel.json (CSP)', form: 'csp' })),
  ];

  const unbekannt = alleFunde.filter((f) => !bekannt.some((r) => deckt(r, f.host)));

  /**
   * Rolle „Entwicklung" ist von der Code-Pflicht ausgenommen: GitHub berührt
   * keine Nutzerdaten und taucht in App-Code naturgemäss nicht auf. Eine
   * Code-Pflicht dafür wäre ein Fehlalarm mit Ansage — und die Rolle steht
   * bereits im Register, es braucht keine zweite Liste.
   */
  const toteZeilen = register.aktiv.filter(
    (z) => !z.rolle.includes('Entwicklung') && !alleFunde.some((f) => deckt(z.host, f.host)),
  );

  return { unbekannt, toteZeilen };
}

// ─────────────────────────────────────────────────────────────────────────────
// CSP
// ─────────────────────────────────────────────────────────────────────────────

/** Zieht die Hosts aus den `*-src`-Direktiven einer CSP-Zeichenkette. */
export function findeCspHosts(csp) {
  const hosts = new Set();
  for (const treffer of String(csp).matchAll(/https?:\/\/([A-Za-z0-9._-]+)/g)) {
    const host = treffer[1].toLowerCase();
    if (istHostartig(host, false) && !istReserviert(host)) hosts.add(host);
  }
  return [...hosts];
}
