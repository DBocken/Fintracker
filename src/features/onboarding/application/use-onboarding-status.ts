/**
 * Die eine Frage, die über den Einstieg entscheidet: Ist er durch?
 *
 * Zwei Bedingungen, und beide sind nötig:
 * - **Zugang geklärt** — angemeldet oder bewusst anonym gestartet. Ohne das
 *   gibt es keine Identität und keinen lesbaren Einstellungsspeicher.
 * - **Lebenssituation beantwortet** — `undefined` heisst „nie gefragt",
 *   `null` heisst „gefragt und übersprungen". Bestandsnutzer, die die
 *   abgelösten Dialoge schon gesehen haben, tragen eines von beidem und
 *   sehen den Einstieg deshalb nie.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { hasStartedAnonymousMode } from '@/lib/anonymous-mode';
import { getUserSettings } from '@/services/user-settings-service';

export interface OnboardingStatus {
  /** Noch nicht entschieden — nichts rendern, sonst blitzt es auf. */
  loading: boolean;
  /** Muss der Nutzer durch den Einstieg? */
  required: boolean;
}

export function useOnboardingStatus(): OnboardingStatus {
  const { status } = useAuth();
  const hasAccess = status === 'authenticated' || hasStartedAnonymousMode();

  const { data, isPending, isError } = useQuery({
    queryKey: ['userSettings'],
    queryFn: getUserSettings,
    enabled: hasAccess,
  });

  if (!hasAccess) return { loading: status === 'loading', required: true };
  // Ein Lesefehler darf den Nutzer NICHT in den Einstieg zurückwerfen: Er
  // wäre die zweite falsche Auskunft nach der ersten (die Fläche würde
  // behaupten, er sei neu). Die Fläche dahinter zeigt ihren eigenen
  // Fehlerzustand.
  if (isError) return { loading: false, required: false };
  if (isPending) return { loading: true, required: false };

  return { loading: false, required: data.onboarding_life_situation === undefined };
}
