/**
 * Theme-Motion: Erweiterungspunkt für theme-spezifische Animationen.
 *
 * STATUS: Architektur-Vorbereitung, NOCH KEINE Implementierung.
 *
 * Ziel (zukünftig): Themes können eigene Lottie-Animationen und
 * Übergangs-Effekte mitbringen (z.B. ein Sci-Fi-Theme mit Hyperraum-Übergang,
 * ein Anime-Theme mit fallenden Blütenblättern). Sobald `lottie-react`
 * eingebunden wird, liest ein `ThemeMotionPlayer` die hier gelieferten
 * Metadaten und lädt die JSON-Assets aus /public/animations/<theme>/ lazy nach.
 *
 * Bis dahin ist dies bewusst ein No-op, damit die Schnittstelle stabil bleibt
 * und Aufrufer schon jetzt dagegen programmieren können.
 */
import { getSkin, type SkinId, type SkinDef } from './skins';

export type ThemeMotion = NonNullable<SkinDef['animations']>;

/** Liefert die (optionalen) Motion-Metadaten eines Themes. Aktuell meist undefined. */
export function getThemeMotion(skinId: SkinId): ThemeMotion | undefined {
  return getSkin(skinId).animations;
}

/** Ob ein Theme animierte Übergänge wünscht. Default false. */
export function themeHasTransitions(skinId: SkinId): boolean {
  return Boolean(getThemeMotion(skinId)?.transitions);
}
