import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
  .filter((file) => !/\.(png|jpe?g|gif|webp|woff2?|pptx|pdf)$/i.test(file))
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

const findings = [];
for (const file of files) {
  const content = readFileSync(file, 'utf8');
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
