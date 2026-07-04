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
import { t } from "../i18n/serviceT";

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
export function getSchufaExplanation() {
  return {
    headline: t("debts.schufaCard.headline"),
    text: t("debts.schufaCard.explanationText"),
    benefits: [
      t("debts.schufaCard.benefitFree"),
      t("debts.schufaCard.benefitNoScoreImpact"),
      t("debts.schufaCard.benefitShowsData"),
      t("debts.schufaCard.benefitRevealsErrors"),
    ],
    warning: t("debts.schufaCard.warning"),
    cta: t("debts.schufaCard.cta"),
  };
}

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
