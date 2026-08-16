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
} from './external-endpoints-core.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTER_PFAD = 'docs/security/anbieter-register.md';
const CSP_PFAD = 'vercel.json';

function verfolgteDateien() {
  const ausgabe = execFileSync(
    'git',
    ['ls-files', 'src', 'api', 'supabase/functions', 'public', 'index.html'],
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

console.log('\n🇪🇺 EU-Regel-Wächter läuft (WP 0.8)...\n');

const registerText = fs.readFileSync(path.join(REPO_ROOT, REGISTER_PFAD), 'utf8');
const register = parseRegister(registerText);

const codeHosts = [];
for (const datei of verfolgteDateien()) {
  const quelltext = fs.readFileSync(path.join(REPO_ROOT, datei), 'utf8');
  codeHosts.push(...findeHosts(quelltext, datei));
}

const cspHosts = cspHostsAusVercel();
const { unbekannt, toteZeilen } = vergleiche({ codeHosts, register, cspHosts });

console.log(
  `   ${register.aktiv.length} aktive Registerzeilen · ${register.zuEntfernen.length} zu entfernen · ` +
    `${codeHosts.length} Host-Fundstellen im Code · ${cspHosts.length} in der CSP\n`,
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
