import { useQuery } from '@tanstack/react-query';
import { getUserSettings } from '@/services/user-settings-service';
import { isBusinessModeEnabled } from '@/lib/life-situations';

/**
 * Einzelunternehmer-Modus — **abgeleitet** aus der Bereichsauswahl
 * (`enabled_nav_features` enthält `euer`), nicht aus einem eigenen Flag.
 *
 * Damit gibt es genau eine Quelle für „EÜR an": die Navigation kann nicht
 * mehr von der rechnenden Logik (Steuer-Stufe im Wasserfall, EÜR-Kandidaten)
 * abweichen. Gemeinsamer Query-Key ['userSettings'] — Einstellungen und
 * Onboarding invalidieren ihn, alles zieht sofort nach.
 */
export function useBusinessMode(): boolean {
  const { data: settings } = useQuery({ queryKey: ['userSettings'], queryFn: getUserSettings });
  return isBusinessModeEnabled(settings?.enabled_nav_features);
}
