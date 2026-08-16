/**
 * Ist ein Zahlungsweg eingerichtet? (WP 6.3)
 *
 * Bewusst in `lib/` und nicht im Service: Die Funktion liest eine
 * Build-Konfiguration und macht **kein I/O** — sie gehört damit auf dieselbe
 * Höhe wie `money.ts` (AGENTS.md §3, „Reine Funktion ohne I/O"). Läge sie im
 * Service, müsste jede Fläche, die nur wissen will, ob es etwas zu kaufen
 * gibt, einen I/O-Service importieren; `check:view-data` zählt genau das —
 * und zu Recht.
 */

/** Basisadresse des EntitlementService, oder `undefined` ohne Konfiguration. */
export function entitlementBaseUrl(): string | undefined {
  const konfiguriert = import.meta.env.VITE_ENTITLEMENT_BASE_URL;
  return typeof konfiguriert === "string" && konfiguriert.length > 0 ? konfiguriert : undefined;
}

/**
 * Ohne hinterlegten Dienst gibt es nichts zu kaufen — und nichts zu fragen.
 * Der heutige Normalfall, solange der EU-Host aus WP 3.2 fehlt.
 */
export function isBillingConfigured(): boolean {
  return entitlementBaseUrl() !== undefined;
}
