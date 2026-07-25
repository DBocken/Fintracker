import type { Locale } from '../translations';
import type { Wording } from '../wording';
import type { TranslationOverlay } from './types';
import { everydayDe } from './everyday/de';
import { everydayEn } from './everyday/en';

export type { TranslationOverlay } from './types';

/**
 * Registry der Overlays. `Partial` in beiden Ebenen ist Absicht:
 *
 * - `technical` hat GRUNDSÄTZLICH kein Overlay — der Basisbaum ist dieses
 *   Register.
 * - Locales ohne Eintrag (aktuell `ru`) fallen vollständig auf die Basis
 *   durch. Die Alltagssprache ist damit zunächst ein de/en-Versprechen; das
 *   gehört in die Beschreibung der Einstellung, statt still zu unterliefern.
 */
const OVERLAYS: Partial<Record<Wording, Partial<Record<Locale, TranslationOverlay>>>> = {
  everyday: {
    de: everydayDe,
    en: everydayEn,
  },
};

export function overlayFor(wording: Wording, locale: Locale): TranslationOverlay | undefined {
  return OVERLAYS[wording]?.[locale];
}
