import type { TranslationOverlay } from '../types';

/**
 * Alltagssprache (Deutsch). Nur Abweichungen vom Basisbaum — alles, was hier
 * fehlt, kommt unverändert aus `translations.ts`.
 *
 * Faustregeln beim Ergänzen:
 * - Beschreiben, nicht verniedlichen. „Was gerade verfügbar ist" statt
 *   „Dein Geldtopf".
 * - Lieber ungenau-kurz als falsch-einfach: „Liquidität = dein Kontostand"
 *   wäre schlimmer als der Fachbegriff, weil es genau der Person etwas
 *   Unwahres beibringt, die den Fehler nicht bemerken kann.
 * - Labels (Navigation, KPI-Kacheln, Chart-Legenden) auf ~4 Wörter deckeln —
 *   sie stehen in breitenbegrenzten Flächen.
 * - Platzhalter (`{amount}`, `{days}`) müssen exakt dieselben bleiben wie im
 *   Basistext; `replaceTemplate` ersetzt Unbekanntes still durch "".
 * - Im Schulden-Namespace gelten zusätzlich die RDG-Regeln aus
 *   `docs/RDG_TEXTREGELN.md`: „kann/können" statt „ist/musst", und jede
 *   Rechtsaussage endet mit dem Verweis auf die kostenlose Schuldnerberatung.
 */
export const everydayDe: TranslationOverlay = {};
