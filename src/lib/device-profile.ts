/**
 * Gemeinsame Geräteeinstufung (WP-7.7).
 *
 * Die Heuristik „was ist ein schwaches Gerät" existierte bisher genau einmal —
 * in `features/finance-city/domain/city-quality.ts`, gültig nur für die
 * WebGL-Stadt. WP-7.7 braucht dieselbe Aussage für die Bewegungssprache der
 * ganzen App. Sie wird deshalb hierher gezogen und von beiden Stellen benutzt,
 * statt ein zweites Mal formuliert zu werden: zwei Heuristiken würden
 * auseinanderdriften, und ein Gerät wäre für die Stadt schwach und für die
 * Bewegung stark.
 *
 * Rein und browserfrei nach AGENTS.md §3: `window`/`navigator` werden in
 * `hooks/useDeviceProfile.ts` ausgelesen, hier kommt nur das fertige Profil an.
 * Genau deshalb ist die Einstufung ohne DOM testbar.
 */

/** Was eine Aufrufstelle über das Gerät weiß. */
export type DeviceProfile = {
  devicePixelRatio: number;
  viewportWidth: number;
  hardwareConcurrency?: number;
  deviceMemoryGb?: number;
  /** `pointer: coarse` — Finger statt Maus, also praktisch immer ein Telefon/Tablet. */
  coarsePointer?: boolean;
  /** `navigator.connection.saveData` — ausdrücklicher Sparsamkeitswunsch des Nutzers. */
  saveData?: boolean;
};

/**
 * Drei Klassen, absteigend nach verfügbarer Leistung. Die Reihenfolge ist
 * bewusst keine Ordnung — `phone` ist nicht „zwischen" stark und schwach,
 * sondern eine eigene Aussage: viel Rechenleistung, aber sehr viele Pixel.
 */
export type DeviceClass = 'strong' | 'phone' | 'weak';

/**
 * Schwellen, ab denen ein Gerät als schwach gilt. Bewusst großzügig: lieber
 * eine Stufe zu spät sparen als eine zu früh entwerten.
 */
const WEAK_CORE_COUNT = 4;
const WEAK_MEMORY_GB = 2;
/** Ab dieser Breite gilt ein Touch-Gerät als Tablet und nicht mehr als Telefon. */
const PHONE_MAX_WIDTH = 768;

/**
 * Stuft ein Gerät ein.
 *
 * Regeln, in dieser Reihenfolge:
 * 1. Ausdrücklicher Sparsamkeitswunsch oder erkennbar schwache Hardware → `weak`.
 * 2. Telefon (Touch **und** schmaler Viewport) → `phone`. Auch ein starkes
 *    Telefon landet hier: der Engpass ist die Pixelzahl bei DPR 3, nicht die
 *    Kernanzahl.
 * 3. Sonst `strong`.
 *
 * Fehlende Angaben (`deviceMemory` und `connection` fehlen in Safari und
 * Firefox komplett) werden ausdrücklich **nicht** als „schwach" gewertet —
 * sonst bekäme dort jeder Nutzer die sparsamste Stufe.
 */
export function classifyDevice(profile: DeviceProfile): DeviceClass {
  if (profile.saveData) return 'weak';
  if (profile.hardwareConcurrency !== undefined && profile.hardwareConcurrency <= WEAK_CORE_COUNT) {
    return 'weak';
  }
  if (profile.deviceMemoryGb !== undefined && profile.deviceMemoryGb <= WEAK_MEMORY_GB) {
    return 'weak';
  }
  if (Boolean(profile.coarsePointer) && profile.viewportWidth < PHONE_MAX_WIDTH) return 'phone';
  return 'strong';
}
