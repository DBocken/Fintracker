/**
 * Test-Fixtures für WP 3.1 (SEC-1, PBKDF2-Iterationen): baut einen
 * Alt-Vault-Zustand (210.000 PBKDF2-Iterationen, wie er vor dieser
 * Umstellung persistiert wurde) direkt über WebCrypto nach — unabhängig von
 * `local-crypto.ts`, damit die Tests wirklich das persistierte FORMAT prüfen
 * und nicht bloß den aktuellen Code gegen sich selbst.
 *
 * Kein Produktionscode — bewusst nur unter `__tests__/`, keine `.test.ts`-
 * Endung (kein eigener Testlauf, nur Import durch andere Testdateien).
 */

export const LEGACY_CONFIG_KEY = 'ausgabentracker_local_encryption_config_v1'
export const LEGACY_CHECK_KEY = 'ausgabentracker_local_encryption_check_v1'
export const LEGACY_ITERATIONS = 210_000

function b64encode(u8: Uint8Array): string {
  let s = ''
  for (const b of u8) s += String.fromCharCode(b)
  return btoa(s)
}

function b64decode(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64)
  const u8 = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
  return u8
}

export type LegacyKdf = { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt_b64: string }

export async function deriveLegacyKey(password: string, kdf: LegacyKdf): Promise<CryptoKey> {
  const salt = b64decode(kdf.salt_b64)
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: kdf.hash, iterations: kdf.iterations, salt },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptLegacy(plaintext: string, key: CryptoKey, kdf: LegacyKdf) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext))
  return {
    type: 'ausgabentracker.enc' as const,
    v: 1 as const,
    kdf,
    cipher: { name: 'AES-GCM' as const, iv_b64: b64encode(iv) },
    ct_b64: b64encode(new Uint8Array(ct)),
  }
}

/**
 * Legt einen kompletten Alt-Vault (Config + Check-Blob + beliebige
 * IndexedDB-Einträge) mit 210.000 Iterationen an — den Zustand, den
 * bestehende Nutzer:innen vor WP 3.1 tatsächlich auf der Platte haben.
 * `idbSetFn` wird injiziert, damit Aufrufer:innen (z. B. der Rewrap-Abbruch-
 * Test) einen gemockten `idbSet` verwenden können, ohne dass das Seeding
 * selbst den Mock scharf schaltet.
 */
export async function seedLegacyVault(
  password: string,
  financeEntries: Record<string, unknown>,
  idbSetFn: (key: string, value: string) => Promise<void>,
): Promise<{ key: CryptoKey; kdf: LegacyKdf }> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16))
  const kdf: LegacyKdf = {
    name: 'PBKDF2',
    hash: 'SHA-256',
    iterations: LEGACY_ITERATIONS,
    salt_b64: b64encode(saltBytes),
  }
  const key = await deriveLegacyKey(password, kdf)

  const cfg = {
    v: 1,
    enabled: true,
    kdf,
    cipher: { name: 'AES-GCM', key_length: 256 },
  }
  localStorage.setItem(LEGACY_CONFIG_KEY, JSON.stringify(cfg))

  const checkEnvelope = await encryptLegacy(
    JSON.stringify({ ok: true, created_at: new Date().toISOString() }),
    key,
    kdf,
  )
  localStorage.setItem(LEGACY_CHECK_KEY, JSON.stringify(checkEnvelope))

  for (const [storageKey, value] of Object.entries(financeEntries)) {
    const envelope = await encryptLegacy(JSON.stringify(value), key, kdf)
    await idbSetFn(storageKey, JSON.stringify(envelope))
  }

  return { key, kdf }
}
