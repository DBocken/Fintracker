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

// Sprachwahl deterministisch machen.
//
// `resolveInitialLocale()` (src/i18n/I18nProvider.tsx) fällt ohne gespeicherte
// Wahl auf `navigator.language` zurück. Unter jsdom ist das `en-US`, also lief
// jeder Test, der `serviceT`-gestützten Code anfasst, unbemerkt auf Englisch —
// das hat hier schon zweimal zu rätselhaften Fehlschlägen geführt.
//
// Bewusst ein einmaliger Property-Patch und KEIN `beforeEach`: 40 Testdateien
// rufen `localStorage.clear()` auf, teils mitten im `it()`. Ein Hook-basierter
// Pin würde davon weggeräumt, dieser hier nicht.
//
// Eine explizit gespeicherte Sprache gewinnt weiterhin — `renderWithI18n(ui, 'en')`
// und `localStorage.setItem('ausgabentracker_locale_v1', …)` wirken unverändert.
if (typeof window !== "undefined" && window.navigator) {
  Object.defineProperty(window.navigator, "language", {
    value: "de-DE",
    configurable: true,
  })
}

// Geräteeinstufung deterministisch machen (WP-7.7).
//
// `classifyDevice()` (src/lib/device-profile.ts) liest `hardwareConcurrency`,
// um die Bewegungsstufe zu wählen. Unter jsdom kommt dort die echte Kernanzahl
// der Maschine an — auf einem 4-Kern-CI-Runner gilt die App damit als schwaches
// Gerät und kürzt jede Animationsdauer, auf einem 12-Kern-Entwicklungsrechner
// nicht. Jede Zusicherung auf eine konkrete Dauer wäre dann maschinenabhängig
// und je nach Runner rot oder grün.
//
// Deshalb hier ein fester Desktop-Wert, analog zum `navigator.language`-Pin
// darüber und mit derselben Begründung: der Standardfall wird festgenagelt,
// abweichende Geräte setzen Tests ausdrücklich selbst
// (`resetDeviceProfileCache()` aus `@/hooks/useDeviceProfile`).
if (typeof window !== "undefined" && window.navigator) {
  Object.defineProperty(window.navigator, "hardwareConcurrency", {
    value: 12,
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

// Radix-Slider misst seinen Track über ResizeObserver — jsdom kennt die API
// nicht und der Test wirft schon beim Rendern. Ein No-op-Shim genügt: gemessen
// wird in jsdom ohnehin nichts (alle Elemente haben die Größe 0), geprüft wird
// die Struktur.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
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
