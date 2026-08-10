import type { Locale } from '../locale';
import type { Wording } from '../wording';
import type { TranslationOverlay } from './types';
import { everydayDe } from './everyday/de';
import { everydayEn } from './everyday/en';
import { everydayRu } from './everyday/ru';

export type { TranslationOverlay } from './types';

/**
 * Registry der Overlays. `Partial` in beiden Ebenen ist Absicht:
 *
 * - `technical` hat GRUNDSÄTZLICH kein Overlay — der Basisbaum ist dieses
 *   Register.
 * - Locales ohne Eintrag fallen vollständig auf die Basis durch. Aktuell gibt
 *   es keine solche Locale mehr: alle `SUPPORTED_LOCALES` haben ein
 *   Alltagssprache-Overlay. Solange das so bleibt, ist der Sprachstil-Schalter
 *   in `WordingSettings` für niemanden deaktiviert — die Abfrage dort bleibt
 *   trotzdem stehen, damit eine neu hinzugefügte Sprache nicht still ein
 *   leeres Versprechen anbietet.
 *
 * `overlay-coverage.test.ts` hält fest, dass jede unterstützte Sprache hier
 * eintragen ist.
 */
const OVERLAYS: Partial<Record<Wording, Partial<Record<Locale, TranslationOverlay>>>> = {
  everyday: {
    de: everydayDe,
    en: everydayEn,
    ru: everydayRu,
  },
};

export function overlayFor(wording: Wording, locale: Locale): TranslationOverlay | undefined {
  return OVERLAYS[wording]?.[locale];
}
