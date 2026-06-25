import "fake-indexeddb/auto"
import "@testing-library/jest-dom/vitest"
import { afterEach } from "vitest"
import { webcrypto } from "node:crypto"
import { cleanup } from "@testing-library/react"

afterEach(() => {
  cleanup()
})

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

// Radix-Primitives (Popover/Dialog/Select) rufen Pointer-/Scroll-APIs auf, die
// jsdom nicht implementiert. Ohne diese Shims wirft das Öffnen im Test.
if (typeof Element !== "undefined") {
  const proto = Element.prototype as unknown as {
    hasPointerCapture?: (pointerId: number) => boolean
    setPointerCapture?: (pointerId: number) => void
    releasePointerCapture?: (pointerId: number) => void
    scrollIntoView?: () => void
  }
  proto.hasPointerCapture ||= () => false
  proto.setPointerCapture ||= () => {}
  proto.releasePointerCapture ||= () => {}
  proto.scrollIntoView ||= () => {}
}
