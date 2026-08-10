import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  idbGet,
  idbSet,
  idbRemove,
  idbKeys,
  clearLocalKvStore,
  collectLegacyDataKeys,
  migrateLocalStorageToIdb,
} from "../idb-kv";
import { StorageQuotaExceededError } from "@/lib/storage-errors";

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

describe("idb-kv Laufzeitfehler (RES-6, WP 1.6)", () => {
  beforeEach(async () => {
    localStorage.clear();
    await clearLocalKvStore();
  });

  it("[REGRESSION] übersetzt einen Quota-Fehler beim Schreiben in eine verständliche Meldung mit Handlungsoption statt einer rohen DOMException", async () => {
    const putSpy = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(() => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    });

    try {
      await expect(idbSet("k", "v")).rejects.toBeInstanceOf(StorageQuotaExceededError);
      await expect(idbSet("k", "v")).rejects.not.toBeInstanceOf(DOMException);
      // Die Meldung nennt eine Handlungsoption, nicht nur das Problem.
      await expect(idbSet("k", "v")).rejects.toMatchObject({
        message: expect.stringMatching(/backup|aufräumen/i),
      });
    } finally {
      putSpy.mockRestore();
    }
  });

  it("[REGRESSION] erkennt auch den Legacy-Quota-Code 22 ohne passenden Namen", async () => {
    const putSpy = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(() => {
      const legacy = new Error("quota") as Error & { code: number };
      legacy.name = "UnknownError";
      legacy.code = 22;
      throw legacy;
    });

    try {
      await expect(idbSet("k", "v")).rejects.toBeInstanceOf(StorageQuotaExceededError);
    } finally {
      putSpy.mockRestore();
    }
  });

  it("[REGRESSION] openDb() erholt sich nach einem fehlgeschlagenen Erstaufruf statt den Store für die Session tot zu lassen", async () => {
    // Isoliertes Modul: `dbPromise` ist modulprivat und darf es bleiben — ein
    // frischer Import startet mit ungecachtem Zustand, statt einen Test-Only-
    // Reset-Export in die Produktions-API aufzunehmen.
    vi.resetModules();
    const realOpen = indexedDB.open.bind(indexedDB);
    let calls = 0;
    const openSpy = vi.spyOn(indexedDB, "open").mockImplementation((...args: Parameters<typeof indexedDB.open>) => {
      calls += 1;
      if (calls === 1) {
        const failingRequest = {} as IDBOpenDBRequest;
        queueMicrotask(() => {
          Object.defineProperty(failingRequest, "error", {
            value: new DOMException("boom", "UnknownError"),
            configurable: true,
          });
          failingRequest.onerror?.(new Event("error"));
        });
        return failingRequest;
      }
      return realOpen(...args);
    });

    try {
      const fresh = await import("../idb-kv");
      // Erster Zugriff scheitert...
      await expect(fresh.idbGet("x")).rejects.toBeTruthy();
      // ...der zweite gelingt, weil openDb() das kaputte Promise verworfen hat.
      await expect(fresh.idbGet("x")).resolves.toBeNull();
      expect(calls).toBeGreaterThanOrEqual(2);
    } finally {
      openSpy.mockRestore();
      vi.resetModules();
    }
  });
});
