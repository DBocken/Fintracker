import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Wächter-Test für Abhängigkeits-Patchstände (siehe docs/security-guidelines.md,
// Klasse 7): CI scannt pnpm-lock.yaml gegen OSV. Dieser Test macht den Rückfall
// schon lokal rot — sowohl das Absenken eines Patch-Floors in package.json als
// auch eine Neuauflösung der Lockdatei auf eine wieder verwundbare Version.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  pnpm: { overrides: Record<string, string> };
};
const lockfile = fs.readFileSync(path.join(REPO_ROOT, 'pnpm-lock.yaml'), 'utf8');
const mcpPoc = {
  pkg: JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'mcp-poc', 'package.json'), 'utf8')) as {
    pnpm: { overrides: Record<string, string> };
  },
  lockfile: fs.readFileSync(path.join(REPO_ROOT, 'mcp-poc', 'pnpm-lock.yaml'), 'utf8'),
};
const osvConfig = fs.readFileSync(path.join(REPO_ROOT, 'osv-scanner.toml'), 'utf8');
const auditWorkflow = fs.readFileSync(
  path.join(REPO_ROOT, '.github', 'workflows', 'security-audit.yml'),
  'utf8',
);

/**
 * Gepatchte Mindestversionen aus konkreten Advisories. Pro Paket kann es mehrere
 * Major-Linien geben (Beispiel brace-expansion: 1.x und 5.x werden getrennt
 * gepatcht) — deshalb ist der Floor an die Major-Version gebunden.
 */
const PATCH_FLOORS: Array<{ pkg: string; major: number; floor: string; advisory: string }> = [
  { pkg: 'react-router', major: 7, floor: '7.18.0', advisory: 'GHSA-chx6-hx7r-mcp5' },
  { pkg: 'react-router-dom', major: 7, floor: '7.18.0', advisory: 'GHSA-chx6-hx7r-mcp5' },
  { pkg: 'postcss', major: 8, floor: '8.5.18', advisory: 'GHSA-r28c-9q8g-f849' },
  { pkg: 'tar', major: 7, floor: '7.5.21', advisory: 'GHSA-r292-9mhp-454m' },
  { pkg: 'js-yaml', major: 4, floor: '4.3.0', advisory: 'GHSA-52cp-r559-cp3m' },
  { pkg: 'brace-expansion', major: 1, floor: '1.1.16', advisory: 'GHSA-3jxr-9vmj-r5cp' },
  { pkg: 'brace-expansion', major: 5, floor: '5.0.8', advisory: 'GHSA-mh99-v99m-4gvg' },
  { pkg: 'dompurify', major: 3, floor: '3.4.12', advisory: 'GHSA-c2j3-45gr-mqc4' },
  { pkg: 'undici', major: 7, floor: '7.28.0', advisory: 'GHSA-c76r-2h9x-mqrr' },
  { pkg: 'yaml', major: 2, floor: '2.8.3', advisory: 'GHSA-288g-9pw2-6h3h' },
];

function compareVersions(a: string, b: string): number {
  const parse = (v: string) => v.split('-')[0].split('.').map((part) => Number.parseInt(part, 10));
  const [left, right] = [parse(a), parse(b)];
  for (let i = 0; i < 3; i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Alle aufgelösten `name@version`-Einträge aus dem `packages:`-Block einer Lockdatei. */
function resolvedVersions(name: string, lock: string = lockfile): string[] {
  const packagesBlock = lock.slice(lock.indexOf('\npackages:'), lock.indexOf('\nsnapshots:'));
  const escaped = name.replace(/[/@]/g, (char) => `\\${char}`);
  const matches = packagesBlock.matchAll(new RegExp(`^ {2}${escaped}@([^:]+):$`, 'gm'));
  return [...matches].map((match) => match[1]);
}

describe('[SECURITY] Abhängigkeits-Patchstände', () => {
  describe('aufgelöste Versionen in pnpm-lock.yaml', () => {
    for (const { pkg: name, major, floor, advisory } of PATCH_FLOORS) {
      it(`[REGRESSION] sollte ${name} ${major}.x nicht unter ${floor} auflösen (${advisory})`, () => {
        const affected = resolvedVersions(name).filter(
          (version) => Number.parseInt(version.split('.')[0], 10) === major,
        );

        // Kein Eintrag ist in Ordnung: dann ist die Linie gar nicht im Baum.
        for (const version of affected) {
          expect(
            compareVersions(version, floor),
            `${name}@${version} liegt unter dem gepatchten Stand ${floor}`,
          ).toBeGreaterThanOrEqual(0);
        }
      });
    }
  });

  describe('package.json', () => {
    it('[REGRESSION] sollte react-router-dom auf mindestens 7.18.0 anheben', () => {
      const range = pkg.dependencies['react-router-dom'];
      expect(compareVersions(range.replace(/^[\^~>=]+/, ''), '7.18.0')).toBeGreaterThanOrEqual(0);
    });

    it('[REGRESSION] sollte postcss auf mindestens 8.5.18 anheben', () => {
      const range = pkg.devDependencies.postcss;
      expect(compareVersions(range.replace(/^[\^~>=]+/, ''), '8.5.18')).toBeGreaterThanOrEqual(0);
    });

    it('sollte die transitiven Patch-Floors als pnpm-Override führen', () => {
      const overrideKeys = Object.keys(pkg.pnpm.overrides);
      for (const name of ['tar', 'js-yaml', 'postcss', 'brace-expansion', 'dompurify']) {
        const covered = overrideKeys.some((key) => key === name || key.startsWith(`${name}@`));
        expect(covered, `Override für ${name} fehlt`).toBe(true);
      }
    });

    it('sollte Override-Ziele nach oben begrenzen (keine offenen Ranges über die Major-Grenze)', () => {
      // `">=1.1.16"` ohne Obergrenze zieht die nächste Major-Linie herein — bei
      // brace-expansion landete so die ESM-Variante 5.x unter minimatch@3.
      const allOverrides = { ...pkg.pnpm.overrides, ...mcpPoc.pkg.pnpm.overrides };
      for (const [selector, target] of Object.entries(allOverrides)) {
        if (!/^[\d^~>=. ]+$/.test(target)) continue;
        expect(target, `Override ${selector} braucht eine Obergrenze`).toMatch(/[<^~]/);
      }
    });
  });

  describe('mcp-poc (eigene Lockdatei, kein Workspace-Member)', () => {
    it('[REGRESSION] sollte fast-uri nicht unter 3.1.4 auflösen (GHSA-v2hh-gcrm-f6hx)', () => {
      const versions = resolvedVersions('fast-uri', mcpPoc.lockfile);
      expect(versions.length).toBeGreaterThan(0);
      for (const version of versions) {
        expect(compareVersions(version, '3.1.4'), `fast-uri@${version}`).toBeGreaterThanOrEqual(0);
      }
    });

    it('sollte im OSV-Lauf der CI mitgescannt werden', () => {
      expect(auditWorkflow).toContain('--lockfile=mcp-poc/pnpm-lock.yaml');
    });
  });

  describe('osv-scanner.toml', () => {
    const entries = osvConfig.split('[[IgnoredVulns]]').slice(1);

    it('sollte jede Ausnahme mit Grund und Ablaufdatum versehen', () => {
      expect(entries.length).toBeGreaterThan(0);
      for (const entry of entries) {
        expect(entry).toMatch(/id = "GHSA-[\w-]+"/);
        expect(entry).toMatch(/reason = "[^"]{20,}"/);
        expect(entry).toMatch(/ignoreUntil = \d{4}-\d{2}-\d{2}/);
      }
    });

    it('sollte nur Funde ohne kompatiblen Patch ignorieren', () => {
      // Positivliste: jeder Eintrag ist im Review begründet worden. Ein neuer
      // Eintrag muss hier bewusst ergänzt werden — das erzwingt die Diskussion.
      const ignoredIds = entries.map((entry) => entry.match(/id = "([^"]+)"/)?.[1]);
      expect(ignoredIds.sort()).toEqual([
        'GHSA-frvp-7c67-39w9',
        'GHSA-mh99-v99m-4gvg',
        'GHSA-qwww-vcr4-c8h2',
      ]);
    });
  });
});
