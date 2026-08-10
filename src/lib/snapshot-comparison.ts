/**
 * Die Form des Versionsvergleichs beim Geräte-Sync-Import (RES-4 / WP 1.4) —
 * reine Typen, kein I/O.
 *
 * **Warum hier und nicht im Service, wo sie entstanden sind.** Der
 * Bestätigungsdialog (`components/settings/SnapshotVersionConflictDialog`)
 * braucht dieselben Typen wie `snapshot-sync-service`. Ein `import type` aus
 * dem Service in die Komponente ist zwar richtungskonform (§3), zählt aber im
 * Ansicht/Daten-Wächter als Datenzugriff in der Darstellung — und genau daran
 * ist er auch aufgefallen. Die Tabelle „Wohin ein Typ gehört" in AGENTS.md §3
 * gibt die Antwort ohne Ermessensspielraum: *Typ, den Service **und**
 * Oberfläche brauchen ⇒ `src/lib/`.* Der Service speichert diese Form, er
 * besitzt sie nicht.
 */

/** Ein einzelner bekannter Stand (lokal oder aus der Datei) für den Versionsvergleich. */
export type SnapshotStandInfo = {
  version: number;
  /** `null`, wenn dieser Stand nicht bekannt ist (z. B. noch nie synchronisiert). */
  createdAt: string | null;
  deviceId: string | null;
};

export type SnapshotVersionComparison = {
  requiresConfirmation: boolean;
  /** Stammt die Datei von einem anderen physischen Gerät als diesem? */
  isForeignDevice: boolean;
  local: SnapshotStandInfo;
  remote: SnapshotStandInfo;
};
