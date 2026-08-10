import { describe, it, expect, beforeEach } from 'vitest'
import { runStoreMigrations, migrations } from '../local-store-migrations'
import {
  LOCAL_STORE_SCHEMA_VERSION,
  LOCAL_STORE_SCHEMA_VERSION_KEY,
} from '@/lib/store-compatibility'

/**
 * [REGRESSION] Der erste Start einer frischen Installation.
 *
 * WP 4.1c hat die Zielversion auf 3 gehoben und einen Schritt nach 3
 * eingetragen. Ein frischer Store hat keinen Marker und gilt als Version 1 —
 * für Version 2 gab es nie einen Schritt, weil dieser Sprung älter ist als
 * der Läufer. Eine Lückenprüfung im Läufer hielt das für einen Autorenfehler
 * und warf. Ergebnis: JEDER neue Nutzer bekam beim ersten Start einen
 * Fehlerschirm statt der App — „Demo ansehen" navigierte nicht mehr.
 *
 * Kein Unit-Test hat das gesehen; die Testumgebung setzt den Marker
 * automatisch (`vitest.setup.ts`), und genau dieser Marker fehlt beim ersten
 * echten Start. Gefangen hat es die E2E-Kette. Diese Datei entfernt den
 * Marker deshalb ausdrücklich.
 */
describe('Migrationsläufer: frische Installation', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.removeItem(LOCAL_STORE_SCHEMA_VERSION_KEY)
  })

  it('[REGRESSION] sollte auf einem völlig leeren Store durchlaufen statt zu werfen', async () => {
    await expect(runStoreMigrations()).resolves.toBeUndefined()
  })

  it('[REGRESSION] sollte den Marker danach auf die Zielversion setzen', async () => {
    await runStoreMigrations()

    expect(localStorage.getItem(LOCAL_STORE_SCHEMA_VERSION_KEY)).toBe(
      String(LOCAL_STORE_SCHEMA_VERSION)
    )
  })

  it('sollte ein zweites Mal nichts mehr tun', async () => {
    await runStoreMigrations()
    await expect(runStoreMigrations()).resolves.toBeUndefined()

    expect(localStorage.getItem(LOCAL_STORE_SCHEMA_VERSION_KEY)).toBe(
      String(LOCAL_STORE_SCHEMA_VERSION)
    )
  })

  it('sollte keinen Schritt mit einer Zielversion oberhalb der Schemaversion führen', () => {
    // Das ist der Fall, den die entfernte Laufzeitprüfung eigentlich meinte:
    // Schrittliste und Schemaversion laufen auseinander. Er gehört hierher —
    // in einen Test der Liste — und nicht in einen Wurf, der den Nutzer trifft.
    for (const step of migrations) {
      expect(step.toVersion).toBeLessThanOrEqual(LOCAL_STORE_SCHEMA_VERSION)
    }
  })
})
