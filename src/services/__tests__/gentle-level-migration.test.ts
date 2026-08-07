import { describe, expect, it, beforeEach } from 'vitest';

import { getLocalUserSettings, updateLocalUserSettings } from '../local-settings-service';
import { localEncryption } from '../local-crypto';
import type { UserSettings } from '@/types';

/**
 * Migration des abgelösten Schalters `gentle_mode` auf die Stufe
 * `gentle_level` (`docs/debt-avoidance-recovery.md`).
 *
 * Der heikle Teil ist die Richtung: Der Sanfte Modus schützt Menschen davor,
 * dass ihnen beim Öffnen der App eine Zahl entgegenspringt. Eine Migration,
 * die dabei die Stufe zu niedrig ansetzt, deckt genau diese Zahlen auf — und
 * zwar ohne dass jemand darum gebeten hätte.
 */

/** Schreibt den Altzustand, wie ihn Installationen vor der Leiter haben. */
async function seedLegacy(settings: Partial<UserSettings>): Promise<void> {
  await updateLocalUserSettings(settings);
}

beforeEach(() => {
  localStorage.clear();
  localEncryption.lock();
});

describe('Migration gentle_mode -> gentle_level', () => {
  it('[REGRESSION] sollte einem Bestandsnutzer mit sanftem Modus keine Betraege aufdecken', async () => {
    await seedLegacy({ gentle_mode: true });

    const settings = await getLocalUserSettings();

    expect(settings.gentle_level).toBe(3);
  });

  it('sollte ohne sanften Modus die Stufe 0 setzen', async () => {
    await seedLegacy({ gentle_mode: false });

    const settings = await getLocalUserSettings();

    expect(settings.gentle_level).toBe(0);
  });

  it('sollte das Alt-Flag nach der Migration raeumen (eine Quelle der Wahrheit)', async () => {
    await seedLegacy({ gentle_mode: true });

    const settings = await getLocalUserSettings();

    expect(settings.gentle_mode).toBeUndefined();
  });

  it('sollte die Migration dauerhaft speichern statt sie bei jedem Lesen neu zu berechnen', async () => {
    await seedLegacy({ gentle_mode: true });

    await getLocalUserSettings();
    const second = await getLocalUserSettings();

    expect(second.gentle_level).toBe(3);
    expect(second.gentle_mode).toBeUndefined();
  });

  it('sollte eine bereits gewaehlte Stufe nicht ueberschreiben', async () => {
    // Die Stufe ist die neuere Aussage — sie gewinnt gegen das Alt-Flag.
    await seedLegacy({ gentle_mode: true, gentle_level: 1 });

    const settings = await getLocalUserSettings();

    expect(settings.gentle_level).toBe(1);
    expect(settings.gentle_mode).toBeUndefined();
  });

  it('sollte fuer Nutzer ohne Alt-Flag keine Stufe erfinden', async () => {
    await seedLegacy({ theme: 'dark' });

    const settings = await getLocalUserSettings();

    expect(settings.gentle_level).toBeUndefined();
  });
});
