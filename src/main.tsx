import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import '@fontsource-variable/inter'
import '@fontsource-variable/space-grotesk'
import '@fontsource-variable/orbitron'
import '@fontsource-variable/quicksand'
import './index.css'
import './skins/skins.css'
import './skins/skins-components.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'framer-motion'
import ToastProvider from './components/providers/ToastProvider'
import AuthProvider from './components/providers/AuthProvider'
import SkinProvider from './components/providers/SkinProvider'
import GentleModeProvider from './components/providers/GentleModeProvider'
import { ErrorBoundary } from './components/ErrorBoundary'
import { I18nProvider } from '@/i18n/I18nProvider'
import '@/integrations/capacitor/setup'
import { LocalEncryptionProvider } from '@/components/providers/LocalEncryptionProvider'
import { migrateLocalStorageToIdb } from './services/idb-kv'
import { applyDetectedContracts } from './services/contract-detection-service'

// Einmalige Migration der lokalen Bulk-Daten von localStorage nach IndexedDB
// (Issue #29). Fire-and-forget: Lese-Zugriffe migrieren fehlende Schlüssel
// notfalls selbst nach (Lazy-Fallback), daher muss der Render nicht warten.
void migrateLocalStorageToIdb()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Reduced-Motion-Policy (Audit C-P2/G): respektiert global
        prefers-reduced-motion für alle Framer-Motion-Animationen. */}
    <MotionConfig reducedMotion="user">
    <ErrorBoundary>
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <LocalEncryptionProvider>
              <SkinProvider>
                <GentleModeProvider>
                  <ToastProvider>
                    <App />
                  </ToastProvider>
                </GentleModeProvider>
              </SkinProvider>
            </LocalEncryptionProvider>
          </AuthProvider>
        </QueryClientProvider>
      </I18nProvider>
    </ErrorBoundary>
    </MotionConfig>
  </React.StrictMode>,
)

// Debug: Expose contract detection to console — nur im Dev-Build, damit das
// Debug-Objekt nicht in Produktion global exponiert wird (Audit D).
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as Window & typeof globalThis & { __debug?: unknown }).__debug = {
    applyDetectedContracts: async () => {
      console.log('🔍 Triggering contract detection...')
      try {
        await applyDetectedContracts()
        console.log('✅ Contract detection completed')
      } catch (error) {
        console.error('❌ Contract detection failed:', error)
      }
    },
  }
  console.log('💡 Debug available: window.__debug.applyDetectedContracts()')
}