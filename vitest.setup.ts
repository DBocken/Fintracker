import "fake-indexeddb/auto"
import "@testing-library/jest-dom/vitest"
import { afterEach } from "vitest"
import { webcrypto } from "node:crypto"
import { cleanup } from "@testing-library/react"
import { LOCAL_STORE_SCHEMA_VERSION, LOCAL_STORE_SCHEMA_VERSION_KEY } from "./src/lib/store-compatibility"

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

// Schema-Version-Marker deterministisch auf "bereits migriert" halten (WP 4.1c).
//
// `assertCompatibleStore()` (local-finance-store.ts) verweigert JEDEN
// Store-Zugriff, solange laut `hasPendingStoreMigrations()` ein definierter
// Migrationsschritt aussteht — gewolltes WP-1.3-Verhalten. In der echten App
// garantiert `App.tsx`, dass `runStoreMigrations()` VOR jedem Store-Zugriff
// einmal gelaufen ist; Tests überspringen `App.tsx` bewusst und riefen
// `runStoreMigrations()` nie auf. Das blieb folgenlos, SOLANGE `migrations`
// leer war — `local-finance-store.pending-migration.test.ts` kommentiert das
// ausdrücklich als "heute nur hypothetisch, ab WP 4.1 real". WP 4.1c trägt den
// ERSTEN echten Schritt ein (Transaktionen: Blob -> Quartals-Chunks): ab jetzt
// würde JEDER Test, der irgendeine Collection über `local-finance-store.ts`
// anfasst, ohne den Marker vorher zu setzen, mit `StoreMigrationPendingError`
// scheitern — nicht nur Transaktions-Tests, jede Collection läuft über
// denselben synchronen Check.
//
// Ein einmaliger Property-Patch (wie beim `navigator.language`-Pin oben)
// reicht hier NICHT: der Marker lebt in `localStorage`, und Dutzende
// Testdateien rufen `localStorage.clear()` mitten in ihrem eigenen
// `beforeEach` auf (derselbe Grund, aus dem der Sprach-Pin bewusst KEIN
// `beforeEach` ist — hier ist es aber nicht vermeidbar, weil `clear()` selbst
// das Ziel ist). Deshalb wird `clear()` selbst umschlossen: jeder Aufruf
// räumt wie gewohnt auf UND schreibt den Marker sofort wieder fest, sodass
// die Ablage aus Sicht jedes Tests immer "bereits auf dem aktuellen Stand"
// ist — genau der Zustand, den `App.tsx` in der echten App vor jedem
// Store-Zugriff bereits hergestellt hat.
//
// Tests, die die Migrationsprüfung selbst GEZIELT prüfen wollen (fehlender
// Marker, zu alte/zu neue Version), setzen den Marker in ihrem eigenen Test
// explizit — ein expliziter `localStorage.setItem`/`removeItem` NACH diesem
// `clear()`-Aufruf gewinnt immer, weil er später läuft.
if (typeof window !== "undefined" && window.localStorage) {
  // `localStorage` ist (WHATWG Web Storage) kein normales Objekt, sondern
  // proxyt jede Eigenschaftszuweisung als Storage-Eintrag — ein direktes
  // `window.localStorage.clear = fn` legt daher lautlos nur einen Eintrag
  // namens "clear" an und lässt `clear()` selbst unangetastet (empirisch
  // geprüft). Die eingebaute Methode hängt an `Storage.prototype`, DIE ist
  // ein normales, beschreibbares Objekt — dort wird gepatcht.
  //
  // ACHTUNG, hier lag ein Fehler, der einen Datenschutz-Wächter blind gemacht
  // hat: `localStorage` und `sessionStorage` teilen sich DENSELBEN Prototyp.
  // Wer hier patcht, patcht beide. Die erste Fassung band zusätzlich das
  // Original an `localStorage` (`proto.clear.bind(window.localStorage)`) —
  // damit räumte `sessionStorage.clear()` in Wahrheit den localStorage und
  // ließ die Sitzung stehen. Aufgefallen ist das an
  // `telemetry-service.test.ts` („Sitzungskennung ist kein Gerätemerkmal"):
  // Der Test räumt die Sitzung und erwartet eine neue Kennung — sie blieb
  // dieselbe, und die Zusicherung „keine wiedererkennbare Kennung über den
  // Besuch hinaus" war damit unbewiesen.
  //
  // Deshalb: Original UNGEBUNDEN halten und auf `this` aufrufen, und den
  // Marker nur für den localStorage nachziehen.
  const proto = Object.getPrototypeOf(window.localStorage) as Storage
  const originalClear = proto.clear
  proto.clear = function patchedClear(this: Storage) {
    originalClear.call(this)
    if (this === window.localStorage) {
      this.setItem(LOCAL_STORE_SCHEMA_VERSION_KEY, String(LOCAL_STORE_SCHEMA_VERSION))
    }
  }
  window.localStorage.setItem(LOCAL_STORE_SCHEMA_VERSION_KEY, String(LOCAL_STORE_SCHEMA_VERSION))
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

// jsdom implementiert `matchMedia` nicht. Komponenten, die ihren Breakpoint
// selbst abfragen (z. B. KpiGrid), werfen deshalb schon beim Mounten.
//
// Der Shim meldet konsequent `matches: false` — das ist die MOBILE Annahme,
// weil die Abfragen hier durchweg `min-width`-Abfragen sind. Tests, die den
// Desktop-Zweig brauchen, setzen `window.matchMedia` selbst; ein Shim, der
// `true` liefert, wuerde dagegen still den jeweils anderen Zweig testen, ohne
// dass es jemandem auffiele.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  })
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
