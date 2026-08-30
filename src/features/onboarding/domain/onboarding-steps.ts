/**
 * Die Schrittmaschine des Einstiegs — rein, ohne React, ohne I/O (AGENTS.md §3).
 *
 * Sie ist die einzige Stelle, die weiss, in welcher Reihenfolge der Einstieg
 * läuft, welcher Schritt für welchen Weg entfällt und wo ein unterbrochener
 * Lauf wieder aufsetzt. Das ist kein Ordnungsprinzip, sondern die Bedingung
 * dafür, dass der Wiedereinstieg nach dem OAuth-Umweg überhaupt prüfbar ist:
 * Google verlässt die Seite vollständig und kommt zurück, jeder React-Zustand
 * ist dann weg. Was bleibt, ist der Entwurf im `localStorage` — und diese
 * Funktionen, die daraus denselben Schritt ableiten wie vor dem Sprung.
 */

import type { OnboardingDraft, OnboardingPath } from './onboarding-draft';

/**
 * Die Schritte in ihrer Reihenfolge. Die Kennungen sind zugleich die
 * URL-Segmente unter `/willkommen/…` — deutsch wie `/fragen`, damit die
 * Adresszeile dieselbe Sprache spricht wie die Oberfläche.
 */
export const ONBOARDING_STEPS = [
  'sprache',
  'weg',
  'anmeldung',
  'begruessung',
  'situation',
  'bereiche',
  'premium',
  'start',
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number];

/** Kontext, den die Maschine nicht selbst wissen kann. */
export interface OnboardingContext {
  /** Besteht eine Anmeldung? */
  authenticated: boolean;
  /**
   * Ist der Zugang schon geklärt — angemeldet ODER bewusst anonym gestartet?
   *
   * Trennt den Erstbesucher vom Bestandsnutzer, der den Einstieg nur teilweise
   * durchlaufen hat (etwa nach „Situation neu wählen" in den Einstellungen).
   * Für ihn sind Sprache und Weg entschiedene Tatsachen; ihn dort erneut
   * hindurchzuschicken wäre Gedächtnisverlust.
   */
  hasAccess: boolean;
}

export function isOnboardingStep(value: unknown): value is OnboardingStepId {
  return typeof value === 'string' && (ONBOARDING_STEPS as readonly string[]).includes(value);
}

/**
 * Die Schrittfolge für einen gewählten Weg.
 *
 * Wer anonym bleibt, bekommt keine Anmeldeseite. Solange der Weg noch nicht
 * gewählt ist, gilt die volle Folge — die Maschine darf nicht vorwegnehmen,
 * was der Nutzer noch entscheidet.
 */
export function stepsForPath(path: OnboardingPath | undefined): OnboardingStepId[] {
  if (path === 'anonymous') {
    return ONBOARDING_STEPS.filter((step) => step !== 'anmeldung');
  }
  return [...ONBOARDING_STEPS];
}

/** Der folgende Schritt, oder `null` am Ende des Flusses. */
export function nextStep(
  current: OnboardingStepId,
  path: OnboardingPath | undefined,
): OnboardingStepId | null {
  const steps = stepsForPath(path);
  const index = steps.indexOf(current);
  if (index < 0) return steps[0] ?? null;
  return steps[index + 1] ?? null;
}

/** Der vorangehende Schritt, oder `null` am Anfang. */
export function prevStep(
  current: OnboardingStepId,
  path: OnboardingPath | undefined,
): OnboardingStepId | null {
  const steps = stepsForPath(path);
  const index = steps.indexOf(current);
  if (index <= 0) return null;
  return steps[index - 1] ?? null;
}

/**
 * Der am weitesten fortgeschrittene Schritt, den der bisherige Entwurf trägt.
 *
 * Nicht dasselbe wie „der zuletzt gesehene Schritt": Wer den Weg noch nicht
 * gewählt hat, darf auch mit einem manipulierten Entwurf nicht auf der
 * Bereichsauswahl landen. Die Sperre sitzt hier und nicht in der Oberfläche,
 * weil die URL frei tippbar ist.
 */
function furthestAllowedStep(
  draft: OnboardingDraft,
  context: OnboardingContext,
): OnboardingStepId {
  // Wer schon in der App ist, hat Sprache und Weg hinter sich — unabhängig
  // davon, was im Entwurf steht (er kann fehlen, wenn der Einstieg vor diesem
  // Programmstand lief).
  if (context.hasAccess) return 'start';
  if (!draft.path) return 'weg';
  if (draft.path === 'account' && !context.authenticated) return 'anmeldung';
  return 'start';
}

/**
 * Wo ein Lauf OHNE Entwurf beginnt.
 *
 * Für den Erstbesucher die Sprachwahl. Für jemanden, der schon in der App ist
 * (nach „Situation neu wählen" in den Einstellungen), die Lebenssituation —
 * Sprache und Zugang sind für ihn entschiedene Tatsachen, und ihn danach
 * erneut zu fragen wäre Gedächtnisverlust.
 *
 * Die Regel gilt AUSDRÜCKLICH nur ohne Entwurf. Mit Entwurf wäre sie falsch:
 * Der anonyme Weg setzt `hasAccess` schon in Schritt 2, und eine untere
 * Schranke bei „situation" machte die Begrüßung unerreichbar — den Schritt
 * unmittelbar danach.
 */
export function firstRunStep(context: OnboardingContext): OnboardingStepId {
  return context.hasAccess ? 'situation' : 'sprache';
}

function stepRank(step: OnboardingStepId, path: OnboardingPath | undefined): number {
  const steps = stepsForPath(path);
  const index = steps.indexOf(step);
  return index < 0 ? 0 : index;
}

/**
 * Wo der Fluss (wieder) aufsetzt.
 *
 * Vier Fälle, die alle real vorkommen:
 * - **Bestandsnutzer ohne Lebenssituation** (nach „Situation neu wählen") →
 *   bei der Lebenssituation, nicht bei der Sprachwahl.
 * - **Kein Entwurf** → ganz vorn. Auch der Fall „Entwurf war unlesbar".
 * - **Rückkehr vom Anbieter** → der Entwurf steht auf `anmeldung`, die
 *   Anmeldung besteht jetzt. Dann geht es weiter, nicht von vorn.
 * - **Neuladen mitten im Fluss** → derselbe Schritt, gedeckelt durch das,
 *   was der Entwurf wirklich hergibt.
 */
export function resolveStartStep(
  draft: OnboardingDraft | null,
  context: OnboardingContext,
): OnboardingStepId {
  if (!draft) return firstRunStep(context);

  const grenze = furthestAllowedStep(draft, context);
  const steps = stepsForPath(draft.path);

  // Rückkehr vom Anbieter: der gespeicherte Schritt ist erledigt, sobald die
  // Anmeldung steht. Ohne diesen Zweig bliebe der Nutzer auf der Anmeldeseite
  // stehen, die er gerade erfolgreich durchlaufen hat.
  if (draft.step === 'anmeldung' && draft.path === 'account' && context.authenticated) {
    return nextStep('anmeldung', draft.path) ?? 'start';
  }

  const gewuenscht = stepRank(draft.step, draft.path);
  const erlaubt = stepRank(grenze, draft.path);
  return steps[Math.min(gewuenscht, erlaubt)] ?? 'sprache';
}
