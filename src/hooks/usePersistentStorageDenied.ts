import { useEffect, useState } from 'react';
import { isPersistentStorageDenied } from '@/services/idb-kv';

/**
 * RES-7: Ob der Browser dauerhaften Speicher (`navigator.storage.persist()`)
 * verweigert hat. Liest ein kleines, von `idb-kv.ts` gepflegtes localStorage-
 * Flag — kein eigener asynchroner I/O-Zugriff hier, deshalb kein TanStack-
 * Query-Fall (§7 gilt für Server-/Async-State, nicht für ein synchron
 * lesbares lokales Flag).
 *
 * Der Wert kann sich während der laufenden Sitzung noch ändern: Die
 * Anfrage selbst läuft fire-and-forget beim ersten Schreibvorgang
 * (local-crypto.ts), oft erst NACH dem Mount dieser Fläche. Ein
 * `storage`-Listener holt Änderungen aus anderen Tabs nach, ein einmaliger
 * Nachschlag beim Mount holt Änderungen im selben Tab nach.
 */
export function usePersistentStorageDenied(): boolean {
  const [denied, setDenied] = useState(() => isPersistentStorageDenied());

  useEffect(() => {
    const refresh = () => setDenied(isPersistentStorageDenied());
    refresh();
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, []);

  return denied;
}
