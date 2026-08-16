import { describe, expect, it } from "vitest";
import {
  displayNameFromIdentity,
  identityFromSubject,
  userIdFromSubject,
  type Identity,
} from "../identity";

/**
 * Die App kennt eine eigene Identität (WP 2.1).
 *
 * Der Kern der Tests ist nicht die Umrechnung — die ist heute 1:1 — sondern
 * die Naht: Ab hier gibt es EINE Stelle, an der aus einem IdP-Subject eine
 * interne userId wird. Wechselt der Issuer (Phase 7), ändert sich diese
 * Funktion; die Entitlements aus Phase 6 hängen weiter an derselben Kennung.
 */

describe("userIdFromSubject", () => {
  it("sollte das Subject heute unverändert übernehmen (1:1 Supabase-UUID)", () => {
    expect(userIdFromSubject("6f1c8f3e-1c4a-4b7e-9a2d-000000000001")).toBe(
      "6f1c8f3e-1c4a-4b7e-9a2d-000000000001",
    );
  });

  it("sollte umschließende Leerzeichen entfernen", () => {
    expect(userIdFromSubject("  abc-123  ")).toBe("abc-123");
  });

  it("sollte ein leeres Subject als 'keine Identität' behandeln", () => {
    expect(userIdFromSubject("")).toBeNull();
    expect(userIdFromSubject("   ")).toBeNull();
  });
});

describe("identityFromSubject", () => {
  it("sollte aus Subject, E-Mail und Claims eine Identität bauen", () => {
    const identity = identityFromSubject({
      subject: "user-1",
      email: "tester@example.com",
      claims: { full_name: "Test Tester" },
    });

    expect(identity).toEqual({
      userId: "user-1",
      email: "tester@example.com",
      claims: { full_name: "Test Tester" },
    });
  });

  it("sollte ohne Subject null liefern — eine Identität ohne Kennung gibt es nicht", () => {
    expect(identityFromSubject({ subject: "" })).toBeNull();
    expect(identityFromSubject({ subject: null })).toBeNull();
    expect(identityFromSubject({ subject: undefined })).toBeNull();
  });

  it("sollte fehlende E-Mail und Claims verkraften", () => {
    expect(identityFromSubject({ subject: "user-1" })).toEqual({
      userId: "user-1",
      email: undefined,
      claims: {},
    });
  });
});

describe("displayNameFromIdentity", () => {
  const mit = (claims: Record<string, unknown>, email?: string): Identity => ({
    userId: "user-1",
    email,
    claims,
  });

  it("sollte full_name vor name und E-Mail bevorzugen", () => {
    expect(
      displayNameFromIdentity(mit({ full_name: "Voller Name", name: "Kurz" }, "a@example.com")),
    ).toBe("Voller Name");
  });

  it("sollte auf name zurückfallen, wenn full_name fehlt", () => {
    expect(displayNameFromIdentity(mit({ name: "Kurz" }, "a@example.com"))).toBe("Kurz");
  });

  it("sollte auf die E-Mail zurückfallen, wenn kein Name da ist", () => {
    expect(displayNameFromIdentity(mit({}, "a@example.com"))).toBe("a@example.com");
  });

  it("sollte null liefern, wenn nichts Anzeigbares da ist — der Aufrufer setzt den übersetzten Ersatz", () => {
    // Der Ersatztext ist Bildschirmtext und gehört über t() in die Komponente,
    // nicht in eine lib-Funktion ohne React-Kontext (§6).
    expect(displayNameFromIdentity(mit({}))).toBeNull();
    expect(displayNameFromIdentity(null)).toBeNull();
  });

  it("sollte Claims ignorieren, die keine nutzbare Zeichenkette sind", () => {
    // Ersetzt die bisherigen `as string`-Zusicherungen an den Aufrufstellen:
    // Claims kommen von aussen, ihre Form ist nicht zugesichert.
    expect(displayNameFromIdentity(mit({ full_name: 42, name: null }, "a@example.com"))).toBe(
      "a@example.com",
    );
    expect(displayNameFromIdentity(mit({ full_name: "   " }, "a@example.com"))).toBe(
      "a@example.com",
    );
  });
});
