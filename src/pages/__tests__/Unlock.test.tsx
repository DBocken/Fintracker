import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import UnlockPage from '../Unlock'
import { LocalEncryptionProvider } from '@/components/providers/LocalEncryptionProvider'
import { I18nProvider } from '@/i18n/I18nProvider'
import { translations } from '@/i18n/translations'
import { localEncryption } from '@/services/local-crypto'
import * as reset from '@/services/local-data-reset'

const CORRECT_PASSWORD = 'ursprüngliches-passwort'

function renderUnlock(locale: 'de' | 'en' = 'de', initialEntry = '/unlock') {
  // local-crypto.ts (Service-Ebene) liest die Locale eigenständig aus
  // localStorage (resolveInitialLocale), unabhängig vom I18nProvider-Prop —
  // ohne diesen Sync würde die Fehlermeldung bei falschem Passwort in der
  // Browser-Default-Sprache statt der Test-Locale erscheinen.
  window.localStorage.setItem('ausgabentracker_locale_v1', locale)
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <I18nProvider initialLocale={locale}>
        <LocalEncryptionProvider>
          <Routes>
            <Route path="/unlock" element={<UnlockPage />} />
            <Route path="/" element={<div>HOME_MARKER</div>} />
          </Routes>
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

  describe('Entsperr-Flow (echtes Passwort)', () => {
    it('sollte den Entsperren-Button deaktivieren solange kein Passwort eingegeben wurde', async () => {
      const user = userEvent.setup()
      renderUnlock()
      const unlockButton = screen.getByRole('button', { name: /^Entsperren$/i })
      expect(unlockButton).toBeDisabled()

      await user.type(screen.getByLabelText(/passwort/i), 'x')
      expect(unlockButton).not.toBeDisabled()
    })

    it('sollte bei falschem Passwort eine Fehlermeldung zeigen und NICHT navigieren', async () => {
      const user = userEvent.setup()
      renderUnlock()

      await user.type(screen.getByLabelText(/passwort/i), 'falsches-passwort')
      await user.click(screen.getByRole('button', { name: /^Entsperren$/i }))

      expect(await screen.findByText(/Falsches Passwort/i)).toBeInTheDocument()
      // Bleibt auf der Entsperr-Seite, keine Navigation zur Startseite.
      expect(screen.getByText('App entsperren')).toBeInTheDocument()
      expect(screen.queryByText('HOME_MARKER')).not.toBeInTheDocument()
    })

    it('sollte bei korrektem Passwort entsperren und zur nächsten Seite navigieren', async () => {
      const user = userEvent.setup()
      renderUnlock('de', '/unlock?next=%2F')

      await user.type(screen.getByLabelText(/passwort/i), CORRECT_PASSWORD)
      await user.click(screen.getByRole('button', { name: /^Entsperren$/i }))

      await waitFor(() => expect(screen.getByText('HOME_MARKER')).toBeInTheDocument())
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
        let deValue: unknown = de
        let enValue: unknown = en

        path.forEach((p) => {
          expect((deValue as Record<string, unknown>)[p]).toBeDefined()
          expect((enValue as Record<string, unknown>)[p]).toBeDefined()
          deValue = (deValue as Record<string, unknown>)[p]
          enValue = (enValue as Record<string, unknown>)[p]
        })

        expect(typeof deValue).toBe('string')
        expect(typeof enValue).toBe('string')
      })
    })
  })
})
