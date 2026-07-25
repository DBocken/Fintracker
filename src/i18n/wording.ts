/**
 * Sprachstil („wording") — eine eigene Achse neben der Sprache.
 *
 * Dieselbe Ansicht muss für jemanden ohne Vorwissen lesbar sein und für
 * jemanden vom Fach, ohne dass sich eine Seite falsch behandelt fühlt. Deshalb
 * bezeichnet `wording` eine Eigenschaft des TEXTES, nicht des Menschen davor —
 * so wie `gentle_mode` den Ton benennt und nicht die Person. Bezeichnungen wie
 * „Anfänger"/„Profi" sind bewusst ausgeschlossen: `docs/onboarding-life-situations.md`
 * hält fest, dass niemand freiwillig auf ein Etikett klickt, das ihm ein Defizit
 * zuschreibt.
 *
 * Die Achse ist orthogonal zu Relevanz (`enabled_nav_features`), Freischaltung
 * und Berechtigung (`docs/tutorial-progressive-disclosure.md`) — und zu
 * `gentle_mode`: wer vom Fach ist und in einer Schuldenkrise steckt, will
 * `technical` UND `gentle_mode`.
 */

export type Wording = 'everyday' | 'technical';

export const SUPPORTED_WORDINGS: Wording[] = ['everyday', 'technical'];

/**
 * Der Basisbaum in `translations.ts` IST dieses Register — für `technical`
 * wird deshalb nie ein Overlay konsultiert. Daraus folgt die prüfbare
 * Invariante: fehlt ein Overlay-Eintrag, ist der Basistext für beide Register
 * in Ordnung.
 */
export const BASE_WORDING: Wording = 'technical';

/**
 * Standard ist die Alltagssprache. Die Asymmetrie entscheidet: wer „Was gerade
 * verfügbar ist" liest, verliert eine Sekunde und kann umschalten — wer
 * „Liquidität" nicht kennt, verliert den Screen.
 *
 * Bewusst eine KONSTANTE und kein persistierter Vorgabewert: nur wer aktiv
 * wählt, bekommt einen gespeicherten Wert. Die Produktannahme bleibt damit
 * einzeilig umkehrbar, ohne Migration von Bestandsdaten.
 */
export const DEFAULT_WORDING: Wording = 'everyday';

/**
 * Eigener localStorage-Key, bewusst NICHT in den verschlüsselten
 * `UserSettings`: `getLocalUserSettings()` wirft bei gesperrtem Vault, aber
 * gerade Login-/Privacy-/Unlock-Screens haben die höchste Begriffsdichte
 * („Passphrase", „Wiederherstellungsschlüssel"). Zudem liest `serviceT`
 * synchron — in den verschlüsselten Speicher führt kein synchroner Pfad.
 * Gleiche Begründung wie bei `ausgabentracker_locale_v1`.
 */
export const WORDING_STORAGE_KEY = 'ausgabentracker_wording_v1';

export function isWording(value: string | null | undefined): value is Wording {
  return !!value && (SUPPORTED_WORDINGS as string[]).includes(value);
}

/**
 * Bestimmt den Start-Sprachstil: gespeicherte Wahl → Default.
 *
 * Bewusst OHNE Browser-Heuristik: für Finanzvorwissen gibt es kein Gegenstück
 * zu `navigator.language`, und jede Ableitung aus der Lebenssituation wäre
 * geraten. Die Vorbelegung aus dem Onboarding schreibt stattdessen explizit
 * hierher.
 */
export function resolveInitialWording(): Wording {
  if (typeof window === 'undefined') return DEFAULT_WORDING;
  const stored = window.localStorage.getItem(WORDING_STORAGE_KEY);
  return isWording(stored) ? stored : DEFAULT_WORDING;
}

/** Das jeweils andere Register — für „im Alltag:"/„fachlich:"-Gegenüberstellungen. */
export function otherWording(wording: Wording): Wording {
  return wording === 'everyday' ? 'technical' : 'everyday';
}
