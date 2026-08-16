"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/providers/AuthProvider";
import { fetchSubscription } from "@/services/entitlement-service";
import { isBillingConfigured } from "@/lib/billing-config";
import { billingQueryKeys } from "@/features/billing/data/billing-query-keys";
import { entitlementTier, type SubscriptionState } from "@/features/billing/domain/subscription";

/**
 * Serverseitiger Abo-Status als **app-weite** Auskunft (WP 6.3).
 *
 * Bewusst in `src/hooks/` und nicht in der Billing-Slice: Das Entitlement
 * gattert *jedes* Feature (`useTier` → `FeatureGate` → alle Flächen), es ist
 * also Infrastruktur wie die Anmeldung. Die Slice besitzt den **Kauf**, nicht
 * die Berechtigung — läge die Abfrage dort, müsste `useTier` eine Slice
 * importieren, um zu wissen, was ein Nutzer darf.
 *
 * Die Billing-Oberfläche benutzt denselben Hook; TanStack Query führt bei
 * gleichem Schlüssel nur **eine** Abfrage.
 */
export interface ServerEntitlement {
  state: SubscriptionState;
  /** Urteil für `deriveTier`; `undefined` heisst „kein Urteil". */
  tier: "premium" | "free" | undefined;
  isLoading: boolean;
  /** Der Dienst war nicht erreichbar — ausdrücklich NICHT „kein Abo". */
  isError: boolean;
  /** Kein Dienst hinterlegt: Es gibt (noch) nichts zu kaufen. */
  isConfigured: boolean;
}

const UNBEKANNT: SubscriptionState = { status: "unknown" };

export function useServerEntitlement(): ServerEntitlement {
  const { identity, status } = useAuth();
  const konfiguriert = isBillingConfigured();
  const aktiv = konfiguriert && status === "authenticated";

  const abfrage = useQuery({
    queryKey: billingQueryKeys.subscription(identity?.userId ?? null),
    queryFn: fetchSubscription,
    enabled: aktiv,
    // Ein Abo ist eine widerrufbare Tatsache: Der Cache darf sie überbrücken,
    // aber nicht konservieren.
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Der Fehlerfall wird ausdrücklich behandelt (`check:query-errors`) — und
  // NICHT zu „kein Abo" gefaltet. „Ich weiss es nicht" als „du hast keins"
  // auszugeben, ist gegenüber einem zahlenden Nutzer die falsche Auskunft;
  // `deriveTier` würde daraufhin sogar den lokalen Override sperren.
  const state = abfrage.isError || !aktiv ? UNBEKANNT : (abfrage.data ?? UNBEKANNT);

  return {
    state,
    tier: entitlementTier(state),
    isLoading: aktiv && abfrage.isLoading,
    isError: abfrage.isError,
    isConfigured: konfiguriert,
  };
}
