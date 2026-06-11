/**
 * Merkt sich, ob der Nutzer den anonymen Modus bewusst gestartet hat
 * ("Ohne Anmeldung starten" auf dem Landing-Screen, Issue #28).
 *
 * Bewusst NICHT verschlüsselt: Das Flag enthält keine Finanzdaten, es
 * steuert nur, ob beim App-Start der Landing-Screen oder die App gezeigt wird.
 *
 * Der Storage ist injizierbar, damit die Logik ohne Browser testbar ist.
 */

export const ANONYMOUS_MODE_KEY = "ausgabentracker_anonymous_started_v1";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function hasStartedAnonymousMode(
  storage: StorageLike | null = defaultStorage(),
): boolean {
  if (!storage) return false;
  return storage.getItem(ANONYMOUS_MODE_KEY) === "true";
}

export function startAnonymousMode(
  storage: StorageLike | null = defaultStorage(),
): void {
  storage?.setItem(ANONYMOUS_MODE_KEY, "true");
}

export function clearAnonymousMode(
  storage: StorageLike | null = defaultStorage(),
): void {
  storage?.removeItem(ANONYMOUS_MODE_KEY);
}
