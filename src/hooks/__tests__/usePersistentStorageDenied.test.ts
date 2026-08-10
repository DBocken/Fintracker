import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePersistentStorageDenied } from '../usePersistentStorageDenied';
import { requestAndRecordPersistentStorage } from '@/services/idb-kv';

describe('usePersistentStorageDenied (RES-7)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('sollte false liefern, solange keine Verweigerung gemerkt wurde', () => {
    const { result } = renderHook(() => usePersistentStorageDenied());
    expect(result.current).toBe(false);
  });

  it('sollte true liefern, wenn requestAndRecordPersistentStorage() eine Verweigerung gemerkt hat', async () => {
    // Kein `navigator.storage.persist` im Test-Environment ⇒ requestPersistentStorage() liefert false.
    await requestAndRecordPersistentStorage();

    const { result } = renderHook(() => usePersistentStorageDenied());
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('sollte auf ein storage-Event reagieren (anderer Tab hat das Flag gesetzt)', async () => {
    const { result } = renderHook(() => usePersistentStorageDenied());
    expect(result.current).toBe(false);

    localStorage.setItem('ausgabentracker_persistent_storage_denied_v1', '1');
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'ausgabentracker_persistent_storage_denied_v1' }));
    });

    expect(result.current).toBe(true);
  });
});
