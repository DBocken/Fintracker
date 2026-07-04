import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nProvider } from '@/i18n/I18nProvider'
import { BackupManager } from './BackupManager'

function renderWithQuery(locale: 'de' | 'en' = 'de') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <I18nProvider initialLocale={locale}>
      <QueryClientProvider client={queryClient}>
        <BackupManager />
      </QueryClientProvider>
    </I18nProvider>,
  )
}

describe('BackupManager – Mobile-Skalierung', () => {
  // [REGRESSION] Der lange Button "Unverschlüsselt exportieren (Datenumzug)" hatte
  // per Button-Default whitespace-nowrap und zwang die Backup-Karte auf ~372px –
  // breiter als ein 360px-Viewport. Das verursachte horizontales Scrollen auf der
  // Einstellungen-Seite. Der Button muss umbrechen dürfen.
  it('[MOBILE][REGRESSION] sollte den Export-Button umbrechen lassen statt die Karte zu sprengen', () => {
    renderWithQuery('de')
    const button = screen.getByRole('button', { name: /Unverschlüsselt exportieren/i })
    expect(button.className).toContain('whitespace-normal')
    expect(button.className).not.toContain('whitespace-nowrap')
  })

  it('[MOBILE][REGRESSION] should allow export button wrapping in English', () => {
    renderWithQuery('en')
    const button = screen.getByRole('button', { name: /Export unencrypted/i })
    expect(button.className).toContain('whitespace-normal')
    expect(button.className).not.toContain('whitespace-nowrap')
  })
})
