import React, { useMemo, useState } from 'react'
import { localEncryption } from '@/services/local-crypto'
// Context und Lesezugriff liegen in `src/hooks/` — sonst muesste jeder Leser
// (auch ein ViewModel) eine Komponentendatei importieren.
import {
  LocalEncryptionContext,
  useLocalEncryption,
  type LocalEncryptionContextValue,
} from '@/hooks/useLocalEncryption'

export { useLocalEncryption }

export function LocalEncryptionProvider({ children }: { children: React.ReactNode }) {
  const [tick, setTick] = useState(0)

  const refresh = () => setTick((t) => t + 1)

  const value = useMemo<LocalEncryptionContextValue>(() => {
    const enabled = localEncryption.isEnabled()
    const unlocked = localEncryption.isUnlocked()

    return {
      enabled,
      unlocked,
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
      refresh,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])

  return <LocalEncryptionContext.Provider value={value}>{children}</LocalEncryptionContext.Provider>
}
