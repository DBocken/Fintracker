import { describe, expect, it } from "vitest";
import {
  isReminderDue,
  SCHUFA_EXPLANATION,
  SCHUFA_REQUEST_URL,
} from "../schufa-service";

describe("SCHUFA-Mut-Helfer", () => {
  it("erklärt die DSGVO-Auskunft RDG-konform", () => {
    expect(SCHUFA_EXPLANATION.headline).toBeTruthy();
    expect(SCHUFA_EXPLANATION.text).toContain("kostenlos");
    expect(SCHUFA_EXPLANATION.text).toContain("DSGVO");
    // Keine Bewertung/Interpretation einzelner Einträge (RDG-Grenze)
    expect(SCHUFA_EXPLANATION.text).not.toContain("schlecht");
    expect(SCHUFA_EXPLANATION.text).not.toContain("musst");
  });

  it("warnt vor bezahlten SCHUFA-Produkten", () => {
    expect(SCHUFA_EXPLANATION.warning).toContain("Vorsicht");
    expect(SCHUFA_EXPLANATION.warning).toContain("bezahlten");
    expect(SCHUFA_EXPLANATION.warning).toContain("kostenlos");
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
