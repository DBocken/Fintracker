import { describe, it, expect, beforeEach } from "vitest";
import { clearAllLocalData } from "./local-data-reset";
import { idbGet, idbSet, clearLocalKvStore } from "./idb-kv";

describe("clearAllLocalData (Issue #31/#32)", () => {
  beforeEach(async () => {
    localStorage.clear();
    await clearLocalKvStore();
  });

  it("entfernt App-Schlüssel aus localStorage und IndexedDB, lässt Fremdes unberührt", async () => {
    localStorage.setItem("ausgabentracker_user_settings_v1", "{}");
    localStorage.setItem("ausgabentracker_anonymous_started_v1", "true");
    localStorage.setItem("fremder_schluessel", "behalten");
    await idbSet("ausgabentracker_transactions_v3", "[]");

    await clearAllLocalData();

    expect(localStorage.getItem("ausgabentracker_user_settings_v1")).toBeNull();
    expect(localStorage.getItem("ausgabentracker_anonymous_started_v1")).toBeNull();
    expect(localStorage.getItem("fremder_schluessel")).toBe("behalten");
    expect(await idbGet("ausgabentracker_transactions_v3")).toBeNull();
  });
});
