import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import UnlockPage from './Unlock'
import { LocalEncryptionProvider } from '@/components/providers/LocalEncryptionProvider'
import { I18nProvider } from '@/i18n/I18nProvider'
import { translations } from '@/i18n/translations'
import { localEncryption } from '@/services/local-crypto'
import * as reset from '@/services/local-data-reset'

function renderUnlock(locale: 'de' | 'en' = 'de') {
  return render(
    <MemoryRouter initialEntries={['/unlock']}>
      <I18nProvider initialLocale={locale}>
        <LocalEncryptionProvider>
          <UnlockPage />
        </LocalEncryptionProvider>
      </I18nProvider>
    </MemoryRouter>,
  )
}

describe('UnlockPage – Lokale Instanz zurücksetzen (Passwort vergessen)', () => {
  beforeEach(async () => {
    localStorage.clear()
    // Verschlüsselung aktivieren und sofort sperren → Zustand „aktiv & gesperrt“,
    // wie wenn der Nutzer die App neu öffnet und das Passwort vergessen hat.
    await localEncryption.enable('ursprüngliches-passwort')
    localEncryption.lock()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Normal Behavior', () => {
    it('sollte eine Option anbieten, die lokale Instanz zu löschen', () => {
      renderUnlock()
      expect(
        screen.getByRole('button', { name: /lokale instanz löschen/i }),
      ).toBeInTheDocument()
    })

    it('sollte nach Bestätigung die lokalen Daten löschen und neu starten', async () => {
      const clearSpy = vi.spyOn(reset, 'clearAllLocalData').mockResolvedValue()
      const user = userEvent.setup()
      renderUnlock()

      await user.click(screen.getByRole('button', { name: /lokale instanz löschen/i }))

      const confirmInput = await screen.findByLabelText(/tippe.*löschen/i)
      await user.type(confirmInput, 'löschen')

      await user.click(screen.getByRole('button', { name: /endgültig löschen/i }))

      await waitFor(() => expect(clearSpy).toHaveBeenCalledTimes(1))
    })
  })

  describe('Edge Cases', () => {
    it('sollte ohne korrekte Bestätigung nicht löschen', async () => {
      const clearSpy = vi.spyOn(reset, 'clearAllLocalData').mockResolvedValue()
      const user = userEvent.setup()
      renderUnlock()

      await user.click(screen.getByRole('button', { name: /lokale instanz löschen/i }))

      // Bestätigungs-Button ist deaktiviert, solange „löschen” nicht getippt wurde.
      expect(screen.getByRole('button', { name: /endgültig löschen/i })).toBeDisabled()

      await user.type(screen.getByLabelText(/tippe.*löschen/i), 'falsch')
      expect(screen.getByRole('button', { name: /endgültig löschen/i })).toBeDisabled()

      expect(clearSpy).not.toHaveBeenCalled()
    })
  })

  describe('i18n Compliance', () => {
    it('sollte deutsche Texte rendern', () => {
      renderUnlock('de')
      expect(screen.getByText('App entsperren')).toBeInTheDocument()
      expect(
        screen.getByText(/Lokale Verschlüsselung ist aktiv/i),
      ).toBeInTheDocument()
    })

    it('sollte englische Texte rendern', () => {
      renderUnlock('en')
      expect(screen.getByText('Unlock app')).toBeInTheDocument()
      expect(
        screen.getByText(/Local encryption is active/i),
      ).toBeInTheDocument()
    })

    it('[REGRESSION] sollte alle i18n-Keys in beiden Sprachen haben', () => {
      const requiredKeys = [
        'unlock.title',
        'unlock.description',
        'unlock.passwordLabel',
        'unlock.unlockButton',
        'unlock.unlockButtonLoading',
        'unlock.passwordHint',
        'unlock.forgotPasswordHint',
        'unlock.resetButton',
        'unlock.resetTitle',
        'unlock.resetDescription',
        'unlock.resetConfirmLabel',
        'unlock.resetConfirmAriaLabel',
        'unlock.resetConfirmButton',
        'unlock.resetConfirmButtonLoading',
        'unlock.resetCancelButton',
      ]

      const { de, en } = translations

      requiredKeys.forEach((key) => {
        const path = key.split('.')
        let deValue: any = de
        let enValue: any = en

        path.forEach((p) => {
          expect(deValue[p]).toBeDefined()
          expect(enValue[p]).toBeDefined()
          deValue = deValue[p]
          enValue = enValue[p]
        })

        expect(typeof deValue).toBe('string')
        expect(typeof enValue).toBe('string')
      })
    })
  })
})
