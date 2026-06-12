import { describe, it, expect, beforeEach } from "vitest";
import {
  idbGet,
  idbSet,
  idbRemove,
  idbKeys,
  clearLocalKvStore,
  collectLegacyDataKeys,
  migrateLocalStorageToIdb,
} from "./idb-kv";

describe("idb-kv Grundoperationen", () => {
  beforeEach(async () => {
    localStorage.clear();
    await clearLocalKvStore();
  });

  it("schreibt, liest und löscht Werte", async () => {
    expect(await idbGet("k")).toBeNull();
    await idbSet("k", "v");
    expect(await idbGet("k")).toBe("v");
    await idbRemove("k");
    expect(await idbGet("k")).toBeNull();
  });

  it("listet vorhandene Schlüssel", async () => {
    await idbSet("a", "1");
    await idbSet("b", "2");
    expect((await idbKeys()).sort()).toEqual(["a", "b"]);
  });
});

describe("migrateLocalStorageToIdb", () => {
  beforeEach(async () => {
    localStorage.clear();
    await clearLocalKvStore();
  });

  it("erkennt vorhandene Legacy-Datenschlüssel (exakt + Präfix)", () => {
    localStorage.setItem("ausgabentracker_transactions_v3", "[]");
    localStorage.setItem("ausgabentracker_transactions_v2__konto1", "[]");
    localStorage.setItem("ausgabentracker_device_id_v1", "x"); // kein Datenschlüssel
    const keys = collectLegacyDataKeys().sort();
    expect(keys).toContain("ausgabentracker_transactions_v3");
    expect(keys).toContain("ausgabentracker_transactions_v2__konto1");
    expect(keys).not.toContain("ausgabentracker_device_id_v1");
  });

  it("verschiebt Daten nach IndexedDB und entfernt die localStorage-Kopie", async () => {
    localStorage.setItem("ausgabentracker_accounts_v1", '[{"id":"a"}]');
    localStorage.setItem("ausgabentracker_user_settings_v1", '{"theme":"dark"}');

    const migrated = await migrateLocalStorageToIdb();

    expect(migrated).toBe(2);
    expect(await idbGet("ausgabentracker_accounts_v1")).toBe('[{"id":"a"}]');
    expect(localStorage.getItem("ausgabentracker_accounts_v1")).toBeNull();
    expect(await idbGet("ausgabentracker_user_settings_v1")).toBe('{"theme":"dark"}');
    expect(localStorage.getItem("ausgabentracker_user_settings_v1")).toBeNull();
  });

  it("ist idempotent und überschreibt bereits in IndexedDB liegende Daten nicht", async () => {
    // IndexedDB hat bereits den maßgeblichen Stand …
    await idbSet("ausgabentracker_debts_v1", '[{"id":"neu"}]');
    // … localStorage enthält noch einen veralteten Stand.
    localStorage.setItem("ausgabentracker_debts_v1", '[{"id":"alt"}]');

    const migrated = await migrateLocalStorageToIdb();

    expect(migrated).toBe(0);
    expect(await idbGet("ausgabentracker_debts_v1")).toBe('[{"id":"neu"}]');
    expect(localStorage.getItem("ausgabentracker_debts_v1")).toBeNull();

    // Zweiter Lauf bleibt ein No-Op.
    expect(await migrateLocalStorageToIdb()).toBe(0);
  });
});
