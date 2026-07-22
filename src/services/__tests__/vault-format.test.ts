import { beforeEach, afterEach, describe, it, expect } from "vitest";
import {
  createVaultFile,
  serializeVaultFile,
  parseVaultFile,
  openVaultFile,
  mergeRecords,
  mergeVaultPayloads,
  emptyVaultPayload,
  resolveRecord,
  type SyncRecord,
  type VaultPayload,
} from "../vault-format";

const PASSWORD = "korrekt-pferd-batterie-klammer";

beforeEach(() => {
  window.localStorage.setItem("ausgabentracker_locale_v1", "de");
});

afterEach(() => {
  window.localStorage.removeItem("ausgabentracker_locale_v1");
});

function payloadWith(partial: Partial<VaultPayload>): VaultPayload {
  return { ...emptyVaultPayload(), ...partial };
}

function tx(id: string, updated_at: string, extra: Record<string, unknown> = {}): SyncRecord {
  return { id, updated_at, amount: -10, payee: `Händler ${id}`, ...extra };
}

describe("Vault-Datei: Verschlüsselung (Issue #36)", () => {
  it("Roundtrip: erstellen → serialisieren → parsen → öffnen ergibt identischen Payload", async () => {
    const payload = payloadWith({
      transactions: [tx("t1", "2026-06-01T10:00:00.000Z")],
      settings: { id: "settings", updated_at: "2026-06-01T10:00:00.000Z", theme: "ruhe" },
    });

    const file = await createVaultFile(payload, PASSWORD, "device-a");
    const reopened = await openVaultFile(parseVaultFile(serializeVaultFile(file)), PASSWORD);
    expect(reopened).toEqual(payload);
  });

  it("kein Codepfad erzeugt eine unverschlüsselte Vault-Datei", async () => {
    const payload = payloadWith({
      transactions: [tx("t1", "2026-06-01T10:00:00.000Z", { payee: "GEHEIMER HÄNDLER" })],
    });

    // Leeres Passwort wird abgewiesen
    await expect(createVaultFile(payload, "", "device-a")).rejects.toThrow(/verschlüsselt/);

    // Serialisierte Datei enthält keinerlei Klartext-Daten
    const file = await createVaultFile(payload, PASSWORD, "device-a");
    const raw = serializeVaultFile(file);
    expect(raw).not.toContain("GEHEIMER HÄNDLER");
    expect(raw).not.toContain('"transactions"');
    expect(file.payload.type).toBe("ausgabentracker.enc");
  });

  it("falsches Passwort wird klar gemeldet", async () => {
    const file = await createVaultFile(emptyVaultPayload(), PASSWORD, "device-a");
    await expect(openVaultFile(file, "falsch")).rejects.toThrow("Falsches Passwort");
  });

  it("korrupte Dateien werden mit verständlichen Fehlern abgewiesen", async () => {
    expect(() => parseVaultFile("kein json {")).toThrow(/beschädigt/);
    expect(() => parseVaultFile(JSON.stringify({ type: "anderes.format" }))).toThrow(/keine fintracker.vault/);
    expect(() =>
      parseVaultFile(JSON.stringify({ type: "fintracker.vault", formatVersion: 99, payload: {} })),
    ).toThrow(/nicht unterstützt/);
    expect(() =>
      parseVaultFile(JSON.stringify({ type: "fintracker.vault", formatVersion: 1, payload: { type: "nope" } })),
    ).toThrow(/verschlüsselter Inhalt fehlt/);
  });

  it("öffnet leere Vaults und normalisiert fehlende Felder", async () => {
    const file = await createVaultFile(emptyVaultPayload(), PASSWORD, "device-a");
    const payload = await openVaultFile(file, PASSWORD);
    expect(payload).toEqual(emptyVaultPayload());
  });
});

describe("Merge-Logik (Issue #36)", () => {
  it("beidseitige Änderungen: pro ID gewinnt der neuere Datensatz", () => {
    const local = [tx("a", "2026-06-02T00:00:00.000Z", { payee: "Lokal neuer" }), tx("b", "2026-06-01T00:00:00.000Z")];
    const remote = [tx("a", "2026-06-01T00:00:00.000Z"), tx("b", "2026-06-03T00:00:00.000Z", { payee: "Remote neuer" })];

    const merged = mergeRecords(local, remote);
    expect(merged.find((r) => r.id === "a")?.payee).toBe("Lokal neuer");
    expect(merged.find((r) => r.id === "b")?.payee).toBe("Remote neuer");
  });

  it("nur-lokale und nur-remote Datensätze bleiben beide erhalten", () => {
    const merged = mergeRecords([tx("nur-lokal", "2026-06-01T00:00:00.000Z")], [tx("nur-remote", "2026-06-01T00:00:00.000Z")]);
    expect(merged.map((r) => r.id)).toEqual(["nur-lokal", "nur-remote"]);
  });

  it("Tombstone gewinnt über ältere Updates (Löschungen synchronisieren)", () => {
    const update = tx("a", "2026-06-01T00:00:00.000Z");
    const tombstone: SyncRecord = { id: "a", updated_at: "2026-06-01T00:00:00.000Z", deleted_at: "2026-06-02T00:00:00.000Z" };

    expect(resolveRecord(update, tombstone)).toBe(tombstone);
    expect(resolveRecord(tombstone, update)).toBe(tombstone);
  });

  it("ein Update NACH der Löschung belebt den Datensatz wieder", () => {
    const tombstone: SyncRecord = { id: "a", deleted_at: "2026-06-02T00:00:00.000Z" };
    const laterUpdate = tx("a", "2026-06-03T00:00:00.000Z");
    expect(resolveRecord(tombstone, laterUpdate)).toBe(laterUpdate);
  });

  it("Uhren-Drift: bei exakt gleichem Zeitstempel gewinnt der Tombstone", () => {
    const t = "2026-06-02T00:00:00.000Z";
    const update = tx("a", t);
    const tombstone: SyncRecord = { id: "a", updated_at: t, deleted_at: t };
    expect(resolveRecord(update, tombstone)).toBe(tombstone);
    expect(resolveRecord(tombstone, update)).toBe(tombstone);
  });

  it("Datensätze ohne updated_at gelten als uralt und verlieren", () => {
    const ohne: SyncRecord = { id: "a", payee: "ohne Zeitstempel" };
    const mit = tx("a", "2026-01-01T00:00:00.000Z");
    expect(resolveRecord(ohne, mit)).toBe(mit);
  });

  it("Merge ist symmetrisch: merge(a,b) === merge(b,a)", () => {
    const a = [tx("x", "2026-06-01T00:00:00.000Z"), tx("y", "2026-06-05T00:00:00.000Z")];
    const b = [tx("x", "2026-06-03T00:00:00.000Z"), { id: "y", deleted_at: "2026-06-04T00:00:00.000Z" } as SyncRecord];
    expect(mergeRecords(a, b)).toEqual(mergeRecords(b, a));
  });

  it("Merge ist symmetrisch auch bei identischem Zeitstempel ohne Tombstone", () => {
    const t = "2026-06-01T00:00:00.000Z";
    const a: SyncRecord = { id: "x", updated_at: t, payee: "Variante A" };
    const b: SyncRecord = { id: "x", updated_at: t, payee: "Variante B" };
    expect(mergeRecords([a], [b])).toEqual(mergeRecords([b], [a]));
  });

  it("Merge ist idempotent: zweimal mergen = einmal mergen", () => {
    const local = [tx("a", "2026-06-02T00:00:00.000Z"), tx("b", "2026-06-01T00:00:00.000Z")];
    const remote = [{ id: "a", deleted_at: "2026-06-03T00:00:00.000Z" } as SyncRecord, tx("c", "2026-06-01T00:00:00.000Z")];

    const once = mergeRecords(local, remote);
    expect(mergeRecords(once, remote)).toEqual(once);
    expect(mergeRecords(once, once)).toEqual(once);
  });

  it("leere Vault: Merge mit leerem Payload verändert nichts", () => {
    const payload = payloadWith({
      transactions: [tx("t1", "2026-06-01T00:00:00.000Z")],
      debts: [{ id: "d1", updated_at: "2026-06-01T00:00:00.000Z", balance: 100 }],
    });
    expect(mergeVaultPayloads(payload, emptyVaultPayload())).toEqual({
      ...payload,
      transactions: payload.transactions,
      debts: payload.debts,
    });
    expect(mergeVaultPayloads(emptyVaultPayload(), payload)).toEqual(mergeVaultPayloads(payload, emptyVaultPayload()));
  });

  it("Settings folgen derselben Regel (neuer gewinnt, einseitig bleibt erhalten)", () => {
    const older: SyncRecord = { id: "settings", updated_at: "2026-06-01T00:00:00.000Z", theme: "alt" };
    const newer: SyncRecord = { id: "settings", updated_at: "2026-06-02T00:00:00.000Z", theme: "neu" };

    expect(mergeVaultPayloads(payloadWith({ settings: older }), payloadWith({ settings: newer })).settings).toEqual(newer);
    expect(mergeVaultPayloads(payloadWith({ settings: older }), emptyVaultPayload()).settings).toEqual(older);
    expect(mergeVaultPayloads(emptyVaultPayload(), emptyVaultPayload()).settings).toBeNull();
  });

  it("Datensätze ohne ID werden ignoriert statt zu crashen", () => {
    const broken = [{ updated_at: "2026-06-01T00:00:00.000Z" } as unknown as SyncRecord];
    expect(mergeRecords(broken, [tx("ok", "2026-06-01T00:00:00.000Z")]).map((r) => r.id)).toEqual(["ok"]);
  });
});

describe("Vault-Merge Ende-zu-Ende (zwei Geräte)", () => {
  it("Änderungen wandern in beide Richtungen und konvergieren", async () => {
    // Gerät A löscht t2 und ändert t1; Gerät B legt t3 an.
    const deviceA = payloadWith({
      transactions: [
        tx("t1", "2026-06-05T00:00:00.000Z", { payee: "Geändert auf A" }),
        { id: "t2", updated_at: "2026-06-01T00:00:00.000Z", deleted_at: "2026-06-04T00:00:00.000Z" },
      ],
    });
    const deviceB = payloadWith({
      transactions: [
        tx("t1", "2026-06-01T00:00:00.000Z"),
        tx("t2", "2026-06-02T00:00:00.000Z"),
        tx("t3", "2026-06-03T00:00:00.000Z"),
      ],
    });

    const merged = mergeVaultPayloads(deviceA, deviceB);
    const fileFromA = await createVaultFile(merged, PASSWORD, "device-a");
    const seenByB = await openVaultFile(parseVaultFile(serializeVaultFile(fileFromA)), PASSWORD);
    const convergedOnB = mergeVaultPayloads(deviceB, seenByB);

    expect(convergedOnB).toEqual(merged);
    expect(convergedOnB.transactions.find((t) => t.id === "t1")?.payee).toBe("Geändert auf A");
    expect(convergedOnB.transactions.find((t) => t.id === "t2")?.deleted_at).toBe("2026-06-04T00:00:00.000Z");
    expect(convergedOnB.transactions.map((t) => t.id)).toEqual(["t1", "t2", "t3"]);
  });
});

describe("Vault-Abdeckung Haushaltsdaten (Issue #235, Blocker vor #247)", () => {
  it("[REGRESSION] emptyVaultPayload enthält alle Haushalts-Felder", () => {
    const empty = emptyVaultPayload();
    expect(empty.households).toEqual([]);
    expect(empty.householdMembers).toEqual([]);
    expect(empty.sharedExpenseSplits).toEqual([]);
    expect(empty.householdSettlements).toEqual([]);
  });

  it("[REGRESSION] Haushalt, Mitglieder und Splits überleben den Vault-Roundtrip", async () => {
    const payload = payloadWith({
      households: [{ id: "h1", updated_at: "2026-06-01T00:00:00.000Z", name: "WG" }],
      householdMembers: [
        { id: "m1", updated_at: "2026-06-01T00:00:00.000Z", household_id: "h1", name: "Anna" },
        { id: "m2", updated_at: "2026-06-01T00:00:00.000Z", household_id: "h1", name: "Ben" },
      ],
      sharedExpenseSplits: [
        { id: "s1", updated_at: "2026-06-01T00:00:00.000Z", transaction_id: "t1", household_id: "h1" },
      ],
    });

    const file = await createVaultFile(payload, PASSWORD, "device-a");
    const reopened = await openVaultFile(parseVaultFile(serializeVaultFile(file)), PASSWORD);
    expect(reopened).toEqual(payload);
    expect(reopened.householdMembers.map((m) => m.id)).toEqual(["m1", "m2"]);
  });

  it("[REGRESSION] Haushalts-Felder mergen per ID (kein Datenverlust bei Zwei-Geräte-Sync)", () => {
    const deviceA = payloadWith({
      households: [{ id: "h1", updated_at: "2026-06-02T00:00:00.000Z", name: "WG neu" }],
      householdMembers: [{ id: "m1", updated_at: "2026-06-01T00:00:00.000Z", household_id: "h1", name: "Anna" }],
    });
    const deviceB = payloadWith({
      households: [{ id: "h1", updated_at: "2026-06-01T00:00:00.000Z", name: "WG alt" }],
      householdMembers: [{ id: "m2", updated_at: "2026-06-01T00:00:00.000Z", household_id: "h1", name: "Ben" }],
    });

    const merged = mergeVaultPayloads(deviceA, deviceB);
    expect(merged.households.find((h) => h.id === "h1")?.name).toBe("WG neu"); // jüngerer gewinnt
    expect(merged.householdMembers.map((m) => m.id)).toEqual(["m1", "m2"]); // beide bleiben
  });

  it("[REGRESSION] alte Vault-Datei ohne Haushalts-Felder wird defensiv zu [] normalisiert", async () => {
    // Simuliert eine Vault-Datei aus der Zeit vor #235: Payload ohne Haushalts-Felder.
    const legacyPayload = {
      transactions: [tx("t1", "2026-06-01T00:00:00.000Z")],
      accounts: [],
      debts: [],
      claims: [],
      categories: [],
      settings: null,
    } as unknown as VaultPayload;

    const file = await createVaultFile(legacyPayload, PASSWORD, "device-a");
    const reopened = await openVaultFile(parseVaultFile(serializeVaultFile(file)), PASSWORD);
    expect(reopened.households).toEqual([]);
    expect(reopened.householdMembers).toEqual([]);
    expect(reopened.sharedExpenseSplits).toEqual([]);
    expect(reopened.householdSettlements).toEqual([]);
    // Und mergen mit so einer normalisierten Altdatei crasht nicht.
    expect(() => mergeVaultPayloads(reopened, emptyVaultPayload())).not.toThrow();
  });
});
