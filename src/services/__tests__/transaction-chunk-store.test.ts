import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Transaction } from '@/types'
import { UNKNOWN_QUARTER_KEY } from '@/lib/transaction-quarter'
import { clearLocalKvStore, idbGet, idbKeys, idbRemove, idbSet } from '../idb-kv'
import { VaultCorruptError, localEncryption } from '../local-crypto'
import { clearIntegrityReport, getIntegrityReport } from '../data-integrity-report'
import {
  ChunkMissingError,
  clearAllTransactionChunks,
  readAllTransactionChunks,
  readTransactionChunk,
  readTransactionChunkIndex,
  writeTransactionChunk,
} from '../transaction-chunk-store'

/**
 * WP 4.1b (PERF-1): Chunk-Speicherschicht + Index. Vorgabe:
 * `docs/architecture/transaction-storage-chunks.md` (ADR). Diese Schicht wird
 * hier NICHT scharf geschaltet — `transactionStorage` liest weiterhin den
 * v3-Blob (WP 4.1c).
 */

function tx(id: string, date: string): Transaction {
  return {
    id,
    date,
    amount: -12.34,
    payee: 'REWE',
    description: 'Einkauf',
    original_text: 'REWE Einkauf',
    category_id: null,
    auto_mapped: false,
    confirmed: true,
  }
}

beforeEach(async () => {
  // `localEncryption.lock()` löst über den Lock-Kanal (WP 4.1b) auch die
  // Chunk-Cache-Invalidierung dieser Schicht aus — Tests starten dadurch
  // sowohl mit gesperrtem Vault als auch mit leerem Chunk-Cache.
  localEncryption.lock()
  localStorage.clear()
  await clearLocalKvStore()
  clearIntegrityReport()
})

describe('transaction-chunk-store: Roundtrip (WP 4.1b, PERF-1)', () => {
  it('sollte einen geschriebenen Chunk identisch wieder lesen (unverschlüsselt)', async () => {
    const items = [tx('t1', '2026-01-15'), tx('t2', '2026-02-20')]
    await writeTransactionChunk('2026-Q1', items)

    const read = await readTransactionChunk('2026-Q1')
    expect(read).toEqual(items)
  })

  it('sollte bei aktiver Verschlüsselung roundtrip-fähig sein', async () => {
    await localEncryption.enable('correct horse battery staple')
    const items = [tx('t1', '2026-04-01')]
    await writeTransactionChunk('2026-Q2', items)

    const read = await readTransactionChunk('2026-Q2')
    expect(read).toEqual(items)
  })
})

describe('transaction-chunk-store: Index wird aus den Chunks abgeleitet (WP 4.1b, PERF-1)', () => {
  it('sollte je Quartal die tatsächliche Anzahl im Index führen', async () => {
    await writeTransactionChunk('2026-Q1', [tx('t1', '2026-01-15'), tx('t2', '2026-02-20')])
    await writeTransactionChunk('2026-Q2', [tx('t3', '2026-04-01')])
    await writeTransactionChunk(UNKNOWN_QUARTER_KEY, [tx('t4', '')])

    const index = await readTransactionChunkIndex()
    expect(index['2026-Q1']).toBe(2)
    expect(index['2026-Q2']).toBe(1)
    expect(index[UNKNOWN_QUARTER_KEY]).toBe(1)
  })

  it('[REGRESSION] sollte die Zählung bei erneutem Schreiben mit weniger Einträgen senken statt aufzuaddieren', async () => {
    // Beweist, dass der Index aus dem geschriebenen Chunk ABGELEITET wird
    // (dessen tatsächliche Länge), nicht eigenständig fortgeschrieben
    // (z. B. per Delta/Inkrement) — genau die Vorgabe der ADR.
    await writeTransactionChunk('2026-Q1', [tx('t1', '2026-01-15'), tx('t2', '2026-02-20')])
    await writeTransactionChunk('2026-Q1', [tx('t1', '2026-01-15')])

    const index = await readTransactionChunkIndex()
    expect(index['2026-Q1']).toBe(1)
  })
})

describe('[REGRESSION] fehlender Chunk trotz Index-Eintrag wirft (RES-1-Regel, WP 4.1b)', () => {
  it('sollte werfen statt eine Leerliste zu liefern, wenn ein indizierter Chunk physisch fehlt', async () => {
    await writeTransactionChunk('2026-Q3', [tx('t1', '2026-08-01')])
    // writeTransactionChunk hat den Cache für dieses Quartal bereits
    // verworfen — der nächste Lesevorgang geht wirklich auf die Ablage.
    // Simuliert Datenverlust: Chunk physisch entfernt, Index nennt ihn aber
    // weiterhin.
    await idbRemove('ausgabentracker_transactions_v4_2026-Q3')

    await expect(readTransactionChunk('2026-Q3')).rejects.toBeInstanceOf(ChunkMissingError)
  })

  it('sollte KEINE Leerliste liefern, wenn der Chunk fehlt aber indiziert ist', async () => {
    await writeTransactionChunk('2026-Q3', [tx('t1', '2026-08-01')])
    await idbRemove('ausgabentracker_transactions_v4_2026-Q3')

    let threw = false
    let result: Transaction[] | undefined
    try {
      result = await readTransactionChunk('2026-Q3')
    } catch {
      threw = true
    }

    expect(threw).toBe(true)
    expect(result).toBeUndefined()
  })
})

describe('transaction-chunk-store: kaputte Items werden übersprungen und gezählt (WP 4.1b, PERF-1)', () => {
  it('sollte ein einzelnes kaputtes Item überspringen, der Rest des Chunks bleibt lesbar', async () => {
    const good = [tx('t1', '2026-05-01'), tx('t2', '2026-05-02')]
    const broken = { ...tx('t3', '2026-05-03'), amount: 'kaputt' }
    await idbSet('ausgabentracker_transactions_v4_2026-Q2', JSON.stringify([...good, broken]))

    const items = await readTransactionChunk('2026-Q2')

    expect(items.map((i) => i.id).sort()).toEqual(['t1', 't2'])
    expect(getIntegrityReport()).toEqual([{ key: 'transactions:2026-Q2', skipped: 1 }])
  })

  it('gute Chunks ohne kaputte Items lösen KEINEN Bericht aus', async () => {
    await writeTransactionChunk('2026-Q2', [tx('t1', '2026-05-01')])
    await readTransactionChunk('2026-Q2')

    expect(getIntegrityReport()).toEqual([])
  })
})

describe('transaction-chunk-store: Chunk-Cache (WP 4.1b, ADR "Chunk-Cache")', () => {
  it('sollte beim zweiten Lesen desselben Quartals NICHT erneut entschlüsseln', async () => {
    await localEncryption.enable('correct horse battery staple')
    await writeTransactionChunk('2026-Q1', [tx('t1', '2026-01-15')])

    const spy = vi.spyOn(localEncryption, 'loadAndMaybeDecrypt')

    const first = await readTransactionChunk('2026-Q1')
    const callsAfterFirstRead = spy.mock.calls.length
    expect(callsAfterFirstRead).toBeGreaterThan(0)

    const second = await readTransactionChunk('2026-Q1')

    expect(spy.mock.calls.length).toBe(callsAfterFirstRead)
    expect(second).toEqual(first)

    spy.mockRestore()
  })

  it('sollte bei einer Einzeländerung nur das betroffene Quartal verwerfen — andere bleiben warm', async () => {
    await localEncryption.enable('correct horse battery staple')
    await writeTransactionChunk('2026-Q1', [tx('t1', '2026-01-15')])
    await writeTransactionChunk('2026-Q2', [tx('t2', '2026-04-01')])

    // Beide Quartale einmal lesen, um den Cache zu wärmen.
    await readTransactionChunk('2026-Q1')
    await readTransactionChunk('2026-Q2')

    // Einzeländerung in Q1.
    await writeTransactionChunk('2026-Q1', [tx('t1', '2026-01-15'), tx('t1b', '2026-01-20')])

    const spy = vi.spyOn(localEncryption, 'loadAndMaybeDecrypt')

    await readTransactionChunk('2026-Q2') // weiterhin warm -> kein Entschlüsselungsvorgang
    expect(spy).not.toHaveBeenCalled()

    await readTransactionChunk('2026-Q1') // verworfen -> erneuter Entschlüsselungsvorgang
    expect(spy).toHaveBeenCalled()

    spy.mockRestore()
  })
})

describe('readAllTransactionChunks: Vollesen (WP 4.1c, PERF-1)', () => {
  it('[REGRESSION] ein Chunk, der physisch existiert aber NICHT im Index steht, darf beim Vollesen nicht fehlen — Index wird berichtigt', async () => {
    // ADR "Der Index bestimmt die Zählung, nicht die Menge": die
    // Schreibreihenfolge (Chunk zuerst, Index danach) kann genau diesen
    // Zustand hinterlassen — die Menge der Chunks MUSS über idbKeys()
    // bestimmt werden, niemals aus dem Index.
    await writeTransactionChunk('2026-Q1', [tx('t1', '2026-01-15')])
    // Simuliert: der Chunk für Q2 ist physisch da, aber sein Index-Update ist
    // nie passiert (z. B. Abbruch zwischen Chunk- und Index-Write).
    await idbSet('ausgabentracker_transactions_v4_2026-Q2', JSON.stringify([tx('t2', '2026-04-01')]))

    const indexBefore = await readTransactionChunkIndex()
    expect(indexBefore['2026-Q2']).toBeUndefined()

    const all = await readAllTransactionChunks()
    expect(all.map((t) => t.id).sort()).toEqual(['t1', 't2'])

    const indexAfter = await readTransactionChunkIndex()
    expect(indexAfter['2026-Q2']).toBe(1)
  })

  it('sollte bei bereits korrektem Index KEINEN zusätzlichen Schreibvorgang auslösen', async () => {
    await writeTransactionChunk('2026-Q1', [tx('t1', '2026-01-15')])
    await readAllTransactionChunks() // wärmt den Cache, Index ist bereits korrekt

    const spy = vi.spyOn(localEncryption, 'encryptAndStore')
    await readAllTransactionChunks()
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('[REGRESSION] ein im Index genannter, physisch fehlender Chunk wirft auch beim Vollesen (RES-1) statt seine Buchungen stillschweigend zu verlieren', async () => {
    await writeTransactionChunk('2026-Q1', [tx('t1', '2026-01-15')])
    await writeTransactionChunk('2026-Q3', [tx('t2', '2026-08-01')])
    await idbRemove('ausgabentracker_transactions_v4_2026-Q3')

    await expect(readAllTransactionChunks()).rejects.toBeInstanceOf(ChunkMissingError)
  })

  it('[REGRESSION] eine kaputte Chunk-Entschlüsselung wirft (WP 1.1-Klasse) statt den Chunk wie ein Einzel-Item zu überspringen', async () => {
    // Granularitäts-Entscheidung (WP 4.1c, s. readAllTransactionChunks): ein
    // einzelnes kaputtes ITEM wird übersprungen (WP 1.2), ein ganzer kaputter
    // CHUNK (bis zu einem Quartal Buchungen) wirft (WP 1.1) — sonst wäre ein
    // stiller Verlust von potenziell Hunderten Buchungen möglich.
    await localEncryption.enable('correct horse battery staple')
    await writeTransactionChunk('2026-Q1', [tx('t1', '2026-01-15')])

    const chunkKey = 'ausgabentracker_transactions_v4_2026-Q1'
    const raw = await idbGet(chunkKey)
    const envelope = JSON.parse(raw!)
    // Ciphertext verfälschen -> AES-GCM-Authentifizierung schlägt fehl
    // (echte Korruption, kein Parsing-Fehler).
    envelope.ct_b64 = envelope.ct_b64.slice(0, -4) + (envelope.ct_b64.slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA')
    await idbSet(chunkKey, JSON.stringify(envelope))

    await expect(readAllTransactionChunks()).rejects.toBeInstanceOf(VaultCorruptError)
  })
})

describe('clearAllTransactionChunks (WP 4.1c)', () => {
  it('sollte alle physischen v4-Schlüssel (Chunks + Index) und den Cache entfernen', async () => {
    await writeTransactionChunk('2026-Q1', [tx('t1', '2026-01-15')])
    await writeTransactionChunk('2026-Q2', [tx('t2', '2026-04-01')])
    await readTransactionChunk('2026-Q1') // Cache wärmen

    await clearAllTransactionChunks()

    const remaining = (await idbKeys()).filter((k) => k.startsWith('ausgabentracker_transactions_v4_'))
    expect(remaining).toEqual([])
    expect(await readTransactionChunkIndex()).toEqual({})
    expect(await readTransactionChunk('2026-Q1')).toEqual([]) // kein Leck aus dem vorherigen Cache
  })
})

describe('local-crypto enable()/disable()/Rewrap decken die Chunk-Ablage ab (WP 4.1c)', () => {
  const PW = 'correct horse battery staple'

  it('[REGRESSION] disable() entschlüsselt Chunks UND Index zurück (kein Datenverlust wie bei der alten 7er-Handliste, VE-6)', async () => {
    await localEncryption.enable(PW)
    await writeTransactionChunk('2026-Q1', [tx('t1', '2026-01-15')])
    const chunkKey = 'ausgabentracker_transactions_v4_2026-Q1'
    const indexKey = 'ausgabentracker_transactions_v4_index'
    expect(JSON.parse((await idbGet(chunkKey))!).type).toBe('ausgabentracker.enc')
    expect(JSON.parse((await idbGet(indexKey))!).type).toBe('ausgabentracker.enc')

    await localEncryption.disable(PW)

    expect(JSON.parse((await idbGet(chunkKey))!).type).not.toBe('ausgabentracker.enc')
    expect(JSON.parse((await idbGet(indexKey))!).type).not.toBe('ausgabentracker.enc')
  })

  it('[REGRESSION] enable() verschlüsselt einen bereits vorhandenen Klartext-Chunk sofort', async () => {
    const chunkKey = 'ausgabentracker_transactions_v4_2026-Q1'
    await idbSet(chunkKey, JSON.stringify([tx('t1', '2026-01-15')]))

    await localEncryption.enable(PW)

    expect(JSON.parse((await idbGet(chunkKey))!).type).toBe('ausgabentracker.enc')
  })
})

describe('transaction-chunk-store: lock() verwirft den GESAMTEN Cache (WP 4.1b, ADR "Chunk-Cache")', () => {
  it('sollte nach lock() (und erneutem unlock()) wieder entschlüsseln — auch für zuvor warme Quartale', async () => {
    await localEncryption.enable('correct horse battery staple')
    const q1Items = [tx('t1', '2026-01-15')]
    const q2Items = [tx('t2', '2026-04-01')]
    await writeTransactionChunk('2026-Q1', q1Items)
    await writeTransactionChunk('2026-Q2', q2Items)

    // Beide Quartale wärmen.
    await readTransactionChunk('2026-Q1')
    await readTransactionChunk('2026-Q2')

    localEncryption.lock()
    await localEncryption.unlock('correct horse battery staple')

    const spy = vi.spyOn(localEncryption, 'loadAndMaybeDecrypt')

    const q1AfterUnlock = await readTransactionChunk('2026-Q1')
    const q2AfterUnlock = await readTransactionChunk('2026-Q2')

    expect(spy).toHaveBeenCalled()
    expect(q1AfterUnlock).toEqual(q1Items)
    expect(q2AfterUnlock).toEqual(q2Items)

    spy.mockRestore()
  })
})
