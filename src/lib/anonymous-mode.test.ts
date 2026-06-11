import { describe, expect, it } from "vitest";

import {
  ANONYMOUS_MODE_KEY,
  clearAnonymousMode,
  hasStartedAnonymousMode,
  startAnonymousMode,
} from "./anonymous-mode";

function createStorageStub() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    _store: store,
  };
}

describe("anonymous-mode", () => {
  it("ist initial nicht gestartet", () => {
    const storage = createStorageStub();
    expect(hasStartedAnonymousMode(storage)).toBe(false);
  });

  it("startAnonymousMode setzt das Flag", () => {
    const storage = createStorageStub();
    startAnonymousMode(storage);
    expect(hasStartedAnonymousMode(storage)).toBe(true);
    expect(storage._store.get(ANONYMOUS_MODE_KEY)).toBe("true");
  });

  it("clearAnonymousMode entfernt das Flag", () => {
    const storage = createStorageStub();
    startAnonymousMode(storage);
    clearAnonymousMode(storage);
    expect(hasStartedAnonymousMode(storage)).toBe(false);
  });

  it("fremde Werte im Storage zählen nicht als gestartet", () => {
    const storage = createStorageStub();
    storage.setItem(ANONYMOUS_MODE_KEY, "1");
    expect(hasStartedAnonymousMode(storage)).toBe(false);
  });

  it("funktioniert ohne Storage (SSR/blockierter Zugriff) fehlerfrei", () => {
    expect(hasStartedAnonymousMode(null)).toBe(false);
    expect(() => startAnonymousMode(null)).not.toThrow();
    expect(() => clearAnonymousMode(null)).not.toThrow();
  });
});
