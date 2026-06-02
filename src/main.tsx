import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './skins/skins.css'
import './skins/skins-components.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ToastProvider from './components/providers/ToastProvider'
import AuthProvider from './components/providers/AuthProvider'
import SkinProvider from './components/providers/SkinProvider'
import { ErrorBoundary } from './components/ErrorBoundary'
import '@/integrations/capacitor/setup'
import { LocalEncryptionProvider } from '@/components/providers/LocalEncryptionProvider'

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
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <LocalEncryptionProvider>
            <SkinProvider>
              <ToastProvider>
                <App />
              </ToastProvider>
            </SkinProvider>
          </LocalEncryptionProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)