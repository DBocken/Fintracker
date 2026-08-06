/**
 * WP-7.7 — Auslesen der Gerätesignale.
 *
 * Hier — und nur hier — greift die App auf `window`/`navigator` zu, um ein
 * {@link DeviceProfile} zu bilden. AGENTS.md §3 hält `src/lib/` von Browser-
 * APIs frei; genau deshalb ist die Einstufung (`classifyDevice`) und alles,
 * was darauf aufbaut, ohne DOM testbar.
 *
 * Das Profil wird **einmal** gelesen und für die Lebensdauer des Moduls
 * behalten. Das ist Absicht: Kernanzahl und Arbeitsspeicher ändern sich nicht,
 * und ein bei jedem Render neu gebildetes Profil würde jede daraus abgeleitete
 * Memoisierung entwerten.
 */

import { useMemo } from 'react';
import type { DeviceProfile } from '@/lib/device-profile';

/**
 * Liest die Gerätesignale aus dem Browser.
 *
 * `deviceMemory` und `connection` sind nicht standardisiert verfügbar (Safari
 * und Firefox liefern beide nicht); fehlende Werte bleiben `undefined` und
 * werden von `classifyDevice` ausdrücklich NICHT als „schwach" gewertet.
 */
export function readDeviceProfile(): DeviceProfile {
  if (typeof window === 'undefined') return { devicePixelRatio: 1, viewportWidth: 1920 };

  const nav = window.navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };

  return {
    devicePixelRatio: window.devicePixelRatio || 1,
    viewportWidth: window.innerWidth,
    hardwareConcurrency: nav.hardwareConcurrency,
    deviceMemoryGb: nav.deviceMemory,
    coarsePointer:
      typeof window.matchMedia === 'function' ? window.matchMedia('(pointer: coarse)').matches : undefined,
    saveData: nav.connection?.saveData,
  };
}

let cachedProfile: DeviceProfile | null = null;

/** Das einmalig gelesene Geräteprofil. */
export function deviceProfile(): DeviceProfile {
  cachedProfile ??= readDeviceProfile();
  return cachedProfile;
}

/** Verwirft das gemerkte Profil. Ausschließlich für Tests. */
export function resetDeviceProfileCache(): void {
  cachedProfile = null;
}

/** Das Geräteprofil als Hook — stabil über alle Renders. */
export function useDeviceProfile(): DeviceProfile {
  return useMemo(() => deviceProfile(), []);
}
