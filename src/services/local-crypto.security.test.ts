import { beforeEach, describe, expect, it } from 'vitest';
import { idbGet, idbRemove, idbSet } from './idb-kv';
import { localEncryption } from './local-crypto';

const STORAGE_KEY = 'security_finance_payload';
const PASSWORD = 'korrekt-pferd-batterie-klammer-2026';

beforeEach(async () => {
  localEncryption.lock();
  localStorage.clear();
  await idbRemove(STORAGE_KEY);
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
