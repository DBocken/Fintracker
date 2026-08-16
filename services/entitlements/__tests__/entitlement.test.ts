import { describe, expect, it } from "vitest";
import {
  GRACE_DAYS,
  extendAfterPayment,
  isActive,
  type Entitlement,
} from "../src/domain/entitlement.js";

const tag = (n: number) => n * 24 * 60 * 60 * 1000;

function eintrag(validUntil: Date): Entitlement {
  return {
    userId: "user-a",
    product: "premium_monthly",
    validUntil,
    source: "mollie",
  };
}

/**
 * Die Datumsrechnung des Abos.
 *
 * Der Kern ist die Kulanzfrist — und sie ist **Notwendigkeit, nicht
 * Grosszuegigkeit**: Mollie wiederholt fehlgeschlagene Abbuchungen ueber
 * mehrere Tage. Ohne Puffer sperrt sich ein zahlender Nutzer mitten im
 * Wiederholungsfenster selbst aus.
 *
 * Die zweite Eigenschaft ist unscheinbar und wichtiger: Die Kulanz darf sich
 * **nicht aufsummieren**. Wer zwoelf Monate zahlt, hat sonst am Ende zwei
 * Monate geschenkt bekommen.
 */
describe("extendAfterPayment", () => {
  it("sollte bei der ersten Zahlung eine Periode plus Kulanz gewaehren", () => {
    const jetzt = new Date("2026-01-01T00:00:00Z");

    const bis = extendAfterPayment(null, jetzt);

    // 1 Monat ab jetzt, plus Kulanz
    expect(bis.getTime()).toBe(new Date("2026-02-01T00:00:00Z").getTime() + tag(GRACE_DAYS));
  });

  it("[REGRESSION] sollte die Kulanz NICHT aufsummieren", () => {
    // Der eigentliche Fehler, gegen den dieser Test steht: Wer naiv
    // `validUntil + Periode + Kulanz` rechnet, schenkt bei jeder Verlaengerung
    // eine weitere Kulanzfrist. Nach zwoelf Monaten waeren das zwei Monate
    // gratis — lautlos, und niemand sucht danach.
    const start = new Date("2026-01-01T00:00:00Z");
    let bis = extendAfterPayment(null, start);

    // Zweite Zahlung faellig zum Periodenende (ohne Kulanz gerechnet)
    const zweiteZahlung = new Date("2026-02-01T00:00:00Z");
    bis = extendAfterPayment(eintrag(bis), zweiteZahlung);

    expect(bis.getTime()).toBe(new Date("2026-03-01T00:00:00Z").getTime() + tag(GRACE_DAYS));
  });

  it("sollte ab dem bezahlten Periodenende verlaengern, nicht ab jetzt", () => {
    // Zahlung kommt frueh (Mollie bucht am 28.), das Abo laeuft bis zum 1.
    const bestehend = eintrag(new Date(new Date("2026-02-01T00:00:00Z").getTime() + tag(GRACE_DAYS)));

    const bis = extendAfterPayment(bestehend, new Date("2026-01-28T00:00:00Z"));

    // Verlaengert wird ab dem 1.2. (Periodenende), nicht ab dem 28.1.
    expect(bis.getTime()).toBe(new Date("2026-03-01T00:00:00Z").getTime() + tag(GRACE_DAYS));
  });

  it("sollte ab jetzt verlaengern, wenn das Abo laengst abgelaufen ist", () => {
    // Wiedereintritt nach Pause: Der alte Zeitraum ist verfallen, es waere
    // falsch, ihn nachtraeglich gutzuschreiben.
    const bestehend = eintrag(new Date("2025-06-01T00:00:00Z"));

    const bis = extendAfterPayment(bestehend, new Date("2026-01-01T00:00:00Z"));

    expect(bis.getTime()).toBe(new Date("2026-02-01T00:00:00Z").getTime() + tag(GRACE_DAYS));
  });
});

describe("isActive", () => {
  it("sollte innerhalb der Gueltigkeit aktiv sein", () => {
    expect(isActive(eintrag(new Date("2026-02-01T00:00:00Z")), new Date("2026-01-15T00:00:00Z"))).toBe(true);
  });

  it("sollte nach Ablauf nicht mehr aktiv sein", () => {
    expect(isActive(eintrag(new Date("2026-01-01T00:00:00Z")), new Date("2026-01-02T00:00:00Z"))).toBe(false);
  });

  it("sollte ohne Eintrag nicht aktiv sein", () => {
    expect(isActive(null, new Date("2026-01-02T00:00:00Z"))).toBe(false);
  });
});
