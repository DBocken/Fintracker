import React, { createContext, useContext, useMemo, useState } from 'react'
import { localEncryption } from '@/services/local-crypto'

type LocalEncryptionContextValue = {
  enabled: boolean
  unlocked: boolean
  lock: () => void
  unlock: (password: string) => Promise<void>
  enable: (password: string) => Promise<void>
  disable: (password: string) => Promise<void>
  refresh: () => void
}

const LocalEncryptionContext = createContext<LocalEncryptionContextValue | null>(null)

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

export function useLocalEncryption() {
  const ctx = useContext(LocalEncryptionContext)
  if (!ctx) throw new Error('useLocalEncryption must be used within LocalEncryptionProvider')
  return ctx
}
