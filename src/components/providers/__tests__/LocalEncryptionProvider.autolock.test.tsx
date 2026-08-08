import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import {
  LocalEncryptionProvider,
  useLocalEncryption,
} from '@/components/providers/LocalEncryptionProvider';
import { localEncryption } from '@/services/local-crypto';
import { clearLocalKvStore } from '@/services/idb-kv';
import * as idbKv from '@/services/idb-kv';
import type { LocalEncryptionContextValue } from '@/hooks/useLocalEncryption';

/**
 * WP 3.2 (SEC-2): Auto-Lock nach Inaktivität.
 *
 * Das Threat Model (`docs/security/threat-model.md`) nennt lokalen
 * Gerätezugriff als Angreiferprofil — ein unbeaufsichtigtes, entsperrtes
 * Gerät ist genau die Lücke. Diese Tests prüfen den DURCHGRIFF bis zum
 * Zustand (Schlüssel weg UND Context im Sperrzustand), nicht nur, dass
 * irgendein Timer feuert — `App.tsx` leitet bereits allein anhand von
 * `enabled && !unlocked` auf `/unlock` um (`locked` in `App.tsx`), weshalb
 * der Context-Zustand hier der richtige Prüfpunkt ist.
 *
 * `vi.useFakeTimers()` statt echter Wartezeit (Vorgabe WP 3.2).
 */

const PASSWORD = 'korrekt-pferd-batterie-klammer-2026';

let latest: LocalEncryptionContextValue | null = null;

function CaptureState() {
  latest = useLocalEncryption();
  return null;
}

function renderProvider() {
  return render(
    <LocalEncryptionProvider>
      <CaptureState />
    </LocalEncryptionProvider>,
  );
}

describe('[SECURITY] LocalEncryptionProvider Auto-Lock (SEC-2)', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('ausgabentracker_locale_v1', 'de');
    localEncryption.lock();
    latest = null;
  });

  afterEach(async () => {
    // Echte Timer für den IndexedDB-Cleanup: fake-indexeddb löst seine
    // Requests intern über einen Timer auf — unter `vi.useFakeTimers()`
    // bliebe das Promise für immer offen (siehe Begründung unten bei den
    // einzelnen Tests).
    vi.useRealTimers();
    await clearLocalKvStore();
    localStorage.clear();
    localEncryption.lock();
  });

  it('[SECURITY] sollte nach Ablauf der Frist den Schlüssel entfernen und den Context in den Sperrzustand versetzen', async () => {
    // enable() schreibt/liest über IndexedDB (fake-indexeddb) — das läuft
    // NUR mit echten Timern durch (fake-indexeddb löst Requests über einen
    // eigenen Timer auf, der unter vi.useFakeTimers() nie feuert). Die
    // Fake-Timer werden deshalb erst NACH dem async Setup aktiviert, exakt
    // für den Teil, den dieser Test wirklich prüft: den Ablauf der Frist.
    await localEncryption.enable(PASSWORD);
    localEncryption.setAutoLockMinutes(1);
    vi.useFakeTimers();

    renderProvider();
    expect(latest?.unlocked).toBe(true);

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(localEncryption.isUnlocked()).toBe(false);
    expect(latest?.unlocked).toBe(false);
    expect(latest?.enabled).toBe(true);
  });

  it('[SECURITY] sollte den Timer bei Aktivität kurz vor Ablauf zurücksetzen — der Tresor bleibt offen', async () => {
    await localEncryption.enable(PASSWORD);
    localEncryption.setAutoLockMinutes(1);
    vi.useFakeTimers();

    renderProvider();

    act(() => {
      vi.advanceTimersByTime(59_000);
      window.dispatchEvent(new Event('keydown'));
    });
    // Direkt danach nochmal fast bis zur (alten) Frist vorspulen — ohne
    // Reset wäre das zusammen schon über 60s seit Start.
    act(() => {
      vi.advanceTimersByTime(59_000);
    });

    expect(localEncryption.isUnlocked()).toBe(true);
    expect(latest?.unlocked).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(localEncryption.isUnlocked()).toBe(false);
  });

  it("[SECURITY] sollte bei der Einstellung 'nie' nicht sperren", async () => {
    await localEncryption.enable(PASSWORD);
    localEncryption.setAutoLockMinutes('never');
    vi.useFakeTimers();

    renderProvider();

    act(() => {
      vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    });

    expect(localEncryption.isUnlocked()).toBe(true);
    expect(latest?.unlocked).toBe(true);
  });

  it('sollte keinen Sperr-Timer laufen lassen, solange der Tresor gar nicht entsperrt ist', async () => {
    await localEncryption.enable(PASSWORD);
    localEncryption.setAutoLockMinutes(1);
    localEncryption.lock();
    vi.useFakeTimers();
    const lockSpy = vi.spyOn(localEncryption, 'lock');

    renderProvider();
    expect(latest?.unlocked).toBe(false);

    act(() => {
      vi.advanceTimersByTime(10 * 60_000);
    });

    // Ein Timer ohne Zweck würde hier wiederholt/unnötig lock() aufrufen —
    // erlaubt ist nur der explizite lock() im beforeEach dieses Tests
    // (bereits vor dem Spy) und der Cleanup-Aufruf im afterEach (noch nicht
    // erreicht). Während der Provider gemountet ist, darf lock() also gar
    // nicht durch den Timer ausgelöst werden.
    expect(lockSpy).not.toHaveBeenCalled();
    lockSpy.mockRestore();
  });
});

/** Simuliert einen Tab-Wechsel (jsdom setzt `visibilityState` nicht selbst um). */
function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    value: state,
    configurable: true,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('[SECURITY] LocalEncryptionProvider Lock-bei-Tab-Wechsel (SEC-2, "Vorentschieden")', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('ausgabentracker_locale_v1', 'de');
    localEncryption.lock();
    latest = null;
    setVisibility('visible');
  });

  afterEach(async () => {
    setVisibility('visible');
    await clearLocalKvStore();
    localStorage.clear();
    localEncryption.lock();
  });

  it('[SECURITY] sollte bei ausgeschalteter Einstellung (Standard) NICHT sperren, wenn der Tab verborgen wird', async () => {
    await localEncryption.enable(PASSWORD);
    // Einstellung bewusst NICHT gesetzt — Standard ist aus.

    renderProvider();
    expect(latest?.unlocked).toBe(true);

    act(() => {
      setVisibility('hidden');
    });

    expect(localEncryption.isUnlocked()).toBe(true);
    expect(latest?.unlocked).toBe(true);
  });

  it('[SECURITY] sollte bei eingeschalteter Einstellung sperren, wenn der Tab verborgen wird', async () => {
    await localEncryption.enable(PASSWORD);
    localEncryption.setLockOnHidden(true);

    renderProvider();
    expect(latest?.unlocked).toBe(true);

    act(() => {
      setVisibility('hidden');
    });

    expect(localEncryption.isUnlocked()).toBe(false);
    expect(latest?.unlocked).toBe(false);
  });

  it('[SECURITY] sollte bei eingeschalteter Einstellung, aber gar nicht entsperrtem Tresor, nichts tun (kein Fehler, kein Effekt)', async () => {
    await localEncryption.enable(PASSWORD);
    localEncryption.setLockOnHidden(true);
    localEncryption.lock();

    renderProvider();
    expect(latest?.unlocked).toBe(false);

    expect(() => {
      act(() => {
        setVisibility('hidden');
      });
    }).not.toThrow();

    expect(localEncryption.isEnabled()).toBe(true);
    expect(localEncryption.isUnlocked()).toBe(false);
    expect(latest?.unlocked).toBe(false);
  });

  it('[SECURITY] sollte die Einstellung über einen Neustart hinweg befolgen (persistiert)', async () => {
    await localEncryption.enable(PASSWORD);
    localEncryption.setLockOnHidden(true);

    // "Neustart" simuliert: kein Provider läuft, die Einstellung liegt nur in
    // localStorage. Ein frisch gemounteter Provider liest sie beim Start.
    expect(localStorage.getItem('ausgabentracker_local_encryption_lock_on_hidden_v1')).toBe('1');

    renderProvider();
    act(() => {
      setVisibility('hidden');
    });

    expect(localEncryption.isUnlocked()).toBe(false);
  });

  it('[SECURITY] sollte einen Lock bei verborgenem Tab verschieben, bis ein laufender Schreibvorgang fertig ist, und nur sperren, wenn der Tab dann noch verborgen ist', async () => {
    await localEncryption.enable(PASSWORD);
    localEncryption.setLockOnHidden(true);

    // fake-indexeddb löst normalerweise sofort auf; hier wird die
    // IndexedDB-Schreiboperation künstlich offengehalten, um einen
    // "mehrteiligen Schreibvorgang läuft noch" nachzustellen — genau der Fall
    // aus restoreLocalCollections() (backup-service.ts), wo mehrere
    // Collections nacheinander geschrieben werden.
    const pending: { release: (() => void) | null } = { release: null };
    const realIdbSet = idbKv.idbSet;
    const idbSetSpy = vi.spyOn(idbKv, 'idbSet').mockImplementation(
      (key: string, value: string) =>
        new Promise<void>((resolve) => {
          pending.release = () => {
            realIdbSet(key, value).then(resolve);
          };
        }),
    );

    renderProvider();

    const writePromise = localEncryption.encryptAndStore('flight_key', { a: 1 });
    // Der Crypto-Schritt vor dem eigentlichen Schreiben braucht ein paar
    // Mikrotasks, bis writeDataRaw() (und damit die gemockte idbSet) erreicht
    // ist.
    await vi.waitFor(() => expect(pending.release).not.toBeNull());

    act(() => {
      setVisibility('hidden');
    });
    // Der Schreibvorgang läuft noch — der Lock darf JETZT noch nicht
    // passiert sein.
    expect(localEncryption.isUnlocked()).toBe(true);

    pending.release?.();
    await act(async () => {
      await writePromise;
    });

    // Erst jetzt, nach Abschluss des Schreibvorgangs (Tab weiterhin
    // verborgen), ist gesperrt.
    expect(localEncryption.isUnlocked()).toBe(false);

    idbSetSpy.mockRestore();
  });
});
