import React, { useEffect, useMemo, useState } from 'react'
import {
  isLocalEncryptionWriteInFlight,
  localEncryption,
  onLocalEncryptionActivity,
  onLocalEncryptionWriteSettled,
  type AutoLockSetting,
} from '@/services/local-crypto'
import { useIdleTimer } from '@/hooks/useIdleTimer'
// Context und Lesezugriff liegen in `src/hooks/` — sonst muesste jeder Leser
// (auch ein ViewModel) eine Komponentendatei importieren.
import {
  LocalEncryptionContext,
  useLocalEncryption,
  type LocalEncryptionContextValue,
} from '@/hooks/useLocalEncryption'

export { useLocalEncryption }

const MINUTE_MS = 60_000

export function LocalEncryptionProvider({ children }: { children: React.ReactNode }) {
  const [tick, setTick] = useState(0)

  const refresh = () => setTick((t) => t + 1)

  const enabled = localEncryption.isEnabled()
  const unlocked = localEncryption.isUnlocked()
  const autoLockMinutes = localEncryption.getAutoLockMinutes()

  // WP 3.2 (SEC-2): Auto-Lock nach Inaktivität. `timeoutMs` ist NUR gesetzt,
  // wenn der Tresor tatsächlich entsperrt ist — ein gesperrter oder nie
  // aktivierter Tresor braucht keinen Timer, der ihn (nochmal) sperrt. Die
  // Einstellung "nie" (`autoLockMinutes === AUTO_LOCK_NEVER`) deaktiviert den
  // Timer ebenso wie `timeoutMs: null`. `onLocalEncryptionActivity` ist eine
  // stabile Modul-Referenz aus local-crypto.ts (kein Re-Wrap hier nötig) —
  // sie deckt Aktivität ohne DOM-Ereignis ab (laufende Schreibvorgänge, siehe
  // Begründung dort).
  const autoLockTimeoutMs =
    unlocked && autoLockMinutes !== 'never' ? autoLockMinutes * MINUTE_MS : null

  useIdleTimer({
    timeoutMs: autoLockTimeoutMs,
    onIdle: () => {
      localEncryption.lock()
      refresh()
    },
    extraActivity: onLocalEncryptionActivity,
  })

  const lockOnHidden = localEncryption.getLockOnHidden()

  // WP 3.2 (SEC-2, "Vorentschieden"): Lock bei `visibilitychange` → `hidden`.
  // Standardmäßig AUS (`lockOnHidden === false`) — sonst sperrt die App bei
  // jedem Tab-Wechsel, und was ständig nervt, wird abgeschaltet und schützt
  // dann gar nichts mehr. Nur aktiv, wenn der Tresor tatsächlich entsperrt
  // ist (derselbe Grund wie beim Idle-Timer oben: kein Timer/Listener ohne
  // Zweck).
  useEffect(() => {
    if (!unlocked || !lockOnHidden) return undefined

    let pendingUnsubscribe: (() => void) | null = null

    const doLock = () => {
      localEncryption.lock()
      refresh()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'hidden') return
      if (!isLocalEncryptionWriteInFlight()) {
        doLock()
        return
      }
      // Anders als beim Idle-Timer gibt es hier kein "Aufschieben durch
      // Aktivität" — visibilitychange ist ein sofortiges Ereignis. Ein
      // mehrteiliger Schreibvorgang (z.B. restoreLocalCollections() in
      // backup-service.ts, das mehrere Collections nacheinander schreibt)
      // würde bei einem sofortigen Lock mittendrin auf einen bereits
      // gesperrten Tresor treffen und mit LocalEncryptionLockedError
      // abbrechen — ein halb wiederhergestelltes Backup wäre schlimmer als
      // ein verspäteter Lock. Deshalb wird der Lock verschoben, bis der
      // laufende Schreibvorgang fertig ist, und dann NUR ausgeführt, wenn
      // der Tab zu diesem Zeitpunkt immer noch verborgen ist (sonst wäre ein
      // Lock direkt nach der Rückkehr überraschend).
      pendingUnsubscribe = onLocalEncryptionWriteSettled(() => {
        pendingUnsubscribe = null
        if (document.visibilityState === 'hidden') doLock()
      })
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      pendingUnsubscribe?.()
    }
  }, [unlocked, lockOnHidden])

  const value = useMemo<LocalEncryptionContextValue>(() => {
    return {
      enabled,
      unlocked,
      autoLockMinutes,
      lockOnHidden,
      lock: () => {
        localEncryption.lock()
        refresh()
      },
      unlock: async (password: string) => {
        await localEncryption.unlock(password)
        refresh()
      },
      enable: async (password: string) => {
        await localEncryption.enable(password)
        // Encrypt existing finance keys immediately.
        await localEncryption.migrateFinanceKeys('encrypt')
        refresh()
      },
      disable: async (password: string) => {
        await localEncryption.disable(password)
        refresh()
      },
      setAutoLockMinutes: (nextValue: AutoLockSetting) => {
        localEncryption.setAutoLockMinutes(nextValue)
        refresh()
      },
      setLockOnHidden: (nextValue: boolean) => {
        localEncryption.setLockOnHidden(nextValue)
        refresh()
      },
      refresh,
    }
    // `enabled`/`unlocked`/`autoLockMinutes`/`lockOnHidden` sind synchrone
    // Lesungen aus dem nicht-reaktiven `localEncryption`-Modul; `tick` ist ihr
    // einziges Änderungssignal (via `refresh()`) und deckt sie vollständig ab.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])

  return <LocalEncryptionContext.Provider value={value}>{children}</LocalEncryptionContext.Provider>
}
