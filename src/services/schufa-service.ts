// SCHUFA-Mut-Helfer: Geführte DSGVO-Auskunft (Art. 15, Issue #49, Epic #24).
//
// Aus der Schuldnerberatungs-Praxis: „Haben Sie mal eine SCHUFA-Auskunft geholt?"
// → „Nein, hab mich nicht getraut."
//
// Geführter Flow: Erklären → Erinnern → Erfassen

import {
  readLocalFinanceList,
  upsertLocalFinanceItem,
} from "./local-finance-store";

export interface SchufareminderState {
  id: string;
  user_id: string;
  /** ISO-Timestamp wann die Erinnerung gesetzt wurde. */
  requested_at: string;
  /** ISO-Timestamp wann ein Brief ankommen könnte (ca. 4 Wochen später). */
  expected_arrival: string;
  /** Hat der Nutzer bereits eine Auskunft gescannt? */
  scanned: boolean;
  created_at: string;
}

/**
 * DSGVO-Artikel 15 Erklärtext: Kostenlose Datenkopie, keine Score-Auswirkung.
 * Kurz, prägnant, RDG-konform (Information statt Beratung).
 */
export const SCHUFA_EXPLANATION = {
  headline: "Deine Daten bei der SCHUFA",
  text: "Du hast das Recht auf eine kostenlose Kopie deiner bei der SCHUFA gespeicherten Daten — das ist in der Datenschutzgrundverordnung (DSGVO, Artikel 15) verankert.",
  benefits: [
    "✓ Kostenlos",
    "✓ Beeinträchtigt deinen Score nicht",
    "✓ Zeigt dir, was die SCHUFA über dich speichert",
    "✓ Offenbart manchmal Fehler",
  ],
  warning:
    'Achtung: Vorsicht vor bezahlten "SCHUFA-Lösungen" im Internet — die machen das gleiche wie die kostenlose Auskunft!',
  cta: "Kostenlose Auskunft anfordern",
};

/**
 * Link zur offiziellen Bestellseite der SCHUFA.
 * Nur das, was die SCHUFA selbst anbietet.
 */
export const SCHUFA_REQUEST_URL =
  "https://www.schufa.de/auskuenfte/datenauskunft-nach-artikel-15-dsgvo/";

/**
 * Wenn der Nutzer die Erinnerung setzt, speichern wir diese Datum.
 * Nach ~4 Wochen: „Brief angekommen? Scanne ihn – wir sortieren das zusammen."
 */
export async function createSchufareminder(
  userId: string,
): Promise<SchufareminderState> {
  const now = new Date();
  const arrival = new Date(now.getTime() + 4 * 7 * 24 * 60 * 60 * 1000); // +4 Wochen

  const reminder: SchufareminderState = {
    id: crypto.randomUUID(),
    user_id: userId,
    requested_at: now.toISOString(),
    expected_arrival: arrival.toISOString(),
    scanned: false,
    created_at: now.toISOString(),
  };

  return upsertLocalFinanceItem<SchufareminderState>("schufareminders", reminder);
}

/**
 * Prüft ob eine Erinnerung fällig ist.
 * Rückgabe: true wenn expected_arrival überschritten wurde.
 */
export function isReminderDue(reminder: SchufareminderState): boolean {
  const now = new Date();
  const expectedArrival = new Date(reminder.expected_arrival);
  return now.getTime() >= expectedArrival.getTime();
}

/**
 * Markiert eine SCHUFA-Auskunft als eingescannt.
 */
export async function markSchufareminderScanned(
  reminderId: string,
): Promise<SchufareminderState> {
  return upsertLocalFinanceItem<SchufareminderState>("schufareminders", {
    id: reminderId,
    scanned: true,
  } as SchufareminderState);
}

/**
 * Holt die aktuelle Erinnerung des Nutzers (falls vorhanden).
 */
export async function getActiveSchufareminder(
  userId: string,
): Promise<SchufareminderState | null> {
  const reminders = await readLocalFinanceList<SchufareminderState>(
    "schufareminders",
  );
  const active = reminders.find((r) => r.user_id === userId && !r.scanned);
  return active ?? null;
}
