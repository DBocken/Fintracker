/**
 * Den Einstieg von vorn beginnen.
 *
 * Gebraucht wird das zweimal: zum Ausprobieren des Flusses, und von einem
 * Nutzer, der die Einrichtung schlicht neu machen will.
 *
 * **Finanzdaten werden nicht angefasst.** Zurückgesetzt wird ausschliesslich,
 * was der Einstieg selbst beantwortet hat — Buchungen, Konten, Budgets und
 * Tutorial-Fortschritt bleiben unberührt. Das ist keine Feinheit, sondern der
 * Unterschied zwischen „Einrichtung neu" und „Daten löschen"; die Fläche sagt
 * es deshalb auch dazu.
 *
 * **Warum ein Entwurf geschrieben und nicht bloss gelöscht wird.** Ohne
 * Entwurf greift `firstRunStep`: Wer schon in der App ist, beginnt bei der
 * Lebenssituation, weil Sprache und Zugang für ihn entschiedene Tatsachen
 * sind. Genau das will hier aber niemand — der Fluss soll ganz vorn anfangen.
 * Ein Entwurf, der auf `sprache` steht, setzt die untere Schranke ausser
 * Kraft (siehe `resolveStartStep`), ohne dass es dafür eine zweite Regel
 * braucht.
 */

import { clearAnonymousMode } from '@/lib/anonymous-mode';
import { updateUserSettings } from '@/services/user-settings-service';
import { writeOnboardingDraft } from './onboarding-draft-store';

export async function restartOnboarding(): Promise<void> {
  // Der anonyme Merker fällt weg: Sonst bliebe die Wegwahl eine Frage ohne
  // Folgen — der Nutzer stünde schon in der App, während der Fluss ihn noch
  // fragt, ob er hinein möchte.
  clearAnonymousMode();
  writeOnboardingDraft({ step: 'sprache' });

  // `undefined` heisst „nie gefragt" — genau der Zustand, in dem der Einstieg
  // wieder greift. `null` wäre „gefragt und übersprungen" und liesse ihn aus.
  await updateUserSettings({
    onboarding_life_situation: undefined,
    onboarding_modifiers: undefined,
    display_name: undefined,
    tutorial_source: undefined,
  });
}

/**
 * Den Einstieg gezielt bei der ANMELDUNG aufsetzen.
 *
 * Der Altpfad `/login` leitet in den Fluss um. Ohne diesen Zwischenschritt
 * landete ein anonymer Nutzer dort bei der Lebenssituation: Er ist ja schon in
 * der App, also greift `firstRunStep`. Er wollte aber sich anmelden — und
 * bekäme eine Frage nach seiner Lebenssituation.
 *
 * Ein Entwurf, der auf `anmeldung` steht und den Konto-Weg trägt, führt ihn
 * genau dorthin; die Wegwahl davor ist damit beantwortet, ohne sie zu stellen.
 * Der anonyme Merker bleibt: Bricht er ab, ist er weiterhin drin.
 */
export function enterOnboardingAtSignIn(): void {
  writeOnboardingDraft({ step: 'anmeldung', path: 'account' });
}
