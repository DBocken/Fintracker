import "fake-indexeddb/auto"
import { afterEach } from "vitest"
import { webcrypto } from "node:crypto"

// jsdom kennt kein IndexedDB; fake-indexeddb stellt es global bereit (Issue #29).
// Nach jedem Test den KV-Store leeren, damit Tests isoliert bleiben.
afterEach(async () => {
  try {
    const { clearLocalKvStore } = await import("./src/services/idb-kv")
    await clearLocalKvStore()
  } catch {
    // idb nicht verfügbar – ignorieren
  }
})

// jsdom ships a `crypto` global without `subtle` (Web Crypto). The local
// encryption layer relies on AES-GCM/PBKDF2 via `crypto.subtle`, so swap in
// Node's full WebCrypto implementation for the test environment.
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
  })
}

// jsdom's Blob/File lack the `text()` instance method that the CSV import
// uses (`await file.text()`). Bridge it via FileReader, which jsdom supports.
if (typeof Blob !== "undefined" && !Blob.prototype.text) {
  Blob.prototype.text = function text(this: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsText(this)
    })
  }
}
