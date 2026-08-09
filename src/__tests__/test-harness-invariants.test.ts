import { describe, it, expect, beforeEach } from 'vitest'
import {
  LOCAL_STORE_SCHEMA_VERSION,
  LOCAL_STORE_SCHEMA_VERSION_KEY,
} from '@/lib/store-compatibility'

/**
 * Zusicherungen über die Testumgebung selbst (`vitest.setup.ts`).
 *
 * Warum es diese Datei gibt: WP 4.1c musste den Schema-Marker über
 * `localStorage.clear()` hinweg festhalten und hat dafür `Storage.prototype.clear`
 * umschlossen. Dabei ist eine Falle zugeschnappt, die nirgends sichtbar war —
 * `localStorage` und `sessionStorage` teilen sich denselben Prototyp. Der
 * Fehler äußerte sich in einem völlig unbeteiligten Datenschutz-Test
 * (`telemetry-service.test.ts`), und von dort führte kein Weg zurück zur
 * Ursache.
 *
 * Die Tests hier prüfen deshalb nicht Produktionscode, sondern die Werkzeuge,
 * mit denen alle anderen Tests messen. Ein Messgerät, das falsch geht, macht
 * jede Messung wertlos — und zwar lautlos.
 */
describe('Testumgebung (vitest.setup.ts)', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('sollte den Schema-Marker nach localStorage.clear() wieder setzen', () => {
    localStorage.clear()

    // Ohne das verweigert `assertCompatibleStore()` jeden Store-Zugriff,
    // seit WP 4.1c einen echten Migrationsschritt definiert.
    expect(localStorage.getItem(LOCAL_STORE_SCHEMA_VERSION_KEY)).toBe(
      String(LOCAL_STORE_SCHEMA_VERSION)
    )
  })

  it('[REGRESSION] sollte mit sessionStorage.clear() den sessionStorage räumen, nicht den localStorage', () => {
    // Der Fehler: `Storage.prototype.clear` wurde mit einem an `localStorage`
    // GEBUNDENEN Original überschrieben. Da beide Speicher denselben Prototyp
    // haben, räumte `sessionStorage.clear()` danach den localStorage und ließ
    // die Sitzung unangetastet — die Telemetrie-Sitzungskennung überlebte ein
    // Räumen und war damit ein Wiedererkennungsmerkmal.
    localStorage.setItem('bleibt-liegen', 'ja')
    sessionStorage.setItem('soll-weg', 'ja')

    sessionStorage.clear()

    expect(sessionStorage.getItem('soll-weg')).toBeNull()
    expect(localStorage.getItem('bleibt-liegen')).toBe('ja')
  })

  it('[REGRESSION] sollte den Schema-Marker NICHT in den sessionStorage schreiben', () => {
    sessionStorage.clear()

    // Der Marker gehört ausschließlich in den localStorage. Stünde er auch im
    // sessionStorage, wäre das kein Fehler mit Symptom, sondern ein zweiter,
    // stiller Zustand daneben.
    expect(sessionStorage.getItem(LOCAL_STORE_SCHEMA_VERSION_KEY)).toBeNull()
  })

  it('sollte die Sprache deterministisch auf de-DE pinnen', () => {
    // Ohne diesen Pin lief jeder `serviceT`-gestützte Test unbemerkt auf
    // Englisch (jsdom meldet `en-US`) — das hat hier schon zweimal zu
    // rätselhaften Fehlschlägen geführt.
    expect(navigator.language).toBe('de-DE')
  })
})
