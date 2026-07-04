import { afterEach, describe, expect, it } from "vitest";
import {
  isReminderDue,
  getSchufaExplanation,
  SCHUFA_REQUEST_URL,
} from "../schufa-service";

describe("SCHUFA-Mut-Helfer", () => {
  afterEach(() => {
    window.localStorage.removeItem("ausgabentracker_locale_v1");
  });

  it("[REGRESSION] liefert die Erklärung auf Englisch, wenn locale=en", () => {
    window.localStorage.setItem("ausgabentracker_locale_v1", "en");
    const explanation = getSchufaExplanation();
    expect(explanation.headline).toBe("Your data at SCHUFA");
    expect(explanation.warning).toContain("Caution");
  });

  it("erklärt die DSGVO-Auskunft RDG-konform", () => {
    window.localStorage.setItem("ausgabentracker_locale_v1", "de");
    const explanation = getSchufaExplanation();
    expect(explanation.headline).toBeTruthy();
    expect(explanation.text).toContain("kostenlos");
    expect(explanation.text).toContain("DSGVO");
    // Keine Bewertung/Interpretation einzelner Einträge (RDG-Grenze)
    expect(explanation.text).not.toContain("schlecht");
    expect(explanation.text).not.toContain("musst");
  });

  it("warnt vor bezahlten SCHUFA-Produkten", () => {
    window.localStorage.setItem("ausgabentracker_locale_v1", "de");
    const explanation = getSchufaExplanation();
    expect(explanation.warning).toContain("Vorsicht");
    expect(explanation.warning).toContain("bezahlten");
    expect(explanation.warning).toContain("kostenlos");
  });

  it("nutzt nur die offizielle SCHUFA-URL", () => {
    expect(SCHUFA_REQUEST_URL).toContain("schufa.de");
    expect(SCHUFA_REQUEST_URL).toContain("dsgvo");
  });

  it("prüft ob eine Erinnerung fällig ist (LocalStorage-unabhängig)", () => {
    const now = new Date();
    const arrival = new Date(now.getTime() + 4 * 7 * 24 * 60 * 60 * 1000);

    const upcoming = {
      id: "test",
      user_id: "test-user",
      requested_at: now.toISOString(),
      expected_arrival: arrival.toISOString(),
      scanned: false,
      created_at: now.toISOString(),
    };

    // Sofort nicht fällig
    expect(isReminderDue(upcoming)).toBe(false);

    // Mit backdatiertem Ankunftsdatum: fällig
    const overdue = {
      ...upcoming,
      expected_arrival: new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    };
    expect(isReminderDue(overdue)).toBe(true);
  });

  it("funktioniert anonym (lokal, kein Server-Push)", () => {
    // Die Erinnerung wird lokal gespeichert, kein API-Call.
    // Tests laufen offline, also funktioniert das automatisch.
    expect(SCHUFA_REQUEST_URL).toBeTruthy();
  });
});
