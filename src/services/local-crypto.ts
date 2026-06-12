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
  let s = ''
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i])
  return btoa(s)
}

function b64decode(b64: string): Uint8Array {
  const s = atob(b64)
  const u8 = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i)
  return u8
}

function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  // Ensure we pass a concrete ArrayBuffer (not SharedArrayBuffer/ArrayBufferLike) to WebCrypto APIs.
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer
}

function isEnvelopeV1(value: unknown): value is EncryptedEnvelopeV1 {
  return !!(
    value &&
    typeof value === 'object' &&
    (value as any).type === 'ausgabentracker.enc' &&
    (value as any).v === 1 &&
    typeof (value as any).ct_b64 === 'string'
  )
}

export class LocalEncryptionLockedError extends Error {
  name = 'LocalEncryptionLockedError'
  constructor(message: string = 'Lokale Verschlüsselung ist aktiv – bitte zuerst entsperren.') {
    super(message)
  }
}

async function deriveKeyFromPassword(password: string, cfg: LocalEncryptionConfigV1): Promise<CryptoKey> {
  const salt = b64decode(cfg.kdf.salt_b64)

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(new TextEncoder().encode(password)),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: cfg.kdf.hash,
      iterations: cfg.kdf.iterations,
      salt: toArrayBuffer(salt),
    },
    keyMaterial,
    { name: 'AES-GCM', length: cfg.cipher.key_length },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function encryptString(plaintext: string, key: CryptoKey, cfg: LocalEncryptionConfigV1): Promise<EncryptedEnvelopeV1> {
  const ivU8 = crypto.getRandomValues(new Uint8Array(12))
  const pt = toArrayBuffer(new TextEncoder().encode(plaintext))

  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(ivU8) }, key, pt)

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
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, key, toArrayBuffer(ct))
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
      throw new Error('Verschlüsselungs-Check fehlt – bitte Verschlüsselung neu aktivieren.')
    }

    let envelope: unknown
    try {
      envelope = JSON.parse(rawCheck)
    } catch {
      throw new Error('Verschlüsselungs-Check beschädigt – bitte Verschlüsselung neu aktivieren.')
    }

    if (!isEnvelopeV1(envelope)) {
      throw new Error('Verschlüsselungs-Check ungültig – bitte Verschlüsselung neu aktivieren.')
    }

    try {
      await decryptString(envelope, key)
    } catch {
      throw new Error('Falsches Passwort')
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
    if (!cfg) throw new Error('Lokale Verschlüsselung ist nicht aktiv.')
    if (!this._key) throw new LocalEncryptionLockedError()
    return this._key
  },

  async decryptEnvelope(envelope: EncryptedEnvelopeV1): Promise<string> {
    const key = this.requireUnlocked()
    return decryptString(envelope, key)
  },

  async encryptJson(value: unknown): Promise<EncryptedEnvelopeV1> {
    const cfg = loadConfig()
    if (!cfg) throw new Error('Lokale Verschlüsselung ist nicht aktiv.')
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
      localStorage.setItem(storageKey, JSON.stringify(value))
      return
    }

    const key = this.requireUnlocked()
    const envelope = await encryptString(JSON.stringify(value), key, cfg)
    localStorage.setItem(storageKey, JSON.stringify(envelope))
  },

  async loadAndMaybeDecrypt<T>(storageKey: string): Promise<T | null> {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return null

    const cfg = loadConfig()
    if (!cfg) {
      return JSON.parse(raw) as T
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return null
    }

    if (isEnvelopeV1(parsed)) {
      return await this.decryptJson<T>(parsed)
    }

    // Plain JSON while enabled: require unlock, then migrate in-place.
    const key = this.requireUnlocked()
    const value = parsed as T
    const envelope = await encryptString(JSON.stringify(value), key, cfg)
    localStorage.setItem(storageKey, JSON.stringify(envelope))
    return value
  },

  async migrateFinanceKeys(mode: 'encrypt' | 'decrypt'): Promise<void> {
    const cfg = loadConfig()
    if (!cfg) return

    const key = this.requireUnlocked()

    const sensitiveKeys = new Set([
      'ausgabentracker_transactions_v3',
      'ausgabentracker_accounts_v1',
      'ausgabentracker_debts_v1',
      'ausgabentracker_debt_assignments_v1',
      'ausgabentracker_portfolios_v1',
      'ausgabentracker_portfolio_positions_v1',
      'ausgabentracker_bank_connections_v1',
    ])

    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k) continue
      if (k.startsWith('ausgabentracker_transactions_v2__')) keys.push(k)
      if (sensitiveKeys.has(k)) keys.push(k)
    }

    for (const storageKey of keys) {
      const raw = localStorage.getItem(storageKey)
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
        localStorage.setItem(storageKey, JSON.stringify(envelope))
        continue
      }

      // decrypt
      if (!isEnvelopeV1(parsed)) continue
      const pt = await decryptString(parsed, key)
      localStorage.setItem(storageKey, pt)
    }
  },
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