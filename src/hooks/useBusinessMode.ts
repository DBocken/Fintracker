import { useQuery } from '@tanstack/react-query';
import { getUserSettings } from '@/services/user-settings-service';

/**
 * Einzelunternehmer-Modus (Opt-in, Default aus). Gemeinsamer Query-Key
 * ['userSettings'] — der Settings-Toggle invalidiert ihn, Nav/Palette ziehen
 * sofort nach.
 */
export function useBusinessMode(): boolean {
  const { data: settings } = useQuery({ queryKey: ['userSettings'], queryFn: getUserSettings });
  return Boolean(settings?.business_mode);
}
