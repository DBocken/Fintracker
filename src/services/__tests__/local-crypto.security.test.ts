import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { idbGet, idbRemove, idbSet } from '../idb-kv';
import { localEncryption, PBKDF2_ITERATIONS } from '../local-crypto';
import { LOCAL_FINANCE_KEYS } from '../local-storage-keys';
import { LEGACY_CONFIG_KEY, LEGACY_ITERATIONS, seedLegacyVault } from './legacy-vault-test-helpers';

// Für die SEC-1-Tests (Rewrap) MUSS der Schlüssel in `ENCRYPTED_STORAGE_KEYS`
// registriert sein — sonst greift `getSensitiveStorageKeys()` gar nicht erst
// zu, und der Rewrap-Test würde eine Migration prüfen, die nie stattfindet.
const REWRAP_STORAGE_KEY = LOCAL_FINANCE_KEYS.transactions;

const STORAGE_KEY = 'security_finance_payload';
const PASSWORD = 'korrekt-pferd-batterie-klammer-2026';

beforeEach(async () => {
  localEncryption.lock();
  localStorage.clear();
  localStorage.setItem('ausgabentracker_locale_v1', 'de');
  await idbRemove(STORAGE_KEY);
  await idbRemove(REWRAP_STORAGE_KEY);
});

describe('[PRIVACY] local encryption boundary', () => {
  it('hinterlässt sensible Nutzdaten weder in IndexedDB-Klartext noch in localStorage', async () => {
    await localEncryption.enable(PASSWORD);
    await localEncryption.encryptAndStore(STORAGE_KEY, {
      payee: 'GEHEIMER HÄNDLER',
      amount: -1234.56,
    });

    const raw = await idbGet(STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(raw).not.toContain('GEHEIMER HÄNDLER');
    expect(raw).not.toContain('1234.56');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('liefert nach dem Sperren keine entschlüsselten Daten', async () => {
    await localEncryption.enable(PASSWORD);
    await localEncryption.encryptAndStore(STORAGE_KEY, { amount: -10 });
    localEncryption.lock();

    await expect(localEncryption.loadAndMaybeDecrypt(STORAGE_KEY)).rejects.toThrow(/entsperren/i);
  });
});

describe('[SECURITY] encrypted envelope integrity', () => {
  it('weist einen manipulierten AES-GCM-Chiffretext ab', async () => {
    await localEncryption.enable(PASSWORD);
    await localEncryption.encryptAndStore(STORAGE_KEY, { amount: -10 });

    const raw = await idbGet(STORAGE_KEY);
    const envelope = JSON.parse(raw!);
    const last = envelope.ct_b64.at(-1);
    envelope.ct_b64 = `${envelope.ct_b64.slice(0, -1)}${last === 'A' ? 'B' : 'A'}`;
    await idbSet(STORAGE_KEY, JSON.stringify(envelope));

    await expect(localEncryption.loadAndMaybeDecrypt(STORAGE_KEY)).rejects.toBeTruthy();
  });

  it('ein fehlgeschlagener Unlock lässt keinen Schlüssel aktiv', async () => {
    await localEncryption.enable(PASSWORD);
    localEncryption.lock();
    await expect(localEncryption.unlock('falsch')).rejects.toThrow('Falsches Passwort');
    expect(localEncryption.isUnlocked()).toBe(false);
  });
});

// SEC-1 (docs/qualitaet-2026-08/audit.md): 210.000 PBKDF2-Iterationen bei
// SHA-256 sind der von OWASP für SHA-512 empfohlene Wert — für SHA-256
// verlangt OWASP ≥ 600.000. Alt-Vaults dürfen dabei nicht ausgesperrt werden
// und müssen sich beim erfolgreichen Unlock automatisch auf die neuen
// Parameter umschlüsseln (Rewrap).
describe('[SECURITY] PBKDF2 ≥ 600.000 Iterationen + kdf-Rewrap (SEC-1)', () => {
  it('[SECURITY] ein neu angelegter Vault verwendet mindestens 600.000 PBKDF2-Iterationen', async () => {
    expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(600_000);

    await localEncryption.enable(PASSWORD);
    const cfg = localEncryption.getConfig();
    expect(cfg?.kdf.iterations).toBe(PBKDF2_ITERATIONS);
    expect(cfg?.kdf.hash).toBe('SHA-256');
  });

  it('[SECURITY] ein Alt-Vault mit 210.000 Iterationen sperrt bei korrektem Passwort nicht aus', async () => {
    await seedLegacyVault(PASSWORD, { [REWRAP_STORAGE_KEY]: { amount: -42 } }, idbSet);

    await expect(localEncryption.unlock(PASSWORD)).resolves.toBeUndefined();
    expect(localEncryption.isUnlocked()).toBe(true);
  });

  it('[SECURITY] nach dem Unlock eines Alt-Vaults ist er auf ≥ 600.000 Iterationen umgeschlüsselt und die Daten bleiben unverändert lesbar', async () => {
    const payload = { amount: -42, payee: 'Alt-Vault-Eintrag' };
    await seedLegacyVault(PASSWORD, { [REWRAP_STORAGE_KEY]: payload }, idbSet);
    const saltBefore = (
      JSON.parse(localStorage.getItem(LEGACY_CONFIG_KEY)!) as { kdf: { salt_b64: string } }
    ).kdf.salt_b64;

    await localEncryption.unlock(PASSWORD);

    const cfgAfter = localEncryption.getConfig();
    expect(cfgAfter?.kdf.iterations).toBe(PBKDF2_ITERATIONS);
    expect(cfgAfter?.kdf.salt_b64).not.toBe(saltBefore);

    const raw = await idbGet(REWRAP_STORAGE_KEY);
    const envelope = JSON.parse(raw!);
    expect(envelope.kdf.iterations).toBe(PBKDF2_ITERATIONS);

    const decrypted = await localEncryption.decryptJson<typeof payload>(envelope);
    expect(decrypted).toEqual(payload);
  });

  it('[SECURITY] ein falsches Passwort löst weder Rewrap noch Datenänderung aus und verhält sich unverändert', async () => {
    const payload = { amount: -1 };
    await seedLegacyVault(PASSWORD, { [REWRAP_STORAGE_KEY]: payload }, idbSet);

    const rawBefore = await idbGet(REWRAP_STORAGE_KEY);
    const configBefore = localStorage.getItem(LEGACY_CONFIG_KEY);

    await expect(localEncryption.unlock('falsches-passwort')).rejects.toThrow('Falsches Passwort');
    expect(localEncryption.isUnlocked()).toBe(false);

    expect(await idbGet(REWRAP_STORAGE_KEY)).toBe(rawBefore);
    expect(localStorage.getItem(LEGACY_CONFIG_KEY)).toBe(configBefore);

    const configParsed = JSON.parse(configBefore!) as { kdf: { iterations: number } };
    expect(configParsed.kdf.iterations).toBe(LEGACY_ITERATIONS);
  });

  it('[SECURITY] die PBKDF2-Iterationszahl ist im Quelltext an genau einer Stelle definiert', () => {
    const sourcePath = resolve(__dirname, '../local-crypto.ts');
    const source = readFileSync(sourcePath, 'utf-8');
    const occurrences = source.match(/\b600_000\b/g) ?? [];
    expect(occurrences).toHaveLength(1);
  });
});
