/**
 * Übernahme des Entwurfs in die Einstellungen — der einzige Schreibvorgang des
 * ganzen Einstiegs.
 *
 * **Warum in EINEM Zug.** `updateUserSettings` liest den Bestand, ergänzt ihn
 * und schreibt ihn zurück; dazwischen liegt ein echtes `await` (IndexedDB,
 * AES-GCM). Acht Einzelschreibungen kurz hintereinander setzen deshalb
 * aufeinander auf, bevor der jeweils vorige durch ist — genau der Befund, den
 * `e2e-tests/fixtures/vertical-slice.ts` schon einmal an zwei Dialogen
 * dokumentiert hat, die beide „Später entscheiden" schrieben. Ein Aufruf mit
 * dem vollständigen Ergebnis kann das nicht.
 */

import { resolveFeatureSelection } from '@/lib/life-situations';
import type { TutorialSource } from '@/lib/tutorial-sequence';
import { updateUserSettings } from '@/services/user-settings-service';
import type { UserSettings } from '@/types';
import type { OnboardingDraft } from '../domain/onboarding-draft';

export interface OnboardingCommitInput {
  draft: OnboardingDraft;
  /** In Schritt 8 gewählter Weg zu den Daten; `null` = übersprungen. */
  source: TutorialSource | null;
}

/**
 * Baut den Einstellungs-Patch. Rein und ohne I/O, damit die Zuordnung
 * Entwurf → Einstellungen ohne Speicher prüfbar ist.
 *
 * `onboarding_life_situation` bekommt `null` statt `undefined`, wenn die
 * Situation übersprungen wurde: `undefined` hiesse „nie gefragt", und dann
 * stünde der Einstieg beim nächsten Start wieder da (dieselbe Unterscheidung
 * wie bisher in `settings-types.ts`).
 */
export function buildOnboardingSettings({
  draft,
  source,
}: OnboardingCommitInput): Partial<UserSettings> {
  const situation = draft.lifeSituation ?? null;
  const modifiers = draft.modifiers ?? [];
  const vorschlag = situation ? resolveFeatureSelection(situation, modifiers) : null;

  return {
    onboarding_life_situation: situation,
    onboarding_modifiers: modifiers,
    // Ohne Lebenssituation bleibt die Navigation vollständig (`null`) — das
    // Onboarding darf Sichtbarkeit einschränken, niemals Zugriff.
    enabled_nav_features: draft.features ?? vorschlag?.features ?? null,
    display_name: draft.displayName?.trim() || null,
    tutorial_source: source,
    ...(vorschlag?.settings ?? {}),
  };
}

/** Schreibt den Patch. Ein Aufruf, ein Schreibvorgang. */
export async function commitOnboarding(input: OnboardingCommitInput): Promise<UserSettings> {
  return updateUserSettings(buildOnboardingSettings(input));
}
