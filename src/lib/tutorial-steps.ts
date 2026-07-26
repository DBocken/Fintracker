/**
 * Die Schritte innerhalb der Tutorial-Kapitel — was eingerahmt und was dazu
 * gesagt wird (`docs/tutorial-sequence.md`, „Kapitelgröße").
 *
 * Zwei Regeln, die hier eingebaut sind und leicht verloren gehen:
 *
 * 1. **Kein Text im Code.** Titel und Erklärung kommen ausschließlich über
 *    Schlüssel, die sich mechanisch aus Kapitel- und Schritt-ID ergeben
 *    ({@link stepTitleKey}, {@link stepBodyKey}). Beschriftungen dürfen sich
 *    danach beliebig ändern, ohne dass diese Datei etwas davon merkt.
 * 2. **Der Anker ist ein Marker, kein Text.** `data-tour-id` statt „das
 *    Element mit der Aufschrift X" — sonst bricht jede Umbenennung die
 *    Führung still. Fehlt der Anker zur Laufzeit, wird der Schritt
 *    übersprungen und niemand blockiert.
 *
 * Reine Domänenschicht: kein React, kein DOM (AGENTS.md §3).
 */

import type { TutorialChapterId } from './tutorial-sequence';

export interface TutorialStep {
  /** Stabil; Teil des i18n-Schlüssels. Wird nie mit einer Beschriftung umbenannt. */
  id: string;
  /**
   * `data-tour-id` des Elements, das eingerahmt wird. Ohne Anker erscheint der
   * Schritt mittig — für Aussagen, die zu keinem einzelnen Element gehören.
   */
  anchor?: string;
  /** Route, auf der dieser Schritt spielt. Der Lauf navigiert vorher dorthin. */
  route?: string;
}

function step(id: string, route: string, anchor?: string): TutorialStep {
  return anchor ? { id, route, anchor } : { id, route };
}

/**
 * Schritte je Kapitel. Kapitel ohne Eintrag sind noch nicht ausformuliert und
 * werden im Lauf **übersprungen** — ein leeres Kapitel ist kein Fehler,
 * sondern noch nicht geschriebener Text.
 */
export const TUTORIAL_STEPS: Partial<Record<TutorialChapterId, readonly TutorialStep[]>> = {
  transactions: [
    step('list', '/transactions', 'transactions-list'),
    step('check', '/transactions', 'transactions-list'),
  ],
  categories: [
    step('why', '/transactions', 'transactions-list'),
    step('assign', '/transactions', 'transactions-list'),
  ],
  dashboard: [
    step('flow', '/dashboard', 'dashboard-flow'),
    step('period', '/dashboard', 'dashboard-flow'),
  ],
  city: [
    step('arrival', '/city', 'city-canvas'),
    step('districts', '/city', 'city-canvas'),
    step('growth', '/city', 'city-canvas'),
  ],
};

export function stepsFor(chapter: TutorialChapterId): readonly TutorialStep[] {
  return TUTORIAL_STEPS[chapter] ?? [];
}

/** Kapitel, für die es schon Text gibt — in der Reihenfolge des Lehrplans. */
export function hasSteps(chapter: TutorialChapterId): boolean {
  return stepsFor(chapter).length > 0;
}

export function stepTitleKey(chapter: TutorialChapterId, step: TutorialStep): string {
  return `tutorial.${chapter}.${step.id}.title`;
}

export function stepBodyKey(chapter: TutorialChapterId, step: TutorialStep): string {
  return `tutorial.${chapter}.${step.id}.body`;
}

/** CSS-Selektor zu einem Anker. Eine Stelle, damit das Attribut nie driftet. */
export function anchorSelector(anchor: string): string {
  return `[data-tour-id="${anchor}"]`;
}
