import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
  // Echte Binaerdateien. `jar|zip|keystore|so|dylib|class` stehen hier wegen der
  // Steuerbyte-Pruefung unten: android/gradle/wrapper/gradle-wrapper.jar enthaelt
  // erwartungsgemaess Tausende davon und wuerde den Waechter sonst dauerhaft rot
  // halten — worauf man ihn irgendwann abschaltet.
  .filter((file) => !/\.(png|jpe?g|gif|webp|woff2?|pptx|pdf|jar|zip|keystore|so|dylib|class)$/i.test(file))
  .filter((file) => !['pnpm-lock.yaml', 'package-lock.json'].includes(file));

const forbiddenTrackedEnv = files.filter(
  (file) => /(^|\/)\.env(?:\.|$)/.test(file) && !file.endsWith('.env.example'),
);

const patterns = [
  ['private key', new RegExp(`BEGIN (?:RSA |EC |OPENSSH )?${'PRIVATE'} KEY`)],
  ['live payment secret', new RegExp(`s${'k_live'}_[A-Za-z0-9]{16,}`)],
  ['GitHub token', new RegExp(`g${'hp'}_[A-Za-z0-9]{30,}`)],
  ['AWS access key', new RegExp(`A${'KIA'}[0-9A-Z]{16}`)],
  ['Supabase service-role JWT', /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/],
];

/**
 * Rohe Steuerzeichen ausserhalb von Tab/LF/CR. Ein einzelnes davon genuegt,
 * damit `grep` die Datei fuer binaer haelt und sie in JEDEM Audit stillschweigend
 * ueberspringt — genau so war `src/services/receipt-parser-service.ts` fuer die
 * i18n-Pruefungen unsichtbar (dort standen `\x00`, `\x1f` und `\x7f` roh in einer
 * Regex-Zeichenklasse statt als Escape-Sequenz).
 */
const CONTROL_BYTES = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/;

const findings = [];
for (const file of files) {
  const content = readFileSync(file, 'utf8');

  const control = content.match(CONTROL_BYTES);
  if (control) {
    const offset = content.indexOf(control[0]);
    const line = content.slice(0, offset).split('\n').length;
    const code = control[0].charCodeAt(0).toString(16).padStart(2, '0');
    findings.push(
      `${file}:${line}: raw control byte 0x${code} — use the escape sequence (\\x${code}) instead`,
    );
  }

  for (const [label, pattern] of patterns) {
    if (!pattern.test(content)) continue;
    // Supabase publishable/anon JWTs are intentionally public. Only flag JWTs
    // whose decoded-looking payload or surrounding source identifies service_role.
    if (label === 'Supabase service-role JWT' && !/service_role/i.test(content)) continue;
    findings.push(`${file}: possible ${label}`);
  }
}

if (forbiddenTrackedEnv.length || findings.length) {
  for (const file of forbiddenTrackedEnv) console.error(`${file}: tracked environment file`);
  for (const finding of findings) console.error(finding);
  process.exit(1);
}

console.log(`Secret scan passed (${files.length} tracked text files).`);
