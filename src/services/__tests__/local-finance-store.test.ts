import { describe, it, expect, beforeEach } from "vitest";
import {
  readLocalFinanceList,
  writeLocalFinanceList,
  upsertLocalFinanceItem,
  LOCAL_FINANCE_KEYS,
  hasPlaintextFinanceStorage,
} from "../local-finance-store";
import { idbGet, idbSet, clearLocalKvStore } from "../idb-kv";
import { localEncryption, VaultCorruptError } from "../local-crypto";
import { getIntegrityReport, clearIntegrityReport } from "../data-integrity-report";
import { getAccounts } from "../account-service";

describe("local-finance-store über IndexedDB (Issue #29)", () => {
  beforeEach(async () => {
    localStorage.clear();
    await clearLocalKvStore();
    localEncryption.lock();
  });

  it("schreibt und liest Listen über IndexedDB (ohne Verschlüsselung)", async () => {
    await writeLocalFinanceList("accounts", [{ id: "a1", name: "Giro" }]);

    expect(localStorage.getItem(LOCAL_FINANCE_KEYS.accounts)).toBeNull();
    expect(await idbGet(LOCAL_FINANCE_KEYS.accounts)).toBeTruthy();

    const items = await readLocalFinanceList<{ id: string; name: string }>("accounts");
    expect(items).toEqual([{ id: "a1", name: "Giro" }]);
  });

  it("migriert vorhandene localStorage-Altdaten beim Lesen nach IndexedDB", async () => {
    localStorage.setItem(LOCAL_FINANCE_KEYS.debts, JSON.stringify([{ id: "d1" }]));

    const items = await readLocalFinanceList<{ id: string }>("debts");
    expect(items).toEqual([{ id: "d1" }]);

    // Nach dem Lesen liegt der Wert in IndexedDB, die localStorage-Kopie ist weg.
    expect(localStorage.getItem(LOCAL_FINANCE_KEYS.debts)).toBeNull();
    expect(await idbGet(LOCAL_FINANCE_KEYS.debts)).toBeTruthy();
  });

  it("durchläuft den Verschlüsselungs-Lock/Unlock-Zyklus identisch", async () => {
    await localEncryption.enable("ein-sicheres-passwort");
    await writeLocalFinanceList("portfolios", [{ id: "p1", value: 100 }]);

    // In IndexedDB liegt ein verschlüsselter Envelope, kein Klartext.
    const stored = JSON.parse((await idbGet(LOCAL_FINANCE_KEYS.portfolios))!);
    expect(stored.type).toBe("ausgabentracker.enc");

    // Gesperrt: Lesen verweigert.
    localEncryption.lock();
    await expect(readLocalFinanceList("portfolios")).rejects.toThrow();

    // Entsperrt: Werte wieder identisch lesbar.
    await localEncryption.unlock("ein-sicheres-passwort");
    const items = await readLocalFinanceList<{ id: string; value: number }>("portfolios");
    expect(items).toEqual([{ id: "p1", value: 100 }]);
  });

  it("erkennt unverschlüsselte Daten in IndexedDB", async () => {
    await idbSet(LOCAL_FINANCE_KEYS.transactions, JSON.stringify([{ id: "t1" }]));
    expect(await hasPlaintextFinanceStorage()).toBe(true);
  });

  it("[REGRESSION] sollte einen korrupten Envelope werfen statt ihn beim naechsten Schreiben zu ueberschreiben (RES-1)", async () => {
    await localEncryption.enable("ein-sicheres-passwort");
    const seedDebts = [{ id: "d1" }, { id: "d2" }, { id: "d3" }];
    await writeLocalFinanceList("debts", seedDebts);

    // Rohwert in fake-IndexedDB durch Muell ersetzen — simuliert einen
    // beschaedigten Envelope (Bitfehler, abgebrochener Schreibvorgang).
    await idbSet(LOCAL_FINANCE_KEYS.debts, "{kaputt");

    await expect(upsertLocalFinanceItem("debts", { name: "neu" } as { id?: string; name: string })).rejects.toBeInstanceOf(
      VaultCorruptError,
    );

    // Der Bestand darf NICHT durch den fehlgeschlagenen Schreibversuch ersetzt
    // worden sein — der rohe (kaputte) Wert muss unveraendert dort liegen.
    expect(await idbGet(LOCAL_FINANCE_KEYS.debts)).toBe("{kaputt");
  });

  it("[REGRESSION] sollte bei gueltigem JSON ohne Array werfen statt eine Leerliste zu liefern", async () => {
    await idbSet(LOCAL_FINANCE_KEYS.debts, JSON.stringify({ notAnArray: true }));

    await expect(readLocalFinanceList("debts")).rejects.toBeInstanceOf(VaultCorruptError);
  });
});

describe("Schema-Registry an der Kern-Lesegrenze (WP 1.2, RES-2/DOM-2)", () => {
  beforeEach(async () => {
    localStorage.clear();
    await clearLocalKvStore();
    localEncryption.lock();
    clearIntegrityReport();
  });

  it("[REGRESSION] sollte ein einzelnes kaputtes Item ueberspringen und zaehlen statt die Liste zu verwerfen", async () => {
    const good = [
      { id: "d1", name: "Kreditkarte", balance: 100 },
      { id: "d2", name: "Rate", balance: 200 },
      { id: "d3", name: "Dispo", balance: 300 },
    ];
    // Kaputt: balance hat den falschen Typ (String statt Zahl) — genau die Art
    // Korruption, die ein reiner TypeScript-Cast nie erkennen wuerde.
    const broken = { id: "d4", name: "Kaputt", balance: "abc" };
    await idbSet(LOCAL_FINANCE_KEYS.debts, JSON.stringify([...good, broken]));

    const items = await readLocalFinanceList("debts");

    expect(items).toHaveLength(3);
    expect(getIntegrityReport()).toEqual([{ key: "debts", skipped: 1 }]);
  });

  it("[REGRESSION] sollte ein Item ohne id ueberspringen (Identitaet fuer Merge/Upsert fehlt)", async () => {
    const good = [{ id: "a1", name: "Giro" }, { id: "a2", name: "Tagesgeld" }];
    const broken = { name: "Ohne id" };
    await idbSet(LOCAL_FINANCE_KEYS.accounts, JSON.stringify([...good, broken]));

    const items = await readLocalFinanceList("accounts");

    expect(items).toHaveLength(2);
    expect(getIntegrityReport()).toEqual([{ key: "accounts", skipped: 1 }]);
  });

  it("sollte eine Collection OHNE Schema unveraendert durchreichen (Ratsche, kein Alles-oder-nichts)", async () => {
    // 'milestones' ist bewusst NICHT in COLLECTION_SCHEMAS — auch ein Item
    // ganz ohne id muss unveraendert durchgereicht werden, das Bestandsverhalten
    // darf sich fuer nicht abgedeckte Collections nicht aendern.
    const items = [{ milestone_key: "x" }, { id: "m1", milestone_key: "y" }];
    await idbSet(LOCAL_FINANCE_KEYS.milestones, JSON.stringify(items));

    const result = await readLocalFinanceList("milestones");

    expect(result).toEqual(items);
    expect(getIntegrityReport()).toEqual([]);
  });

  it("[INTEGRITY] ein manipuliertes Item erreicht die Render-Schicht nie — geprueft an einem echten Aufrufer (getAccounts)", async () => {
    // getAccounts() (account-service.ts) ist der Aufrufer, den Hooks/Seiten
    // tatsaechlich benutzen — nicht readLocalFinanceList direkt.
    const good = [
      { id: "a1", name: "Giro", order_index: 0 },
      { id: "a2", name: "Tagesgeld", order_index: 1 },
    ];
    const manipulated = { id: "a3", name: "Manipuliert", order_index: "NaN-injection" };
    await idbSet(LOCAL_FINANCE_KEYS.accounts, JSON.stringify([...good, manipulated]));

    const accounts = await getAccounts();

    expect(accounts.map((a) => a.id).sort()).toEqual(["a1", "a2"]);
    expect(accounts.find((a) => a.id === "a3")).toBeUndefined();
    expect(getIntegrityReport()).toEqual([{ key: "accounts", skipped: 1 }]);
  });
});

describe("Abbau der Umgebung waehrend der Abfrage", () => {
  it("[REGRESSION] sollte nicht werfen, wenn localStorage nach dem ersten await verschwindet", async () => {
    // Die Verfuegbarkeitspruefung stand am Anfang der Funktion, der Zugriff
    // dahinter — nach einem `await`. Verschwindet die Umgebung dazwischen
    // (Testdatei zu Ende, Tab geschlossen), warf der Zugriff
    // `ReferenceError: localStorage is not defined` als unbehandelte Rejection.
    // Im CI war der Lauf dadurch rot, obwohl alle Tests gruen waren.
    const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new ReferenceError("localStorage is not defined");
      },
    });

    try {
      await expect(hasPlaintextFinanceStorage()).resolves.toBe(false);
    } finally {
      if (original) Object.defineProperty(globalThis, "localStorage", original);
      else Reflect.deleteProperty(globalThis, "localStorage");
    }
  });

  it("[REGRESSION] sollte nicht werfen, wenn es localStorage gar nicht mehr gibt", async () => {
    // Der Fall aus dem CI: jsdom ist abgebaut, das Global existiert nicht mehr.
    const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Reflect.deleteProperty(globalThis, "localStorage");

    try {
      await expect(hasPlaintextFinanceStorage()).resolves.toBe(false);
    } finally {
      if (original) Object.defineProperty(globalThis, "localStorage", original);
    }
  });
});
