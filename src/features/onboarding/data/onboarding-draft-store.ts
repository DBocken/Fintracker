/**
 * Ablage des Einstiegs-Entwurfs im `localStorage`.
 *
 * Bewusst NICHT im verschlüsselten Einstellungsspeicher: Die ersten Schritte
 * laufen, bevor es eine Identität und einen offenen Tresor gibt (siehe
 * `../domain/onboarding-draft.ts`). Bewusst auch nicht im React-Zustand: der
 * OAuth-Umweg verlässt die Seite vollständig.
 *
 * Gelesen wird über die zod-Grenze — was hier zurückkommt, hat niemand
 * zugesichert. Ein unlesbarer Entwurf ist `null` und damit ein Neustart des
 * Flusses, kein Fehlerzustand: Es gibt nichts zu verlieren ausser ein paar
 * Klicks, und eine Fehlermeldung über einen kaputten Entwurf wäre für den
 * Nutzer bedeutungslos.
 */

import { safeParseAtBoundary } from '@/lib/schemas';
import {
  onboardingDraftSchema,
  type OnboardingDraft,
} from '../domain/onboarding-draft';

export const ONBOARDING_DRAFT_KEY = 'ausgabentracker_onboarding_draft_v1';

/** Der gespeicherte Entwurf, oder `null` (nicht vorhanden/unlesbar/ungültig). */
export function readOnboardingDraft(): OnboardingDraft | null {
  if (typeof window === 'undefined') return null;
  let roh: string | null;
  try {
    roh = window.localStorage.getItem(ONBOARDING_DRAFT_KEY);
  } catch {
    // Privater Modus, gesperrter Speicher — der Fluss läuft dann ohne
    // Wiederaufnahme weiter, statt gar nicht zu laufen.
    return null;
  }
  if (!roh) return null;

  let geparst: unknown;
  try {
    geparst = JSON.parse(roh);
  } catch {
    return null;
  }

  const ergebnis = safeParseAtBoundary(onboardingDraftSchema, geparst, 'onboarding-draft');
  return ergebnis.ok ? ergebnis.data : null;
}

/** Schreibt den Entwurf. Schlägt das fehl, läuft der Fluss trotzdem weiter. */
export function writeOnboardingDraft(draft: OnboardingDraft): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // s. o. — ein nicht schreibbarer Speicher kostet die Wiederaufnahme,
    // nicht den Einstieg.
  }
}

/** Räumt den Entwurf ab. Wird nach dem Commit in die Einstellungen gerufen. */
export function clearOnboardingDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(ONBOARDING_DRAFT_KEY);
  } catch {
    // Nichts zu tun: der nächste Lauf überschreibt ihn ohnehin.
  }
}
