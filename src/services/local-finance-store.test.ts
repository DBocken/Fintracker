import { describe, it, expect, beforeEach } from "vitest";
import {
  readLocalFinanceList,
  writeLocalFinanceList,
  LOCAL_FINANCE_KEYS,
  hasPlaintextFinanceStorage,
} from "./local-finance-store";
import { idbGet, idbSet, clearLocalKvStore } from "./idb-kv";
import { localEncryption } from "./local-crypto";

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
});
