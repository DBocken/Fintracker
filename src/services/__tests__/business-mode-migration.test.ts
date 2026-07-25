import { describe, expect, it, beforeEach } from 'vitest';

import {
  buildDefaultLocalSettings,
  getLocalUserSettings,
  updateLocalUserSettings,
} from '../local-settings-service';
import { localEncryption } from '../local-crypto';
import {
  NAV_FEATURE_PATHS,
  isBusinessModeEnabled,
  type NavFeatureId,
} from '@/lib/life-situations';
import type { UserSettings } from '@/types';

const ALL_FEATURES = Object.keys(NAV_FEATURE_PATHS) as NavFeatureId[];

/** Schreibt den Altzustand, wie ihn Installationen vor der Zusammenlegung haben. */
async function seedLegacy(settings: Partial<UserSettings>): Promise<void> {
  await updateLocalUserSettings(settings);
}

beforeEach(() => {
  localStorage.clear();
  localEncryption.lock();
});

describe('Migration business_mode -> enabled_nav_features', () => {
  it('[REGRESSION] sollte einem Bestandsnutzer mit aktivem Einzelunternehmer-Modus die EÜR erhalten', async () => {
    // Ohne Migration verlöre er nicht nur die EÜR-Navigation, sondern auch die
    // Steuer-Stufe im Liquiditäts-Wasserfall — eine stille Änderung an einer
    // Geldansicht.
    await seedLegacy({ business_mode: true });

    const settings = await getLocalUserSettings();

    expect(isBusinessModeEnabled(settings.enabled_nav_features)).toBe(true);
    expect(settings.enabled_nav_features).toContain('euer');
  });

  it('sollte einem solchen Nutzer die übrigen Bereiche NICHT wegnehmen', async () => {
    // Er hatte nie eine Bereichsauswahl getroffen, sah also alles. Die
    // Migration darf daraus keine Einschränkung machen.
    await seedLegacy({ business_mode: true });

    const settings = await getLocalUserSettings();

    expect([...(settings.enabled_nav_features ?? [])].sort()).toEqual([...ALL_FEATURES].sort());
  });

  it('sollte das Alt-Flag nach der Migration räumen (eine Quelle der Wahrheit)', async () => {
    await seedLegacy({ business_mode: true });

    const settings = await getLocalUserSettings();

    expect(settings.business_mode).toBeUndefined();
  });

  it('sollte die Migration dauerhaft speichern statt sie bei jedem Lesen erneut zu berechnen', async () => {
    await seedLegacy({ business_mode: true });

    await getLocalUserSettings();
    const second = await getLocalUserSettings();

    expect(second.enabled_nav_features).toContain('euer');
    expect(second.business_mode).toBeUndefined();
  });

  it('sollte für Nutzer ohne Einzelunternehmer-Modus keine Auswahl erfinden', async () => {
    await seedLegacy({ business_mode: false });

    const settings = await getLocalUserSettings();

    // null/ungesetzt = keine Einschränkung; die EÜR bleibt als Opt-in verborgen.
    expect(settings.enabled_nav_features ?? null).toBeNull();
    expect(isBusinessModeEnabled(settings.enabled_nav_features)).toBe(false);
  });

  it('sollte eine bereits getroffene Bereichsauswahl nicht überschreiben', async () => {
    await seedLegacy({ business_mode: true, enabled_nav_features: ['budgets'] });

    const settings = await getLocalUserSettings();

    expect(settings.enabled_nav_features).toEqual(['budgets']);
    expect(settings.business_mode).toBeUndefined();
  });

  it('sollte den Einzelunternehmer-Modus nicht mehr als eigenes Default-Flag führen', async () => {
    expect(buildDefaultLocalSettings().business_mode).toBeUndefined();
    expect(isBusinessModeEnabled(buildDefaultLocalSettings().enabled_nav_features)).toBe(false);
  });
});
