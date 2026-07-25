import { useQuery } from '@tanstack/react-query';
import { getUserSettings } from '@/services/user-settings-service';
import type { NavFeatureId } from '@/lib/life-situations';

/**
 * Die im Onboarding bestätigte Bereichsauswahl (steuert nur die
 * Nav-Sichtbarkeit). `null` heißt „keine Auswahl getroffen" — dann bleibt
 * alles sichtbar.
 *
 * Auch während des Ladens wird bewusst `null` geliefert: lieber kurz zu viel
 * Navigation zeigen als eine Sekunde lang eine leere Seitenleiste. Gemeinsamer
 * Query-Key ['userSettings'] wie `useBusinessMode` — Einstellungen und
 * Onboarding invalidieren ihn, Nav und Palette ziehen sofort nach.
 */
export function useNavFeatures(): NavFeatureId[] | null {
  const { data: settings } = useQuery({ queryKey: ['userSettings'], queryFn: getUserSettings });
  return settings?.enabled_nav_features ?? null;
}
