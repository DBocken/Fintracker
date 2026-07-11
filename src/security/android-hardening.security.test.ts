import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Wächter-Test für die Android-Härtung (siehe docs/security-guidelines.md, Klasse 6):
// Finanzdaten dürfen weder ins Android-Auto-Backup noch über Klartext-HTTP laufen,
// und es darf keine neue exportierte Angriffsfläche entstehen.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ANDROID_MAIN = path.join(REPO_ROOT, 'android', 'app', 'src', 'main');

const manifest = fs.readFileSync(path.join(ANDROID_MAIN, 'AndroidManifest.xml'), 'utf8');

describe('[SECURITY] Android-Härtung (Manifest & Netzwerk)', () => {
  describe('AndroidManifest.xml', () => {
    it('[REGRESSION] sollte Auto-Backup deaktivieren (allowBackup="false")', () => {
      expect(manifest).toMatch(/android:allowBackup="false"/);
    });

    it('[REGRESSION] sollte eine Network-Security-Config referenzieren', () => {
      expect(manifest).toMatch(/android:networkSecurityConfig="@xml\/network_security_config"/);
    });

    it('sollte genau eine exportierte Komponente haben (Launcher-Activity)', () => {
      const exported = manifest.match(/android:exported="true"/g) ?? [];
      expect(exported).toHaveLength(1);
    });

    it('sollte den FileProvider nicht exportieren', () => {
      const providerBlock = manifest.match(/<provider[\s\S]*?<\/provider>/)?.[0] ?? '';
      expect(providerBlock).toMatch(/android:exported="false"/);
    });
  });

  describe('network_security_config.xml', () => {
    const configPath = path.join(ANDROID_MAIN, 'res', 'xml', 'network_security_config.xml');

    it('[REGRESSION] sollte existieren und Klartext-HTTP verbieten', () => {
      expect(fs.existsSync(configPath)).toBe(true);
      const config = fs.readFileSync(configPath, 'utf8');
      expect(config).toMatch(/cleartextTrafficPermitted="false"/);
      expect(config).not.toMatch(/cleartextTrafficPermitted="true"/);
    });
  });

  describe('Regression Protection (Capacitor)', () => {
    const capacitorConfig = fs.readFileSync(path.join(REPO_ROOT, 'capacitor.config.ts'), 'utf8');

    it('[REGRESSION] sollte Klartext und Mixed Content in der Capacitor-Config verbieten', () => {
      expect(capacitorConfig).toMatch(/cleartext:\s*false/);
      expect(capacitorConfig).toMatch(/allowMixedContent:\s*false/);
    });
  });
});
