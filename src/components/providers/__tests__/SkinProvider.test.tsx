import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SkinProvider from '../SkinProvider'
import {
  LocalEncryptionProvider,
  useLocalEncryption,
} from '@/components/providers/LocalEncryptionProvider'
import { localEncryption, LocalEncryptionLockedError } from '@/services/local-crypto'
import { getUserSettings } from '@/services/transaction-service'
import type { UserSettings } from '@/types'

vi.mock('@/services/transaction-service', () => ({
  getUserSettings: vi.fn(),
}))

const mockedGetUserSettings = vi.mocked(getUserSettings)

function settingsWithTheme(theme: string): UserSettings {
  return { user_id: 'local', theme } as UserSettings
}

let capturedUnlock: ((password: string) => Promise<void>) | null = null

function CaptureUnlock() {
  capturedUnlock = useLocalEncryption().unlock
  return null
}

function renderSkinProvider() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <LocalEncryptionProvider>
        <SkinProvider>
          <CaptureUnlock />
          <div data-testid="child" />
        </SkinProvider>
      </LocalEncryptionProvider>
    </QueryClientProvider>,
  )
}

function themeClasses(): string[] {
  return Array.from(document.documentElement.classList).filter((c) =>
    c.startsWith('theme-'),
  )
}

describe('SkinProvider', () => {
  beforeEach(() => {
    localStorage.clear()
    capturedUnlock = null
    document.documentElement.className = ''
    mockedGetUserSettings.mockReset()
  })

  afterEach(() => {
    localEncryption.lock()
    vi.restoreAllMocks()
  })

  describe('Normal Behavior', () => {
    it('sollte das Theme aus den geladenen Einstellungen anwenden und lokal merken', async () => {
      mockedGetUserSettings.mockResolvedValue(settingsWithTheme('legacy'))

      renderSkinProvider()

      await waitFor(() => expect(themeClasses()).toEqual(['theme-legacy']))
      expect(localStorage.getItem('skin')).toBe('legacy')
    })

    it('sollte beim Start die zuletzt gemerkte Skin sofort anwenden (Fast Boot)', async () => {
      localStorage.setItem('skin', 'legacy')
      mockedGetUserSettings.mockResolvedValue(settingsWithTheme('legacy'))

      renderSkinProvider()

      expect(themeClasses()).toEqual(['theme-legacy'])
    })
  })

  describe('Edge Cases (Tresor gesperrt)', () => {
    it('sollte die lokale Skin behalten, solange die Einstellungen gesperrt sind', async () => {
      await localEncryption.enable('test-passwort-123')
      localEncryption.lock()
      localStorage.setItem('skin', 'legacy')
      mockedGetUserSettings.mockRejectedValue(new LocalEncryptionLockedError())

      renderSkinProvider()

      await waitFor(() => expect(mockedGetUserSettings).toHaveBeenCalled())
      // Fehlgeschlagene Query darf NICHT auf 'ruhe' zurückfallen
      expect(themeClasses()).toEqual(['theme-legacy'])
      expect(localStorage.getItem('skin')).toBe('legacy')
    })
  })

  describe('Regression Protection', () => {
    it('[REGRESSION] sollte nach dem Entsperren das gespeicherte Theme laden statt bei "ruhe" zu bleiben', async () => {
      await localEncryption.enable('test-passwort-123')
      localEncryption.lock()
      // Zustand aus dem Bug: localStorage wurde bereits mit 'ruhe' überschrieben,
      // das eigentliche Theme ('legacy', dunkelblau) liegt verschlüsselt in den Settings.
      localStorage.setItem('skin', 'ruhe')
      mockedGetUserSettings.mockImplementation(async () => {
        if (!localEncryption.isUnlocked()) throw new LocalEncryptionLockedError()
        return settingsWithTheme('legacy')
      })

      renderSkinProvider()

      await waitFor(() => expect(mockedGetUserSettings).toHaveBeenCalled())
      expect(themeClasses()).toEqual(['theme-ruhe'])

      await act(async () => {
        await capturedUnlock!('test-passwort-123')
      })

      // Nach dem Entsperren wird die Settings-Query neu geladen und das
      // gespeicherte Theme angewandt + lokal geheilt.
      await waitFor(() => expect(themeClasses()).toEqual(['theme-legacy']))
      expect(localStorage.getItem('skin')).toBe('legacy')
    })
  })
})
