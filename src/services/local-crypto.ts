import { idbGet, idbSet, idbKeys, migrateLocalStorageToIdb, requestAndRecordPersistentStorage } from './idb-kv'
import { ENCRYPTED_STORAGE_KEYS } from './local-storage-keys'
import { t } from '../i18n/serviceT'

// --- Datenspeicher-Seam (Issue #29) ------------------------------------------
// Die (verschlüsselten) Bulk-Daten liegen in IndexedDB statt localStorage.
// Beim Lesen wird ein evtl. noch vorhandener localStorage-Altbestand transparent
// nach IndexedDB übernommen (lazy migration). Die kleine Verschlüsselungs-Config
// bleibt weiterhin in localStorage.

let persistenceRequested = false

// --- Aktivitäts-Kanal für Auto-Lock (WP 3.2 / SEC-2) -------------------------
// Jeder tatsächliche Schreibvorgang in den verschlüsselten Bestand zählt als
// Aktivität — nicht nur Maus-/Tastatur-/Touch-Ereignisse. Ohne das würde ein
// langer Import oder eine Massenumschlüsselung (migrateFinanceKeys,
// rewrapIfNeeded — beide schreiben mehrfach über writeDataRaw, oft ohne dass
// währenddessen irgendein DOM-Ereignis auftritt) vom Inaktivitäts-Timer
// mittendrin unterbrochen: der nächste Schreibversuch träfe auf einen bereits
// gesperrten Tresor (`requireUnlocked()` wirft dann) und bräche ab — ein Lock
// mitten im Schreibvorgang wäre schlimmer als gar kein Auto-Lock. `local-
// crypto.ts` kennt React nicht (Schichtregel: services → hooks, nicht
// umgekehrt) — deshalb ein einfacher, framework-loser Listener-Kanal, den
// `LocalEncryptionProvider` zusätzlich zu den DOM-Aktivitätsereignissen
// abonniert. Freie Funktion statt Methode auf `localEncryption`, damit die
// Referenz über die App-Laufzeit stabil bleibt (kein `this`-Rebind-Risiko,
// wenn der Provider sie direkt als `extraActivity`-Prop weiterreicht).
const activityListeners = new Set<() => void>()

/** Meldet sich für den Aktivitäts-Kanal an; der Rückgabewert meldet ab. */
export function onLocalEncryptionActivity(listener: () => void): () => void {
  activityListeners.add(listener)
  return () => {
    activityListeners.delete(listener)
  }
}

function pulseActivity(): void {
  for (const listener of activityListeners) listener()
}

// --- "Schreibvorgang läuft"-Zähler für den Lock-bei-Tab-Wechsel (WP 3.2) ----
// Anders als der Inaktivitäts-Timer wird `visibilitychange` → `hidden` NICHT
// durch einen Aktivitäts-Puls aufgeschoben — der Puls verschiebt nur einen
// künftigen Timer, er verhindert kein sofortiges Ereignis. Ein mehrteiliger
// Schreibvorgang (`restoreLocalCollections` in backup-service.ts iteriert
// z.B. mehrere Collections nacheinander mit je einem eigenen `await
// writeLocalFinanceList(...)`) hätte sonst ein Loch: Tab-Wechsel zwischen zwei
// Iterationen sperrt sofort, der nächste Schreibschritt trifft auf einen
// bereits gesperrten Tresor und bricht mit `LocalEncryptionLockedError` ab —
// ein Backup-Restore bliebe halb wiederhergestellt zurück. Deshalb zählt
// `writeDataRaw` laufende Schreibvorgänge; der Provider verschiebt den Lock,
// bis der Zähler auf 0 fällt, und sperrt dann nur, wenn der Tab zu diesem
// Zeitpunkt IMMER NOCH verborgen ist (siehe LocalEncryptionProvider.tsx).
let writesInFlight = 0
const writeSettledListeners = new Set<() => void>()

/** Läuft gerade ein Schreibvorgang in den verschlüsselten Bestand? */
export function isLocalEncryptionWriteInFlight(): boolean {
  return writesInFlight > 0
}

/** Meldet sich an, sobald KEIN Schreibvorgang mehr läuft (Zähler auf 0). */
export function onLocalEncryptionWriteSettled(listener: () => void): () => void {
  writeSettledListeners.add(listener)
  return () => {
    writeSettledListeners.delete(listener)
  }
}

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
  pulseActivity()
  writesInFlight += 1
  try {
    await idbSet(storageKey, raw)
    if (typeof localStorage !== 'undefined') localStorage.removeItem(storageKey)
    if (!persistenceRequested) {
      persistenceRequested = true
      // RES-7: Rückgabewert wird ausgewertet (nicht mehr fire-and-forget) und
      // bei Verweigerung als kleines Flag gemerkt — Details siehe idb-kv.ts.
      void requestAndRecordPersistentStorage()
    }
  } finally {
    writesInFlight = Math.max(0, writesInFlight - 1)
    if (writesInFlight === 0) {
      for (const listener of writeSettledListeners) listener()
    }
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
// Zwischenstand eines noch nicht abgeschlossenen PBKDF2-Rewraps (SEC-1). Trägt
// die ZIELPARAMETER (inkl. Salt) des laufenden Umschlüsselungsversuchs, damit
// ein Resume — nach einem Abbruch mitten im Rewrap-Loop ODER nach einem ganz
// gewöhnlichen lock()/unlock() mittendrin — dieselben Parameter wiederverwendet
// statt bei jedem Versuch ein neues zufälliges Salt zu ziehen. Ohne das würden
// bereits umgeschlüsselte Einträge (altes Salt vom abgebrochenen Versuch) auf
// ein drittes, nie dagewesenes Salt treffen und wären mit keinem der beiden
// bekannten Schlüssel mehr entschlüsselbar.
const REWRAP_PENDING_KEY = 'ausgabentracker_local_encryption_rewrap_pending_v1'

// --- Auto-Lock-Einstellung (WP 3.2 / SEC-2) ----------------------------------
// Kein Finanzdatum, sondern ein reines Verhaltens-Flag — wie
// `PERSISTENCE_DENIED_KEY` in idb-kv.ts ("Kleines UI-Flag (kein Finanzdatum) —
// bleibt bewusst in localStorage") bewusst in Klartext-localStorage, NICHT im
// verschlüsselten Bestand (local-settings-service.ts): Diese Einstellung
// steuert, WANN sich der Tresor selbst sperrt, und muss deshalb unabhängig vom
// Tresor-Zustand lesbar sein — insbesondere direkt nach einem automatischen
// Lock, wenn als Nächstes exakt diese Einstellung wieder gelesen werden muss,
// um zu wissen, ob (und wann) erneut gesperrt werden soll. Läge sie im
// verschlüsselten Bestand, wäre sie ausgerechnet dann unlesbar, wenn sie
// gebraucht wird. Dieselbe Überlegung gilt schon für CONFIG_KEY/CHECK_KEY
// oben: Voraussetzungen fürs Entsperren können nicht hinter dem Entsperren
// liegen.
const AUTO_LOCK_KEY = 'ausgabentracker_local_encryption_autolock_v1'
/** Vorentschieden (WP 3.2 / docs/qualitaet-2026-08/plan.md): Standard 10 Minuten. */
export const AUTO_LOCK_DEFAULT_MINUTES = 10
/** Sentinel-Wert für "nie automatisch sperren". */
export const AUTO_LOCK_NEVER = 'never' as const
export type AutoLockSetting = number | typeof AUTO_LOCK_NEVER

function loadAutoLockSetting(): AutoLockSetting {
  if (typeof localStorage === 'undefined') return AUTO_LOCK_DEFAULT_MINUTES
  const raw = localStorage.getItem(AUTO_LOCK_KEY)
  if (raw == null) return AUTO_LOCK_DEFAULT_MINUTES
  if (raw === AUTO_LOCK_NEVER) return AUTO_LOCK_NEVER
  const minutes = Number(raw)
  return Number.isFinite(minutes) && minutes > 0 ? minutes : AUTO_LOCK_DEFAULT_MINUTES
}

function saveAutoLockSetting(value: AutoLockSetting): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(AUTO_LOCK_KEY, value === AUTO_LOCK_NEVER ? AUTO_LOCK_NEVER : String(value))
}

// Zweite, unabhängige Auto-Lock-Einstellung (WP 3.2 / SEC-2, "Vorentschieden"
// im Plan): Lock bei `visibilitychange` → `hidden` (Tab-Wechsel, App in den
// Hintergrund). Standardmäßig AUS — sonst sperrt die App bei jedem
// Tab-Wechsel, und was ständig nervt, wird abgeschaltet und schützt dann gar
// nichts mehr. Dieselbe Begründung wie bei AUTO_LOCK_KEY oben gilt
// unverändert: Klartext-localStorage, weil die Einstellung unabhängig vom
// Tresor-Zustand lesbar sein muss (u.a. direkt nach einem automatischen Lock).
const AUTO_LOCK_ON_HIDDEN_KEY = 'ausgabentracker_local_encryption_lock_on_hidden_v1'

function loadLockOnHiddenSetting(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(AUTO_LOCK_ON_HIDDEN_KEY) === '1'
}

function saveLockOnHiddenSetting(value: boolean): void {
  if (typeof localStorage === 'undefined') return
  if (value) localStorage.setItem(AUTO_LOCK_ON_HIDDEN_KEY, '1')
  else localStorage.removeItem(AUTO_LOCK_ON_HIDDEN_KEY)
}

// SEC-1 (docs/qualitaet-2026-08/audit.md): OWASP empfiehlt für PBKDF2-HMAC-
// SHA256 ≥ 600.000 Iterationen (210.000 war der SHA-512-Wert und machte das
// Passwort ~2,8× schneller offline brute-forcebar als beabsichtigt). Einzige
// Definitionsstelle — `enable()`, `freshStandaloneConfig()` und der Rewrap in
// `unlock()` referenzieren ausschließlich diese Konstante.
export const PBKDF2_ITERATIONS = 600_000

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

function kdfMatches(a: LocalEncryptionConfigV1['kdf'], b: LocalEncryptionConfigV1['kdf']): boolean {
  return a.name === b.name && a.hash === b.hash && a.iterations === b.iterations && a.salt_b64 === b.salt_b64
}

function loadPendingRewrapConfig(): LocalEncryptionConfigV1 | null {
  const raw = localStorage.getItem(REWRAP_PENDING_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed?.v === 1 && parsed?.enabled) return parsed as LocalEncryptionConfigV1
    return null
  } catch {
    return null
  }
}

function savePendingRewrapConfig(cfg: LocalEncryptionConfigV1) {
  localStorage.setItem(REWRAP_PENDING_KEY, JSON.stringify(cfg))
}

function clearPendingRewrapConfig() {
  localStorage.removeItem(REWRAP_PENDING_KEY)
}

// Vollständige Registry der bei aktiver Verschlüsselung als Envelope
// gespeicherten Keys (VE-6 / F-CRYPTO-1) — gemeinsam genutzt von
// `migrateFinanceKeys()` (encrypt/decrypt bei enable/disable) und dem
// PBKDF2-Rewrap (SEC-1), damit beide garantiert dieselbe Menge sehen.
async function getSensitiveStorageKeys(): Promise<string[]> {
  const sensitiveKeys = new Set<string>(ENCRYPTED_STORAGE_KEYS)
  return (await idbKeys()).filter(
    (k) => sensitiveKeys.has(k) || k.startsWith('ausgabentracker_transactions_v2__'),
  )
}

export const localEncryption = {
  _key: null as CryptoKey | null,
  // Zweiter Schlüssel, der WÄHREND eines laufenden (oder mitten abgebrochenen)
  // PBKDF2-Rewraps (SEC-1) zusätzlich zu `_key` gültig ist — welche der beiden
  // Generationen ein konkreter Envelope tatsächlich trägt, steht in dessen
  // eigenem `kdf`-Feld (`_rewrapAltKdf` zum Abgleich). Ohne diesen zweiten
  // Schlüssel wäre ein Eintrag, der im Rewrap-Loop bereits umgeschlüsselt
  // wurde, bevor `_key` am Ende auf die neue Generation zeigt, für die Dauer
  // des Rewraps unlesbar — genau der Zustand „manche Keys alt, manche neu".
  _rewrapAltKey: null as CryptoKey | null,
  _rewrapAltKdf: null as LocalEncryptionConfigV1['kdf'] | null,

  getConfig(): LocalEncryptionConfigV1 | null {
    return loadConfig()
  },

  isEnabled(): boolean {
    return !!loadConfig()
  },

  isUnlocked(): boolean {
    return this.isEnabled() && !!this._key
  },

  /** WP 3.2 (SEC-2): Minuten bis zum Auto-Lock, oder `AUTO_LOCK_NEVER`. */
  getAutoLockMinutes(): AutoLockSetting {
    return loadAutoLockSetting()
  },

  setAutoLockMinutes(value: AutoLockSetting): void {
    saveAutoLockSetting(value)
  },

  /** WP 3.2 (SEC-2): Lock bei `visibilitychange` → `hidden`. Standard: aus. */
  getLockOnHidden(): boolean {
    return loadLockOnHiddenSetting()
  },

  setLockOnHidden(value: boolean): void {
    saveLockOnHiddenSetting(value)
  },

  lock() {
    this._key = null
    // Ein expliziter lock() macht den Vault vollständig unlesbar — der
    // Rewrap-Fallback-Schlüssel darf das nicht unterlaufen. Ein Resume nach
    // dem nächsten unlock() liest seinen Fortschritt ohnehin aus dem
    // persistierten Pending-Marker, nicht aus diesem In-Memory-Feld.
    this._rewrapAltKey = null
    this._rewrapAltKdf = null
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
        iterations: PBKDF2_ITERATIONS,
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

    // SEC-1: Passwort ist verifiziert — ein Alt-Vault (< PBKDF2_ITERATIONS)
    // wird jetzt automatisch auf die neuen Parameter umgeschlüsselt. Ein
    // Fehlschlag dabei (z. B. ein IndexedDB-Schreibfehler) darf den gerade
    // erfolgreichen Unlock NICHT rückgängig machen — der Vault ist mit dem
    // korrekten Passwort bereits vollständig lesbar (siehe decryptEnvelope-
    // Fallback), der Rewrap wird beim nächsten Unlock automatisch fortgesetzt.
    try {
      await this.rewrapIfNeeded(password, cfg)
    } catch (err) {
      console.warn('[local-crypto] PBKDF2-Rewrap fehlgeschlagen, wird beim nächsten Unlock fortgesetzt:', {
        message: (err as Error).message,
      })
    }
  },

  /**
   * SEC-1: Schlüsselt einen Alt-Vault (`oldCfg.kdf.iterations < PBKDF2_ITERATIONS`)
   * automatisch auf die aktuellen KDF-Parameter um. Resumable und crash-sicher:
   * - Zielparameter (inkl. Salt) werden VOR dem Loop persistiert
   *   (`REWRAP_PENDING_KEY`), damit ein Resume — nach Abbruch oder nach einem
   *   zwischenzeitlichen lock()/unlock() — dieselben Parameter wiederverwendet
   *   statt bei jedem Versuch ein neues Salt zu ziehen (sonst wären bereits
   *   umgeschlüsselte Einträge mit keinem der beiden bekannten Schlüssel mehr
   *   lesbar).
   * - CONFIG_KEY/CHECK_KEY werden ERST nach vollständigem Loop-Durchlauf
   *   umgestellt — bis dahin bleibt der alte Zustand die persistierte
   *   Wahrheit, und `_rewrapAltKey` deckt bereits umgeschlüsselte Einträge als
   *   Lese-Fallback ab (siehe decryptEnvelope).
   * - Pro Eintrag: bereits auf die Zielparameter umgeschlüsselte Einträge
   *   werden übersprungen (Resume), alles andere wird über den generischen
   *   decryptEnvelope-Fallback gelesen (deckt sowohl „noch alt" als auch
   *   „von einem vorherigen Durchlauf schon neu" ab) und neu verschlüsselt.
   */
  async rewrapIfNeeded(password: string, oldCfg: LocalEncryptionConfigV1): Promise<void> {
    if (oldCfg.kdf.iterations >= PBKDF2_ITERATIONS) {
      // Nichts zu tun — ein evtl. verwaister Pending-Marker (z. B. aus einem
      // Durchlauf, der zwischen dem finalen saveConfig() und dem Aufräumen
      // des Markers abgebrochen ist) wird hier bereinigt.
      clearPendingRewrapConfig()
      return
    }

    const newCfg =
      loadPendingRewrapConfig() ??
      (() => {
        const salt = crypto.getRandomValues(new Uint8Array(16))
        const cfg: LocalEncryptionConfigV1 = {
          v: 1,
          enabled: true,
          kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: PBKDF2_ITERATIONS, salt_b64: b64encode(salt) },
          cipher: { name: 'AES-GCM', key_length: 256 },
        }
        savePendingRewrapConfig(cfg)
        return cfg
      })()

    const newKey = await deriveKeyFromPassword(password, newCfg)
    this._rewrapAltKey = newKey
    this._rewrapAltKdf = newCfg.kdf

    const keys = await getSensitiveStorageKeys()
    for (const storageKey of keys) {
      const raw = await idbGet(storageKey)
      if (!raw) continue

      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        continue
      }
      if (!isEnvelopeV1(parsed)) continue
      if (kdfMatches(parsed.kdf, newCfg.kdf)) continue // bereits umgeschlüsselt (Resume)

      // `decryptEnvelope` prüft `_key` (alte Generation) UND `_rewrapAltKey`
      // (diese neue Generation) — deckt damit auch Einträge ab, die ein
      // vorheriger abgebrochener Durchlauf schon umgeschlüsselt hatte.
      const plaintext = await this.decryptEnvelope(parsed)
      const envelope = await encryptString(plaintext, newKey, newCfg)
      await writeDataRaw(storageKey, JSON.stringify(envelope))
    }

    // Erst jetzt, nach vollständigem Loop, wird die neue Generation zur
    // persistierten Wahrheit — CHECK_KEY und CONFIG_KEY unmittelbar
    // hintereinander, ohne await dazwischen.
    const checkPlain = JSON.stringify({ ok: true, created_at: new Date().toISOString() })
    const checkEnc = await encryptString(checkPlain, newKey, newCfg)
    localStorage.setItem(CHECK_KEY, JSON.stringify(checkEnc))
    saveConfig(newCfg)
    clearPendingRewrapConfig()

    this._key = newKey
    this._rewrapAltKey = null
    this._rewrapAltKdf = null
  },

  async disable(password: string): Promise<void> {
    if (typeof window === 'undefined') return

    await this.unlock(password)

    // Decrypt known finance keys back to plaintext before disabling.
    await this.migrateFinanceKeys('decrypt')

    this._key = null
    this._rewrapAltKey = null
    this._rewrapAltKdf = null
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
    try {
      return await decryptString(envelope, key)
    } catch (err) {
      // SEC-1-Rewrap: `envelope` kann zur jeweils ANDEREN Generation gehören
      // (noch nicht umgeschlüsselt, oder von einem abgebrochenen vorherigen
      // Durchlauf schon umgeschlüsselt) — vor dem Aufgeben mit dem passenden
      // Fallback-Schlüssel versuchen, statt den Vault für die Dauer des
      // Rewraps teilweise unlesbar zu machen.
      if (this._rewrapAltKey && this._rewrapAltKdf && kdfMatches(envelope.kdf, this._rewrapAltKdf)) {
        return decryptString(envelope, this._rewrapAltKey)
      }
      throw err
    }
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
    const keys = await getSensitiveStorageKeys()

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

      // decrypt — über `decryptEnvelope` (nicht `decryptString` direkt): deckt
      // damit auch Einträge ab, die ein noch nicht abgeschlossener SEC-1-
      // Rewrap bereits auf die neue Generation umgeschlüsselt hat, während
      // `key`/`cfg` hier noch die alte Generation sind (siehe rewrapIfNeeded).
      if (!isEnvelopeV1(parsed)) continue
      const pt = await this.decryptEnvelope(parsed)
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
      iterations: PBKDF2_ITERATIONS,
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

/** WP 3.3 (SEC-3): stabile, nicht-übersetzte Kategorie für Gate-Logik — nie
 * über den übersetzten Anzeigetext matchen (AGENTS.md §6, "Matching über den
 * Anzeigenamen"). Die Übersetzung des Labels ist reine Präsentationslogik
 * und liegt deshalb in der Komponente (`useI18n()`), nicht hier. */
export type PasswordStrengthCategory = 'weak' | 'medium' | 'strong'

/**
 * Schätzt die Passwortstärke über die Shannon-Entropie (Länge × Zeichenraum),
 * abzüglich Strafen für Wiederholungen und einfache Sequenzen (abc, 123).
 * Ersetzt die frühere reine Längen-/Klassen-Heuristik (Issue #32): so wird
 * z. B. "aaaaaaaaaa" trotz Länge realistisch als schwach erkannt.
 *
 * WP 3.3 (SEC-3): `category` ist die Gate-Schwelle für den Setup-Button in
 * `LocalEncryptionSettings` — unterhalb von `weak` blockiert er. Gemessene
 * Beispiele (siehe `__tests__/local-crypto.test.ts`): "1234" → 9,3 bit
 * (weak), "Sommer2026" → 55,4 bit (medium), "correcthorsebatterystaple" →
 * 105,3 bit (strong). Die Schwelle ist die bereits bestehende
 * "schwach"-Kategorie — keine neue Zahl, sondern die, die schon als
 * Stärkeanzeige lief, jetzt zusätzlich als Gate ausgewertet.
 *
 * @returns score 0–100 sowie eine Kategorie (weak < 36 bit ≤ medium < 66 bit ≤ strong)
 */
export function estimatePasswordStrength(
  password: string,
): { score: number; category: PasswordStrengthCategory } {
  const p = password || ''
  if (!p) return { score: 0, category: 'weak' }

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
  let category: PasswordStrengthCategory = 'weak'
  if (bits >= 66) category = 'strong'
  else if (bits >= 36) category = 'medium'

  return { score, category }
}