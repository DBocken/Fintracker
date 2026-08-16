import { beforeEach, describe, expect, it } from "vitest";
import { handleWebhook } from "../src/domain/handle-webhook.js";
import type { Entitlement } from "../src/domain/entitlement.js";
import type { MolliePayment } from "../src/domain/mollie.js";
import type { EntitlementRepository, MollieGateway, ProcessedEventStore } from "../src/ports.js";

const JETZT = new Date("2026-01-01T00:00:00Z");

function zahlung(overrides: Partial<MolliePayment> = {}): MolliePayment {
  return {
    id: "tr_1",
    status: "paid",
    sequenceType: "first",
    customerId: "cst_1",
    metadata: { userId: "user-a", product: "premium_monthly" },
    ...overrides,
  };
}

/** Zählt Schreibvorgänge mit — die Idempotenz misst genau das. */
function speicher() {
  const zeilen = new Map<string, Entitlement>();
  let schreibvorgaenge = 0;
  const repo: EntitlementRepository = {
    async find(userId) {
      return zeilen.get(userId) ?? null;
    },
    async upsert(e) {
      schreibvorgaenge += 1;
      zeilen.set(e.userId, e);
    },
  };
  return { repo, zeilen, anzahlSchreibvorgaenge: () => schreibvorgaenge };
}

function ereignisse(): ProcessedEventStore {
  const gesehen = new Set<string>();
  return {
    async seen(id, status) {
      return gesehen.has(`${id}:${status}`);
    },
    async remember(id, status) {
      gesehen.add(`${id}:${status}`);
    },
  };
}

function gateway(payment: MolliePayment | null): MollieGateway & { abrufe: number } {
  return {
    abrufe: 0,
    async getPayment(id) {
      this.abrufe += 1;
      return payment && payment.id === id ? payment : null;
    },
    async ensureSubscription() {
      return { subscriptionId: "sub_1" };
    },
  };
}

describe("[SECURITY] handleWebhook — dem Rumpf wird nicht geglaubt", () => {
  it("sollte eine unbekannte Payment-ID ablehnen, ohne zu schreiben", () => {
    // Wer den Webhook faelscht, kann eine ID BEHAUPTEN. Kennt Mollie sie
    // nicht, ist der Vorgang zu Ende — und zwar ohne Seiteneffekt.
    const s = speicher();

    return handleWebhook(
      { paymentId: "tr_erfunden" },
      { repo: s.repo, events: ereignisse(), mollie: gateway(zahlung()), now: JETZT },
    ).then((ergebnis) => {
      expect(ergebnis.outcome).toBe("unknown-payment");
      expect(s.anzahlSchreibvorgaenge()).toBe(0);
    });
  });

  it("sollte den Status ausschliesslich von Mollie beziehen, nie aus dem Aufruf", async () => {
    // Der Angriff: Der Webhook-Rumpf behauptet "paid", Mollie sagt "failed".
    // Massgeblich ist Mollie — sonst reicht ein gefaelschter POST fuer ein Abo.
    const s = speicher();

    const ergebnis = await handleWebhook(
      { paymentId: "tr_1", status: "paid" },
      {
        repo: s.repo,
        events: ereignisse(),
        mollie: gateway(zahlung({ status: "failed" })),
        now: JETZT,
      },
    );

    expect(ergebnis.outcome).toBe("not-paid");
    expect(s.anzahlSchreibvorgaenge()).toBe(0);
    expect(await s.repo.find("user-a")).toBeNull();
  });

  it("sollte eine Zahlung ohne Zuordnung ablehnen", async () => {
    // Ohne `metadata.userId` gibt es keinen Nutzer, dem die Zahlung gehoert.
    // Raten waere hier der Fehler.
    const s = speicher();

    const ergebnis = await handleWebhook(
      { paymentId: "tr_1" },
      {
        repo: s.repo,
        events: ereignisse(),
        mollie: gateway(zahlung({ metadata: null })),
        now: JETZT,
      },
    );

    expect(ergebnis.outcome).toBe("no-owner");
    expect(s.anzahlSchreibvorgaenge()).toBe(0);
  });
});

describe("[SECURITY] handleWebhook — Idempotenz", () => {
  it("sollte bei dreifacher Zustellung genau EINMAL schreiben", async () => {
    // Mollie stellt bei Zeitueberschreitung erneut zu. Ohne Dedupe verlaengert
    // jede Wiederholung das Abo weiter — der Nutzer bekaeme drei Monate fuer
    // eine Zahlung, und es faellt niemandem auf.
    const s = speicher();
    const ev = ereignisse();
    const gw = gateway(zahlung());

    for (let i = 0; i < 3; i += 1) {
      await handleWebhook({ paymentId: "tr_1" }, { repo: s.repo, events: ev, mollie: gw, now: JETZT });
    }

    expect(s.anzahlSchreibvorgaenge()).toBe(1);
  });

  it("sollte einen NEUEN Status derselben Zahlung weiterhin verarbeiten", async () => {
    // Der Dedupe-Schluessel ist (id, status), nicht die id allein: Eine Zahlung
    // durchlaeuft mehrere Zustaende, jeder loest einen eigenen Webhook aus.
    const s = speicher();
    const ev = ereignisse();

    await handleWebhook(
      { paymentId: "tr_1" },
      { repo: s.repo, events: ev, mollie: gateway(zahlung({ status: "open" })), now: JETZT },
    );
    const ergebnis = await handleWebhook(
      { paymentId: "tr_1" },
      { repo: s.repo, events: ev, mollie: gateway(zahlung({ status: "paid" })), now: JETZT },
    );

    expect(ergebnis.outcome).toBe("extended");
    expect(s.anzahlSchreibvorgaenge()).toBe(1);
  });
});

describe("handleWebhook — Statuswirkung", () => {
  let s: ReturnType<typeof speicher>;
  beforeEach(() => {
    s = speicher();
  });

  it("sollte bei 'paid' die Berechtigung anlegen und die Quelle auf mollie setzen", async () => {
    const ergebnis = await handleWebhook(
      { paymentId: "tr_1" },
      { repo: s.repo, events: ereignisse(), mollie: gateway(zahlung()), now: JETZT },
    );

    expect(ergebnis.outcome).toBe("extended");
    const eintrag = await s.repo.find("user-a");
    expect(eintrag?.source).toBe("mollie");
    expect(eintrag?.product).toBe("premium_monthly");
    expect(eintrag!.validUntil.getTime()).toBeGreaterThan(JETZT.getTime());
  });

  for (const status of ["canceled", "expired", "failed"] as const) {
    it(`sollte bei '${status}' NICHT verlaengern`, async () => {
      // Kein aktiver Widerruf: Die Berechtigung laeuft von selbst aus. Das ist
      // die einfachere und die richtige Antwort — eine Ruecknahme mitten im
      // bezahlten Zeitraum waere ein Rueckabwicklungsproblem.
      const ergebnis = await handleWebhook(
        { paymentId: "tr_1" },
        { repo: s.repo, events: ereignisse(), mollie: gateway(zahlung({ status })), now: JETZT },
      );

      expect(ergebnis.outcome).toBe("not-paid");
      expect(s.anzahlSchreibvorgaenge()).toBe(0);
    });
  }

  it("sollte bei sequenceType 'first' ein Mandat in ein Abo ueberfuehren", async () => {
    const ergebnis = await handleWebhook(
      { paymentId: "tr_1" },
      { repo: s.repo, events: ereignisse(), mollie: gateway(zahlung({ sequenceType: "first" })), now: JETZT },
    );

    expect(ergebnis.outcome).toBe("extended");
    expect((await s.repo.find("user-a"))?.mollieSubscriptionId).toBe("sub_1");
  });

  it("sollte bei einer Folgezahlung kein zweites Abo anlegen", async () => {
    const gw = gateway(zahlung({ sequenceType: "recurring", subscriptionId: "sub_bestehend" }));

    await handleWebhook({ paymentId: "tr_1" }, { repo: s.repo, events: ereignisse(), mollie: gw, now: JETZT });

    expect((await s.repo.find("user-a"))?.mollieSubscriptionId).toBe("sub_bestehend");
  });
});

describe("[SECURITY] handleWebhook — Nutzer-Isolation", () => {
  it("sollte ausschliesslich den Nutzer aus der Mollie-Zuordnung beruehren", async () => {
    // Messlatte aus Issue #298: Nutzer B darf durch einen Vorgang von A weder
    // gelesen noch veraendert werden.
    const s = speicher();
    await s.repo.upsert({
      userId: "user-b",
      product: "premium_monthly",
      validUntil: new Date("2026-06-01T00:00:00Z"),
      source: "mollie",
    });
    const vorher = await s.repo.find("user-b");

    await handleWebhook(
      { paymentId: "tr_1" },
      { repo: s.repo, events: ereignisse(), mollie: gateway(zahlung()), now: JETZT },
    );

    expect(await s.repo.find("user-b")).toEqual(vorher);
    expect(await s.repo.find("user-a")).not.toBeNull();
  });
});
