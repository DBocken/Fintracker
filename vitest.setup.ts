// Minimaler Browser-Shim für das node-Test-Environment. Services wie
// local-crypto erwarten window/localStorage, brauchen aber sonst nur Globals,
// die Node bereitstellt (crypto.subtle, atob/btoa, TextEncoder). So laufen sie
// ohne jsdom – wichtig, weil jsdom-fremde TypedArrays (new Uint8Array in einem
// anderen Realm) von Nodes crypto.subtle abgelehnt werden.
if (typeof globalThis.localStorage === "undefined") {
  const store = new Map<string, string>();
  const localStoragePolyfill: Storage = {
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    setItem: (key, value) => {
      store.set(key, String(value));
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
  globalThis.localStorage = localStoragePolyfill;
}

if (typeof globalThis.window === "undefined") {
  // local-crypto prüft nur `typeof window !== 'undefined'`.
  (globalThis as unknown as { window: typeof globalThis }).window = globalThis;
}
