#!/usr/bin/env node

/**
 * EU-Regel-Wächter (WP 0.8, BTR-2).
 *
 * „Eine Anbieterregel ohne Wächter ist eine Absichtserklärung."
 * (`docs/architecture/eu-souveraenitaet.md`)
 *
 * Prüft die Deckung zwischen Quelltext und Anbieter-Register in **beide**
 * Richtungen. Die Erkennung steht in `external-endpoints-core.mjs` und ist
 * ohne Dateisystem testbar — dieselbe Aufteilung wie bei `layers-core.mjs`.
 *
 * **Ohne Ausnahmeliste.** Ein Eintrag hiesse „dieser Host darf unerklärt
 * bleiben" — und das Register ist die Faktenbasis für Subprozessoren-
 * Verzeichnis, VVT (Art. 30) und Datenschutztexte. Abweichungen werden im
 * Register korrigiert, nicht hier weggefiltert.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  istZuPruefen,
  findeHosts,
  parseRegister,
  findeCspHosts,
  vergleiche,
  findeAbhaengigkeitsHosts,
} from './external-endpoints-core.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTER_PFAD = 'docs/security/anbieter-register.md';
const CSP_PFAD = 'vercel.json';

function verfolgteDateien() {
  const ausgabe = execFileSync(
    'git',
    ['ls-files', 'src', 'api', 'supabase/functions', 'services', 'public', 'index.html'],
    { encoding: 'utf8', cwd: REPO_ROOT },
  );
  return ausgabe
    .trim()
    .split('\n')
    .filter(Boolean)
    // `git ls-files` liest den INDEX; eine ungestagte Löschung steht dort noch
    // drin und der Lesezugriff darauf wirft.
    .filter((f) => fs.existsSync(path.join(REPO_ROOT, f)))
    .filter(istZuPruefen);
}

function cspHostsAusVercel() {
  const voll = path.join(REPO_ROOT, CSP_PFAD);
  if (!fs.existsSync(voll)) return [];
  return findeCspHosts(fs.readFileSync(voll, 'utf8'));
}

/**
 * Die ausgelieferten Dateien eines Pakets: seine Einstiegspunkte plus `dist/`.
 *
 * Bewusst NICHT der ganze Paketbaum. `three/examples/jsm/**` etwa nennt drei
 * verschiedene CDNs, wird aber nur geladen, wenn jemand diese Beispielmodule
 * ausdrücklich importiert — die App tut das nicht. Ein Wächter, der das
 * meldet, erzeugt Arbeit ohne Befund.
 */
function ausgelieferteDateien(wurzel) {
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(wurzel, 'package.json'), 'utf8'));
  } catch {
    return [];
  }

  const kandidaten = new Set();
  for (const wert of [pkg.main, pkg.module, pkg.browser, pkg.unpkg]) {
    if (typeof wert === 'string') kandidaten.add(wert);
  }
  const sammleExports = (eintrag) => {
    if (typeof eintrag === 'string') kandidaten.add(eintrag);
    else if (eintrag && typeof eintrag === 'object') Object.values(eintrag).forEach(sammleExports);
  };
  sammleExports(pkg.exports);

  const dateien = new Set();
  for (const rel of kandidaten) {
    const voll = path.join(wurzel, rel);
    if (fs.existsSync(voll) && fs.statSync(voll).isFile()) dateien.add(voll);
  }

  const dist = path.join(wurzel, 'dist');
  if (fs.existsSync(dist)) {
    const laufe = (verzeichnis, tiefe = 0) => {
      if (tiefe > 3) return;
      for (const eintrag of fs.readdirSync(verzeichnis, { withFileTypes: true })) {
        const voll = path.join(verzeichnis, eintrag.name);
        if (eintrag.isDirectory()) laufe(voll, tiefe + 1);
        else if (/\.(js|mjs|cjs)$/.test(eintrag.name) && !eintrag.name.endsWith('.map')) dateien.add(voll);
      }
    };
    laufe(dist);
  }

  return [...dateien];
}

/**
 * CDN-Vorgaben der DIREKTEN Abhängigkeiten.
 *
 * Der blinde Fleck, den der Wächter bis hierher hatte: `verfolgteDateien()`
 * liest den git-Index, und `node_modules` steht dort nicht. Ein Host, der
 * ausschliesslich in der Vorgabekonfiguration einer Abhängigkeit steht, war
 * damit unsichtbar — aufgefallen an `tesseract.js`, das Worker, WASM-Kern und
 * Sprachdaten von `cdn.jsdelivr.net` lädt, ohne dass eine Aufrufstelle das
 * nennt (Issue #327).
 *
 * Nur direkte Abhängigkeiten: Was eine transitive Abhängigkeit tut, ist eine
 * Frage an ihren direkten Elternteil, und die Kette vollständig abzulaufen
 * hiesse, den halben Baum zu lesen.
 */
function abhaengigkeitsHosts() {
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
  const direkte = Object.keys(pkg.dependencies ?? {});
  const funde = [];
  let geprueft = 0;

  for (const name of direkte) {
    const verzeichnis = path.join(REPO_ROOT, 'node_modules', name);
    if (!fs.existsSync(verzeichnis)) continue;
    geprueft += 1;
    for (const datei of ausgelieferteDateien(fs.realpathSync(verzeichnis))) {
      let quelltext;
      try {
        quelltext = fs.readFileSync(datei, 'utf8');
      } catch {
        continue;
      }
      funde.push(...findeAbhaengigkeitsHosts(quelltext, `${name} (${path.basename(datei)})`));
    }
  }

  // Ohne `node_modules` prüft diese Hälfte NICHTS — und meldete trotzdem
  // grün. Ein Wächter, der stillschweigend leer läuft, ist schlimmer als
  // keiner: Er behauptet eine Aussage, die er nie getroffen hat. Dieselbe
  // Untergrenze zieht `call-site-keys.test.ts` („Sonst wäre ein grüner Lauf
  // bedeutungslos").
  if (direkte.length > 0 && geprueft === 0) {
    console.error(
      '❌ Keine einzige direkte Abhängigkeit gefunden — `node_modules` fehlt.\n' +
        '\n   Die Prüfung der CDN-Vorgaben aus Abhängigkeiten hätte hier still\n' +
        '   nichts geprüft und trotzdem grün gemeldet. Erst `pnpm install`,\n' +
        '   dann erneut.\n',
    );
    process.exit(1);
  }

  // Je Paket und Host EINE Meldung — sonst nennt eine Bibliothek mit zehn
  // Bündeln denselben CDN zehnmal.
  const gesehen = new Set();
  const eindeutig = funde.filter((f) => {
    const schluessel = `${f.datei.split(' ')[0]}|${f.host}`;
    if (gesehen.has(schluessel)) return false;
    gesehen.add(schluessel);
    return true;
  });
  return { funde: eindeutig, geprueft };
}

console.log('\n🇪🇺 EU-Regel-Wächter läuft (WP 0.8)...\n');

const registerText = fs.readFileSync(path.join(REPO_ROOT, REGISTER_PFAD), 'utf8');
const register = parseRegister(registerText);

const codeHosts = [];
for (const datei of verfolgteDateien()) {
  const quelltext = fs.readFileSync(path.join(REPO_ROOT, datei), 'utf8');
  codeHosts.push(...findeHosts(quelltext, datei));
}

const cspHosts = cspHostsAusVercel();
const { funde: paketHosts, geprueft: gepruefePakete } = abhaengigkeitsHosts();
const { unbekannt, toteZeilen } = vergleiche({
  codeHosts: [...codeHosts, ...paketHosts],
  register,
  cspHosts,
});

console.log(
  `   ${register.aktiv.length} aktive Registerzeilen · ${register.zuEntfernen.length} zu entfernen · ` +
    `${codeHosts.length} Host-Fundstellen im Code · ${paketHosts.length} in ${gepruefePakete} ` +
    `Abhängigkeiten · ${cspHosts.length} in der CSP\n`,
);

if (unbekannt.length === 0 && toteZeilen.length === 0) {
  console.log('✅ Jeder Host ist im Register erklärt, jede aktive Zeile kommt vor\n');
  process.exit(0);
}

if (unbekannt.length > 0) {
  console.error(`❌ ${unbekannt.length} Host-Fundstelle(n) ohne Registerzeile:\n`);
  for (const fund of unbekannt) {
    const ort = fund.zeile > 0 ? `${fund.datei}:${fund.zeile}` : fund.datei;
    console.error(`   ${fund.host}\n      ${ort}  [${fund.form}]`);
  }
  console.error(
    `\n   Der Weg ist eine Zeile in ${REGISTER_PFAD} — mit Sitz, Rolle`,
    '\n   (Subprozessor · Datenquelle · nutzergewählt · Link · Entwicklung),',
    '\n   Rechtsgrundlage und Prüfdatum. Nicht hier wegfiltern: Das Register',
    '\n   ist die Faktenbasis für VVT und Datenschutztext.\n',
  );
}

if (toteZeilen.length > 0) {
  console.error(`❌ ${toteZeilen.length} aktive Registerzeile(n) ohne Fundstelle in Code oder CSP:\n`);
  for (const zeile of toteZeilen) {
    console.error(`   ${zeile.host}  [Rolle: ${zeile.rolle || '—'}]`);
  }
  console.error(
    '\n   Entweder ist der Anbieter weg — dann gehört die Zeile aus dem Register',
    '\n   (oder nach „Zu entfernen") — oder der Aufruf ist weg und die Zeile',
    '\n   behauptet einen Datenfluss, den es nicht gibt. Ein falsches Register',
    '\n   ist schlimmer als keines.\n',
  );
}

process.exit(1);
