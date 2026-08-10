import type { Transaction } from '@/types'
import { transactionSchema } from '@/lib/schemas/transaction.schema'
import { type QuarterKey } from '@/lib/transaction-quarter'
import { recordSkipped } from './data-integrity-report'
import { idbKeys, idbRemove } from './idb-kv'
import { TRANSACTION_CHUNK_KEY_PREFIX } from './local-storage-keys'
import {
  LocalEncryptionLockedError,
  VaultCorruptError,
  localEncryption,
  onLocalEncryptionLock,
} from './local-crypto'
import { t } from '@/i18n/serviceT'

/**
 * Chunk-Speicherschicht für Transaktionen (PERF-1, WP 4.1b/4.1c).
 *
 * Vorgabe: `docs/architecture/transaction-storage-chunks.md` (ADR) —
 * verbindlich, nicht neu zu entscheiden. WP 4.1b hat diese Schicht gebaut,
 * aber noch nicht scharf geschaltet. **WP 4.1c schaltet sie scharf:**
 * `transactionStorage` (`transaction-storage-service.ts`) liest/schreibt ab
 * jetzt hierüber, sobald der v3-Blob migriert (entfernt) ist — siehe dort
 * (`hasLegacyV3Blob`) und den Migrationsschritt in `local-store-migrations.ts`.
 */

const CHUNK_KEY_PREFIX = TRANSACTION_CHUNK_KEY_PREFIX
const INDEX_KEY = `${CHUNK_KEY_PREFIX}index`

function chunkStorageKey(quarter: QuarterKey): string {
  return `${CHUNK_KEY_PREFIX}${quarter}`
}

/** Trägt je bekanntem Quartal die Anzahl der darin gespeicherten Buchungen. */
export type TransactionChunkIndex = Record<QuarterKey, number>

// RES-1-Regel (WP 1.1, hier übertragen auf die Chunk-Ablage): Der Index ist
// Wegweiser, nicht Wahrheit. Nennt er einen Chunk, der physisch nicht
// existiert, ist das ein Fehler — niemals eine Leerliste, denn eine
// Leerliste sieht für jeden Aufrufer identisch aus wie "dieses Quartal hatte
// nie Buchungen" und würde den nächsten Schreibvorgang den echten Bestand
// überschreiben lassen.
export class ChunkMissingError extends Error {
  name = 'ChunkMissingError'
  quarter: QuarterKey
  constructor(quarter: QuarterKey, message: string = '') {
    super(message || t('transactionChunkStore.chunkMissingError'))
    this.quarter = quarter
  }
}

// --- Chunk-Cache (ADR "Chunk-Cache") -----------------------------------------
// `Map<Quartal, Transaction[]>` im Modul-Zustand. Ein Schreibvorgang verwirft
// GENAU das betroffene Quartal (siehe writeTransactionChunk). Beim `lock()` —
// auch dem automatischen aus WP 3.2 — wird der GANZE Cache verworfen: ein
// entschlüsselter Bestand darf einen Lock nicht überleben, sonst wäre der
// Auto-Lock eine Anzeige ohne Wirkung (dieselbe Fehlerklasse wie
// `nachpruefung.md` 3.b, siehe ADR). `local-crypto.ts` kennt diese Schicht
// nicht (Schichtregel: services untereinander dürfen sich kennen, aber der
// Lock-Kanal ist bewusst generisch gehalten, dasselbe Muster wie
// `onLocalEncryptionActivity`/`onLocalEncryptionWriteSettled` aus WP 3.2) —
// deshalb hängt sich diese Schicht über den Lock-Kanal ein, statt eine zweite
// Bauform zu erfinden.
const chunkCache = new Map<QuarterKey, Transaction[]>()

onLocalEncryptionLock(() => {
  chunkCache.clear()
})

function requireUnlockedIfEncrypted(): void {
  if (localEncryption.isEnabled() && !localEncryption.isUnlocked()) {
    throw new LocalEncryptionLockedError()
  }
}

async function readIndex(): Promise<TransactionChunkIndex> {
  const data = await localEncryption.loadAndMaybeDecrypt<TransactionChunkIndex>(INDEX_KEY)
  if (data === null) return {}
  if (typeof data !== 'object' || Array.isArray(data)) throw new VaultCorruptError(INDEX_KEY)
  return data
}

async function writeIndex(index: TransactionChunkIndex): Promise<void> {
  await localEncryption.encryptAndStore(INDEX_KEY, index)
}

/**
 * Liest den Index (Wegweiser, s.o.). Öffentlich, damit Aufrufer (und Tests)
 * prüfen können, dass er tatsächlich aus den geschriebenen Chunks abgeleitet
 * ist, statt eigenständig fortgeschrieben zu werden (ADR).
 */
export async function readTransactionChunkIndex(): Promise<TransactionChunkIndex> {
  requireUnlockedIfEncrypted()
  return readIndex()
}

// Liest EINEN Chunk roh von der Ablage — validiert Items an der Lesegrenze
// wie `transaction-storage-service.ts` (`getLocalTransactions`) es für den
// v3-Blob bereits tut: kaputte Items werden übersprungen und gezählt
// (`recordSkipped`), nie still verworfen, nie reisst ein einzelnes kaputtes
// Item den ganzen Chunk mit. `null` heißt hier ausschließlich "kein
// physischer Chunk unter diesem Schlüssel" — der Aufrufer entscheidet anhand
// des Index, ob das ein echter Leerzustand oder RES-1 ist.
async function readChunkRaw(quarter: QuarterKey): Promise<Transaction[] | null> {
  const storageKey = chunkStorageKey(quarter)
  const data = await localEncryption.loadAndMaybeDecrypt<Transaction[]>(storageKey)
  if (data === null) return null
  if (!Array.isArray(data)) throw new VaultCorruptError(storageKey)

  const valid: Transaction[] = []
  let skipped = 0
  for (const item of data) {
    const result = transactionSchema.safeParse(item)
    if (result.success) {
      valid.push(result.data as Transaction)
    } else {
      skipped += 1
    }
  }
  // Eigener Schlüssel je Quartal (nicht `'transactions'` wie beim v3-Blob):
  // Diese Schicht existiert noch NEBEN dem v3-Blob (WP 4.1b schaltet nicht
  // um) — ein gemeinsamer Berichts-Schlüssel würde die beiden Lesevorgänge
  // gegenseitig überschreiben.
  recordSkipped(`transactions:${quarter}`, skipped)
  return valid
}

/**
 * Liest einen Quartals-Chunk. Ein zweites Lesen desselben Quartals bedient
 * sich aus dem Cache — kein weiterer Entschlüsselungsvorgang (ADR
 * "Chunk-Cache", die eigentliche Motivation des Umbaus).
 */
export async function readTransactionChunk(quarter: QuarterKey): Promise<Transaction[]> {
  requireUnlockedIfEncrypted()

  const cached = chunkCache.get(quarter)
  if (cached) return cached

  const index = await readIndex()
  const chunk = await readChunkRaw(quarter)

  if (chunk === null) {
    if (Object.prototype.hasOwnProperty.call(index, quarter)) {
      // RES-1-Regel: im Index genannt, aber physisch nicht vorhanden — ein
      // Fehler, keine Leerliste (siehe ChunkMissingError oben).
      throw new ChunkMissingError(quarter)
    }
    // Echt unbekanntes Quartal (nie geschrieben, auch nicht im Index): ein
    // legitimer Leerzustand, wird selbst gecacht, damit ein wiederholtes
    // Nachfragen nach einem tatsächlich leeren Quartal ebenfalls billig ist.
    chunkCache.set(quarter, [])
    return []
  }

  chunkCache.set(quarter, chunk)
  return chunk
}

/**
 * Schreibt einen Quartals-Chunk und pflegt den Index NACH dem Chunk.
 *
 * Reihenfolge-Entscheidung für den laufenden Betrieb (die ADR legt diese
 * Reihenfolge nur für den einmaligen Migrationslauf fest — hier gilt
 * dieselbe Disziplin für JEDEN Einzelschreibvorgang): Der Chunk wird ZUERST
 * geschrieben, der Index ZULETZT. Bricht der Vorgang zwischen beiden Schritten
 * ab (Tab geschlossen, Stromausfall), bleibt der frisch geschriebene Chunk
 * bereits die korrekte, lesbare Wahrheit — der Index ist höchstens noch
 * veraltet (eine falsche Zählung für dieses Quartal, im schlimmsten Fall
 * fehlt ein brandneues Quartal ganz im Index). Beides ist harmlos: eine
 * veraltete Zählung ist kein RES-1-Fall, und ein im Index FEHLENDES, aber
 * physisch VORHANDENES Quartal wird beim nächsten expliziten Lesen dieses
 * Quartals trotzdem korrekt gefunden (siehe readTransactionChunk: die
 * RES-1-Prüfung greift nur, wenn der Index einen Chunk nennt, den es nicht
 * gibt — nicht umgekehrt). Die andere Reihenfolge (Index zuerst) hätte das
 * gefährliche Loch: ein Absturz nach dem Index-Update, aber vor dem
 * Chunk-Write, hinterließe genau den RES-1-Fall — einen im Index genannten,
 * aber nie geschriebenen Chunk.
 */
export async function writeTransactionChunk(quarter: QuarterKey, transactions: Transaction[]): Promise<void> {
  requireUnlockedIfEncrypted()

  await localEncryption.encryptAndStore(chunkStorageKey(quarter), transactions)

  // Cache-Invalidierung nach dem Schreiben: verwirft GENAU das betroffene
  // Quartal, alle anderen Einträge bleiben warm (ADR "Chunk-Cache").
  chunkCache.delete(quarter)

  // Index wird IMMER aus dem gerade geschriebenen Chunk abgeleitet (dessen
  // tatsächliche Länge), nie eigenständig fortgeschrieben (z. B. per
  // Delta/Inkrement) — genau die Vorgabe der ADR.
  const index = await readIndex()
  index[quarter] = transactions.length
  await writeIndex(index)
}

/**
 * Liest den GESAMTEN Transaktionsbestand über alle Quartals-Chunks (WP 4.1c,
 * "Vollesen"). Zentrale ADR-Vorgabe ("Der Index bestimmt die Zählung, nicht
 * die Menge"): welche Chunks es gibt, wird über `idbKeys()` und das
 * Schlüsselpräfix bestimmt — NIEMALS aus dem Index. Die Schreibreihenfolge
 * (Chunk zuerst, Index danach) kann einen Chunk hinterlassen, den der Index
 * nicht nennt; wer die Menge aus dem Index ableitet, verliert dessen
 * Buchungen lautlos (dieselbe Fehlerklasse wie RES-1, nur eine Ebene höher).
 *
 * Zwei Sicherungen, beide aus der ADR:
 * - Ein im Index genannter, aber physisch fehlender Chunk ist der klassische
 *   RES-1-Fall (WP 1.1) — er wirft (`ChunkMissingError`), statt die
 *   zugehörigen Buchungen still aus dem Gesamtbestand zu entfernen.
 * - Ein physisch vorhandener, aber im Index NICHT genannter Chunk wird
 *   mitgelesen, und der Index wird dabei berichtigt ("… und der Index dabei
 *   berichtigt", ADR-Wortlaut) — aber nur, wenn eine Abweichung tatsächlich
 *   vorliegt, damit ein normales Vollesen im Regelfall keinen zusätzlichen
 *   Schreibvorgang auslöst.
 *
 * **Granularität einer Chunk-Korruption (Denk-mit-Frage, WP 4.1c):** Ein
 * einzelnes kaputtes ITEM innerhalb eines lesbaren Chunks wird — wie überall
 * sonst (WP 1.2) — übersprungen, gezählt und gemeldet (`readChunkRaw`,
 * unverändert). Scheitert aber die Entschlüsselung/das Parsen eines GANZEN
 * Chunks (`VaultCorruptError`), wird das NICHT wie ein einzelnes Item
 * übersprungen, sondern wirft — wie der komplette v3-Envelope in WP 1.1. Ein
 * Chunk trägt bis zu einem Quartal Buchungen (potenziell Hunderte); ihn beim
 * Vollesen still zu überspringen wäre keine Fehlertoleranz mehr, sondern
 * genau der stille Bestandsverlust, den RES-1 verhindern soll. Diese Wahl
 * erfordert keinen eigenen Code: `readChunkRaw`/`loadAndMaybeDecrypt` werfen
 * bereits `VaultCorruptError`, und diese Funktion fängt sie bewusst NICHT ab
 * — der Fehler erreicht `getTransactions()` als Fehlerzustand (RES-1-Kette),
 * nie als leerer/unvollständiger Bestand.
 */
export async function readAllTransactionChunks(): Promise<Transaction[]> {
  requireUnlockedIfEncrypted()

  const allKeys = await idbKeys()
  const physicalQuarters = allKeys.filter((k) => k.startsWith(CHUNK_KEY_PREFIX) && k !== INDEX_KEY) as QuarterKey[]
  const physicalSet = new Set(physicalQuarters.map((k) => k.slice(CHUNK_KEY_PREFIX.length)))

  const index = await readIndex()
  // RES-1 auch für das Vollesen: ein im Index genannter, physisch fehlender
  // Chunk darf nicht stillschweigend aus dem Gesamtbestand verschwinden (der
  // Schreibpfad garantiert normalerweise "Chunk vor Index" — dieser Fall
  // entsteht nur durch externe Korruption/manuelles Löschen, s. Tests).
  for (const quarter of Object.keys(index)) {
    if (!physicalSet.has(quarter)) {
      throw new ChunkMissingError(quarter)
    }
  }

  const result: Transaction[] = []
  const actualCounts: TransactionChunkIndex = {}
  for (const storageKey of physicalQuarters) {
    const quarter = storageKey.slice(CHUNK_KEY_PREFIX.length)
    let items = chunkCache.get(quarter)
    if (!items) {
      // Physisch vorhanden (kommt aus idbKeys()) — kein RES-1-Fall möglich,
      // deshalb roh lesen statt über readTransactionChunk (spart den dortigen
      // zweiten Index-Read je Quartal, s.o. "kaltes Vollesen" in der ADR).
      items = (await readChunkRaw(quarter)) ?? []
      chunkCache.set(quarter, items)
    }
    result.push(...items)
    actualCounts[quarter] = items.length
  }

  const indexKeys = Object.keys(index)
  const indexIsStale =
    indexKeys.length !== Object.keys(actualCounts).length ||
    indexKeys.some((quarter) => index[quarter] !== actualCounts[quarter])
  if (indexIsStale) {
    await writeIndex(actualCounts)
  }

  return result
}

/**
 * Setzt die gesamte Chunk-Ablage zurück: entfernt jeden physischen
 * v4-Schlüssel (Chunks + Index) und den In-Memory-Cache. Für
 * `transactionStorage.clearLocalCache()` (WP 4.1c) — ohne das würde ein
 * zwischen Tests wiederverwendeter IndexedDB-Store Buchungen aus einem
 * früheren Test/einer früheren Session in den nächsten Lauf hineinlecken,
 * sobald `transactionStorage` auf diese Schicht schreibt.
 */
export async function clearAllTransactionChunks(): Promise<void> {
  const allKeys = await idbKeys()
  const chunkKeys = allKeys.filter((k) => k.startsWith(CHUNK_KEY_PREFIX))
  for (const key of chunkKeys) {
    await idbRemove(key)
  }
  chunkCache.clear()
}
