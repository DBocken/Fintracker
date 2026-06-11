/**
 * Lokale, gerätegebundene Feature-Flags.
 *
 * Diese Flags steuern experimentelle Bereiche, die bewusst standardmäßig aus sind
 * (z. B. das Trading-Modul, siehe Issue #33). Sie liegen rein lokal im Browser und
 * brauchen keinen Login – damit funktionieren sie auch im anonymen Modus.
 */

export type FeatureFlag = "trading_beta";

const STORAGE_PREFIX = "fintracker:flag:";

/** Liest ein lokales Feature-Flag (Default: aus). */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${flag}`) === "true";
  } catch {
    return false;
  }
}

/** Setzt ein lokales Feature-Flag. */
export function setFeatureEnabled(flag: FeatureFlag, enabled: boolean): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (enabled) {
      localStorage.setItem(`${STORAGE_PREFIX}${flag}`, "true");
    } else {
      localStorage.removeItem(`${STORAGE_PREFIX}${flag}`);
    }
  } catch {
    /* localStorage nicht verfügbar – Flag bleibt aus */
  }
}
