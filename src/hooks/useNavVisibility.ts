import { useQuery } from '@tanstack/react-query';
import { getUserSettings } from '@/services/user-settings-service';
import type { NavFeatureId } from '@/lib/life-situations';

/**
 * Die beiden Achsen, aus denen sich die Nav-Sichtbarkeit ergibt: Relevanz
 * („passt das zu mir?") und Freischaltung („bin ich schon so weit?").
 *
 * Beide zusammen in einem Hook, damit sie nicht getrennt voneinander an
 * `getVisibleNavGroups` gereicht werden können — eine vergessene Achse an
 * einer von drei Aufrufstellen wäre sonst ein stiller Anzeigefehler.
 * `null` heißt in beiden Fällen „nicht in Gebrauch" ⇒ keine Einschränkung.
 */
export interface NavVisibility {
  enabled: NavFeatureId[] | null;
  unlocked: NavFeatureId[] | null;
}

/**
 * Auch während des Ladens werden bewusst zweimal `null` geliefert: lieber kurz
 * zu viel Navigation zeigen als eine Sekunde lang eine leere Seitenleiste.
 * Gemeinsamer Query-Key ['userSettings'] wie `useBusinessMode` — Einstellungen,
 * Onboarding und Tutorial invalidieren ihn, Nav und Palette ziehen sofort nach.
 */
export function useNavVisibility(): NavVisibility {
  const { data: settings } = useQuery({ queryKey: ['userSettings'], queryFn: getUserSettings });
  return {
    enabled: settings?.enabled_nav_features ?? null,
    unlocked: settings?.unlocked_features ?? null,
  };
}
