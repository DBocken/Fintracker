import { idbGet, idbSet, idbKeys, migrateLocalStorageToIdb, requestPersistentStorage } from './idb-kv'
import { ENCRYPTED_STORAGE_KEYS } from './local-storage-keys'
import { t } from '../i18n/serviceT'

// --- Datenspeicher-Seam (Issue #29) ------------------------------------------
// Die (verschlüsselten) Bulk-Daten liegen in IndexedDB statt localStorage.
// Beim Lesen wird ein evtl. noch vorhandener localStorage-Altbestand transparent
// nach IndexedDB übernommen (lazy migration). Die kleine Verschlüsselungs-Config
// bleibt weiterhin in localStorage.

let persistenceRequested = false

async function readDataRaw(storageKey: string): Promise<string | null> {
  const fromIdb = await idbGet(storageKey)
  if (fromIdb != null) return fromIdb

  // Lazy-Migration: Altbestand aus localStorage übernehmen.
  if (typeof localStorage !== 'undefined') {
    const legacy = localStorage.getItem(storageKey)
    if (legacy != null) {
      await idbSet(storageKey, legacy)
      localStorage.removeItem(storageKey)
      return legacy
    }
  }
  return null
}

async function writeDataRaw(storageKey: string, raw: string): Promise<void> {
  await idbSet(storageKey, raw)
  if (typeof localStorage !== 'undefined') localStorage.removeItem(storageKey)
  if (!persistenceRequested) {
    persistenceRequested = true
    void requestPersistentStorage()
  }
}

export type LocalEncryptionConfigV1 = {
  v: 1
  enabled: true
  kdf: {
    name: 'PBKDF2'
    hash: 'SHA-256'
    iterations: number
    salt_b64: string
  }
  cipher: {
    name: 'AES-GCM'
    key_length: 256
  }
}

export type EncryptedEnvelopeV1 = {
  type: 'ausgabentracker.enc'
  v: 1
  kdf: {
    name: 'PBKDF2'
    hash: 'SHA-256'
    iterations: number
    salt_b64: string
  }
  cipher: {
    name: 'AES-GCM'
    iv_b64: string
  }
  ct_b64: string
}

const CONFIG_KEY = 'ausgabentracker_local_encryption_config_v1'
const CHECK_KEY = 'ausgabentracker_local_encryption_check_v1'

function b64encode(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  // Blockweise statt byteweiser String-Konkatenation: Der Ein-Blob-Store
  // verschlüsselt bei jeder Änderung die komplette Collection; byteweises
  // `s += fromCharCode(...)` dominierte dabei die Schreiblatenz (~0,9 s bei
  // 10k, ~6 s bei 50k Buchungen — F-PERF-1). 8-KB-Blöcke bleiben sicher unter
  // dem Argumentlimit von Function.prototype.apply.
  const CHUNK = 8192
  let s = ''
  for (let i = 0; i < u8.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, u8.subarray(i, i + CHUNK) as unknown as number[])
  }
  return btoa(s)
}

function b64decode(b64: string): Uint8Array {
  const s = atob(b64)
  const u8 = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i)
  return u8
}

function toWebCryptoBytes(u8: Uint8Array): Uint8Array<ArrayBuffer> {
  // WebCrypto in Node/jsdom and browsers can reject cross-realm ArrayBuffers.
  // A fresh Uint8Array backed by a concrete ArrayBuffer is accepted as
  // BufferSource in both environments and preserves the exact byte range.
  const bytes = new Uint8Array(new ArrayBuffer(u8.byteLength))
  bytes.set(u8)
  return bytes
}

function isEnvelopeV1(value: unknown): value is EncryptedEnvelopeV1 {
  return !!(
    value &&
    typeof value === 'object' &&
    (value as Record<string, unknown>).type === 'ausgabentracker.enc' &&
    (value as Record<string, unknown>).v === 1 &&
    typeof (value as Record<string, unknown>).ct_b64 === 'string'
  )
}

export class LocalEncryptionLockedError extends Error {
  name = 'LocalEncryptionLockedError'
  constructor(message: string = '') {
    super(message || t('crypto.lockedError'))
  }
}

// RES-1: Ein beschädigter Envelope (kaputtes JSON, fehlgeschlagene AES-GCM-
// Entschlüsselung, entschlüsselter Klartext ohne gültiges JSON) wurde bislang
// als „keine Daten" (`null`) gelesen — genau wie ein nicht existierender Key.
// Der nächste Schreibvorgang (Read-Modify-Write in upsertLocalFinanceItem)
// persistierte dann die fälschlich leere Liste und löschte den Bestand
// dauerhaft. `VaultCorruptError` macht diesen Fall vom „echten" Leerzustand
// unterscheidbar: `null` bedeutet ab jetzt ausschließlich „Key existiert
// nicht", jeder Lese-/Entschlüsselungsfehler bei vorhandenem Rohwert wirft.
export class VaultCorruptError extends Error {
  name = 'VaultCorruptError'
  storageKey: string
  constructor(storageKey: string, message: string = '') {
    super(message || t('crypto.corruptError'))
    this.storageKey = storageKey
  }
}

async function deriveKeyFromPassword(password: string, cfg: LocalEncryptionConfigV1): Promise<CryptoKey> {
  const salt = b64decode(cfg.kdf.salt_b64)

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    toWebCryptoBytes(new TextEncoder().encode(password)),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: cfg.kdf.hash,
      iterations: cfg.kdf.iterations,
      salt: toWebCryptoBytes(salt),
    },
    keyMaterial,
    { name: 'AES-GCM', length: cfg.cipher.key_length },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function encryptString(plaintext: string, key: CryptoKey, cfg: LocalEncryptionConfigV1): Promise<EncryptedEnvelopeV1> {
  const ivU8 = crypto.getRandomValues(new Uint8Array(12))
  const pt = toWebCryptoBytes(new TextEncoder().encode(plaintext))

  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toWebCryptoBytes(ivU8) }, key, pt)

  return {
    type: 'ausgabentracker.enc',
    v: 1,
    kdf: cfg.kdf,
    cipher: {
      name: 'AES-GCM',
      iv_b64: b64encode(ivU8),
    },
    ct_b64: b64encode(ct),
  }
}

async function decryptString(envelope: EncryptedEnvelopeV1, key: CryptoKey): Promise<string> {
  const iv = b64decode(envelope.cipher.iv_b64)
  const ct = b64decode(envelope.ct_b64)
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: toWebCryptoBytes(iv) }, key, toWebCryptoBytes(ct))
  return new TextDecoder().decode(pt)
}

function loadConfig(): LocalEncryptionConfigV1 | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(CONFIG_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed?.v === 1 && parsed?.enabled) return parsed as LocalEncryptionConfigV1
    return null
  } catch {
    return null
  }
}

function saveConfig(cfg: LocalEncryptionConfigV1) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg))
}

function clearConfig() {
  localStorage.removeItem(CONFIG_KEY)
}

export const localEncryption = {
  _key: null as CryptoKey | null,

  getConfig(): LocalEncryptionConfigV1 | null {
    return loadConfig()
  },

  isEnabled(): boolean {
    return !!loadConfig()
  },

  isUnlocked(): boolean {
    return this.isEnabled() && !!this._key
  },

  lock() {
    this._key = null
  },

  async enable(password: string): Promise<void> {
    if (typeof window === 'undefined') return

    const salt = crypto.getRandomValues(new Uint8Array(16))
    const cfg: LocalEncryptionConfigV1 = {
      v: 1,
      enabled: true,
      kdf: {
        name: 'PBKDF2',
        hash: 'SHA-256',
        iterations: 210_000,
        salt_b64: b64encode(salt),
      },
      cipher: {
        name: 'AES-GCM',
        key_length: 256,
      },
    }

    const key = await deriveKeyFromPassword(password, cfg)
    this._key = key
    saveConfig(cfg)

    // Store a check blob to validate passwords later.
    const checkPlain = JSON.stringify({ ok: true, created_at: new Date().toISOString() })
    const checkEnc = await encryptString(checkPlain, key, cfg)
    localStorage.setItem(CHECK_KEY, JSON.stringify(checkEnc))

    await migrateLocalStorageToIdb()
    await this.migrateFinanceKeys('encrypt')
  },

  async unlock(password: string): Promise<void> {
    if (typeof window === 'undefined') return

    const cfg = loadConfig()
    if (!cfg) {
      this._key = null
      return
    }

    const key = await deriveKeyFromPassword(password, cfg)

    const rawCheck = localStorage.getItem(CHECK_KEY)
    if (!rawCheck) {
      throw new Error(t('crypto.checkMissingError'))
    }

    let envelope: unknown
    try {
      envelope = JSON.parse(rawCheck)
    } catch {
      throw new Error(t('crypto.checkCorruptedError'))
    }

    if (!isEnvelopeV1(envelope)) {
      throw new Error(t('crypto.checkInvalidError'))
    }

    try {
      await decryptString(envelope, key)
    } catch {
      throw new Error(t('crypto.wrongPasswordError'))
    }

    this._key = key
  },

  async disable(password: string): Promise<void> {
    if (typeof window === 'undefined') return

    await this.unlock(password)

    // Decrypt known finance keys back to plaintext before disabling.
    await this.migrateFinanceKeys('decrypt')

    this._key = null
    localStorage.removeItem(CHECK_KEY)
    clearConfig()
  },

  requireUnlocked(): CryptoKey {
    const cfg = loadConfig()
    if (!cfg) throw new Error(t('crypto.notEnabledError'))
    if (!this._key) throw new LocalEncryptionLockedError()
    return this._key
  },

  async decryptEnvelope(envelope: EncryptedEnvelopeV1): Promise<string> {
    const key = this.requireUnlocked()
    return decryptString(envelope, key)
  },

  async encryptJson(value: unknown): Promise<EncryptedEnvelopeV1> {
    const cfg = loadConfig()
    if (!cfg) throw new Error(t('crypto.notEnabledError'))
    const key = this.requireUnlocked()
    return encryptString(JSON.stringify(value), key, cfg)
  },

  async decryptJson<T>(envelope: EncryptedEnvelopeV1): Promise<T> {
    const pt = await this.decryptEnvelope(envelope)
    return JSON.parse(pt) as T
  },

  async encryptAndStore(storageKey: string, value: unknown): Promise<void> {
    const cfg = loadConfig()
    if (!cfg) {
      await writeDataRaw(storageKey, JSON.stringify(value))
      return
    }

    const key = this.requireUnlocked()
    const envelope = await encryptString(JSON.stringify(value), key, cfg)
    await writeDataRaw(storageKey, JSON.stringify(envelope))
  },

  async loadAndMaybeDecrypt<T>(storageKey: string): Promise<T | null> {
    const raw = await readDataRaw(storageKey)
    if (!raw) return null

    const cfg = loadConfig()
    if (!cfg) {
      const value = JSON.parse(raw)
      // Defensiv-Guard (F-CRYPTO-1): Verschlüsselung ist aus, aber es liegt noch
      // ein Envelope vor (unvollständige disable()-Migration). Diesen NICHT als
      // Daten interpretieren oder als leere Liste behandeln — sonst würde der
      // nächste Schreibvorgang die noch verschlüsselten Daten überschreiben.
      if (isEnvelopeV1(value)) {
        throw new Error(t('crypto.migrateError'))
      }
      return value as T
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      // Rohwert ist vorhanden, aber kein JSON — ein früherer `return null` hier
      // sah aus wie „kein Eintrag" und liess den nächsten Schreibvorgang den
      // Bestand überschreiben (RES-1). Ein vorhandener, aber unlesbarer Rohwert
      // ist immer eine Korruption, nie ein leerer Zustand.
      throw new VaultCorruptError(storageKey)
    }

    if (isEnvelopeV1(parsed)) {
      try {
        return await this.decryptJson<T>(parsed)
      } catch (err) {
        // Ein gesperrter Vault ist keine Korruption — durchreichen, nicht
        // einwickeln (sonst könnte die Fläche „entsperren" nicht mehr von
        // „Backup einspielen" unterscheiden).
        if (err instanceof LocalEncryptionLockedError) throw err
        // Alles andere hier ist entweder ein AES-GCM-Auth-Fehler (verfälschter
        // `ct_b64`) oder Klartext, der nach der Entschlüsselung kein gültiges
        // JSON ergibt — in beiden Fällen ist der Envelope kaputt.
        throw new VaultCorruptError(storageKey)
      }
    }

    // Plain JSON while enabled: require unlock, then migrate in-place.
    const key = this.requireUnlocked()
    const value = parsed as T
    const envelope = await encryptString(JSON.stringify(value), key, cfg)
    await writeDataRaw(storageKey, JSON.stringify(envelope))
    return value
  },

  async migrateFinanceKeys(mode: 'encrypt' | 'decrypt'): Promise<void> {
    const cfg = loadConfig()
    if (!cfg) return

    const key = this.requireUnlocked()

    // Vollständige Registry (VE-6 / F-CRYPTO-1): frühere Handliste kannte nur 7
    // von ~24 Keys, wodurch disable() Budgets, Splits, Forderungen, Kategorien
    // u. v. m. als unlesbare Envelopes zurückließ (Datenverlust). Jetzt deckt die
    // Migration alle registrierten Keys ab.
    const sensitiveKeys = new Set<string>(ENCRYPTED_STORAGE_KEYS)

    const keys = (await idbKeys()).filter(
      (k) => sensitiveKeys.has(k) || k.startsWith('ausgabentracker_transactions_v2__'),
    )

    for (const storageKey of keys) {
      const raw = await idbGet(storageKey)
      if (!raw) continue

      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        continue
      }

      if (mode === 'encrypt') {
        if (isEnvelopeV1(parsed)) continue
        const envelope = await encryptString(JSON.stringify(parsed), key, cfg)
        await writeDataRaw(storageKey, JSON.stringify(envelope))
        continue
      }

      // decrypt
      if (!isEnvelopeV1(parsed)) continue
      const pt = await decryptString(parsed, key)
      await writeDataRaw(storageKey, pt)
    }
  },
}

// --- Standalone-Verschlüsselung (Issue #36) ----------------------------------
// Passwort-basiertes Verschlüsseln/Entschlüsseln OHNE den Zustand der lokalen
// At-Rest-Verschlüsselung anzufassen. Eine Implementierung für verschlüsselte
// Backups (#30) und das Vault-Format (#36) — gleiche Envelope-Struktur.

function freshStandaloneConfig(): LocalEncryptionConfigV1 {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return {
    v: 1,
    enabled: true,
    kdf: {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: 210_000,
      salt_b64: b64encode(salt),
    },
    cipher: {
      name: 'AES-GCM',
      key_length: 256,
    },
  }
}

export async function encryptJsonWithPassword(value: unknown, password: string): Promise<EncryptedEnvelopeV1> {
  if (!password) throw new Error(t('crypto.emptyPasswordError'))
  const cfg = freshStandaloneConfig()
  const key = await deriveKeyFromPassword(password, cfg)
  return encryptString(JSON.stringify(value), key, cfg)
}

export async function decryptJsonWithPassword<T>(envelope: EncryptedEnvelopeV1, password: string): Promise<T> {
  if (!isEnvelopeV1(envelope)) throw new Error(t('crypto.invalidFileError'))
  const cfg: LocalEncryptionConfigV1 = {
    v: 1,
    enabled: true,
    kdf: envelope.kdf,
    cipher: { name: 'AES-GCM', key_length: 256 },
  }
  const key = await deriveKeyFromPassword(password, cfg)
  let plaintext: string
  try {
    plaintext = await decryptString(envelope, key)
  } catch {
    throw new Error(t('crypto.wrongPasswordError'))
  }
  return JSON.parse(plaintext) as T
}

// Häufige, triviale Passwörter (bzw. deren Anfang) werden hart abgewertet.
const COMMON_PASSWORD_PREFIXES =
  /^(password|passwort|geheim|123456|12345678|qwertz|qwerty|asdfgh|111111|000000|abc123|letmein|admin|willkommen|welcome|iloveyou|monkey|dragon)/i

/**
 * Schätzt die Passwortstärke über die Shannon-Entropie (Länge × Zeichenraum),
 * abzüglich Strafen für Wiederholungen und einfache Sequenzen (abc, 123).
 * Ersetzt die frühere reine Längen-/Klassen-Heuristik (Issue #32): so wird
 * z. B. "aaaaaaaaaa" trotz Länge realistisch als schwach erkannt.
 *
 * @returns score 0–100 sowie ein Label (schwach < 36 bit ≤ mittel < 66 bit ≤ stark)
 */
export function estimatePasswordStrength(password: string): { score: number; label: string } {
  const p = password || ''
  if (!p) return { score: 0, label: 'schwach' }

  let pool = 0
  if (/[a-z]/.test(p)) pool += 26
  if (/[A-Z]/.test(p)) pool += 26
  if (/[0-9]/.test(p)) pool += 10
  if (/[^a-zA-Z0-9]/.test(p)) pool += 33

  // Effektive Länge: aufeinanderfolgende gleiche Zeichen und einfache
  // Sequenzen tragen weniger zur tatsächlichen Entropie bei.
  let effectiveLength = 0
  for (let i = 0; i < p.length; i++) {
    let factor = 1
    if (i > 0) {
      const diff = Math.abs(p.charCodeAt(i) - p.charCodeAt(i - 1))
      if (diff === 0) factor = 0.3 // Wiederholung (aaaa)
      else if (diff === 1) factor = 0.6 // Sequenz (abc, 123)
    }
    effectiveLength += factor
  }

  const bitsPerChar = pool > 1 ? Math.log2(pool) : 1
  let bits = effectiveLength * bitsPerChar

  if (COMMON_PASSWORD_PREFIXES.test(p)) {
    bits = Math.min(bits, 20)
  }

  const score = Math.max(0, Math.min(100, Math.round(bits * 1.15)))
  let label: string = 'schwach'
  if (bits >= 66) label = 'stark'
  else if (bits >= 36) label = 'mittel'

  return { score, label }
}