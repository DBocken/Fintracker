import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Lock, Trash2 } from 'lucide-react'
import { useLocalEncryption } from '@/components/providers/LocalEncryptionProvider'
import { useI18n } from '@/i18n/useI18n'
import { clearAllLocalData } from '@/services/local-data-reset'

const RESET_CONFIRM_WORD = 'löschen'

export default function UnlockPage() {
  const { t } = useI18n()
  const { enabled, unlocked, unlock, refresh } = useLocalEncryption()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetConfirm, setResetConfirm] = useState('')
  const [resetBusy, setResetBusy] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const nextPath = useMemo(() => {
    const sp = new URLSearchParams(location.search)
    return sp.get('next') || '/'
  }, [location.search])

  if (!enabled) {
    navigate('/', { replace: true })
    return null
  }

  if (unlocked) {
    navigate(nextPath, { replace: true })
    return null
  }

  const handleUnlock = async () => {
    setError(null)
    setBusy(true)
    try {
      await unlock(password)
      navigate(nextPath, { replace: true })
    } catch (e: unknown) {
      setError((e as Error)?.message || t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  const resetConfirmed = resetConfirm.trim().toLowerCase() === RESET_CONFIRM_WORD

  const closeReset = () => {
    setResetOpen(false)
    setResetConfirm('')
  }

  // Ausweg für vergessene Passphrase: Da die Daten verschlüsselt und ohne
  // Passwort nicht wiederherstellbar sind, ist das vollständige Löschen der
  // lokalen Instanz die einzige Möglichkeit, wieder blank zu starten.
  const handleReset = async () => {
    if (!resetConfirmed) return
    setResetBusy(true)
    try {
      await clearAllLocalData()
      closeReset()
      // Speicher ist geleert (inkl. Verschlüsselungs-Config) → Provider neu lesen
      // und auf die Startseite gehen; die App startet blank.
      refresh()
      navigate('/', { replace: true })
    } catch (e: unknown) {
      setError((e as Error)?.message || t('common.error'))
    } finally {
      setResetBusy(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand/10 via-premium/10 to-transparent" />

      <Card variant="premium" className="z-10 w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lock className="h-5 w-5" />
            {t('unlock.title')}
          </CardTitle>
          <CardDescription>
            {t('unlock.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="unlock-password">{t('unlock.passwordLabel')}</Label>
            <Input
              id="unlock-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleUnlock()
              }}
            />
          </div>

          <Button className="w-full" onClick={handleUnlock} disabled={!password || busy}>
            {busy ? t('unlock.unlockButtonLoading') : t('unlock.unlockButton')}
          </Button>

          <p className="text-xs text-muted-foreground">
            {t('unlock.passwordHint')}
          </p>

          <div className="border-t border-border pt-4">
            <p className="mb-2 text-xs text-muted-foreground">
              {t('unlock.forgotPasswordHint')}
            </p>
            <Button
              variant="outline"
              className="w-full text-destructive hover:text-destructive"
              onClick={() => setResetOpen(true)}
              disabled={busy}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t('unlock.resetButton')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={resetOpen} onOpenChange={(next) => !next && closeReset()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('unlock.resetTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('unlock.resetDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <Label htmlFor="reset-confirm">
              {t('unlock.resetConfirmLabel').split('{word}')[0]}
              <span className="font-mono font-semibold">{RESET_CONFIRM_WORD}</span>
              {t('unlock.resetConfirmLabel').split('{word}')[1]}
            </Label>
            <Input
              id="reset-confirm"
              value={resetConfirm}
              onChange={(e) => setResetConfirm(e.target.value)}
              autoComplete="off"
              aria-label={t('unlock.resetConfirmAriaLabel').replace('{word}', RESET_CONFIRM_WORD)}
            />
          </div>

          <AlertDialogFooter>
            <Button variant="outline" onClick={closeReset} disabled={resetBusy}>
              {t('unlock.resetCancelButton')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleReset}
              disabled={!resetConfirmed || resetBusy}
            >
              {resetBusy ? t('unlock.resetConfirmButtonLoading') : t('unlock.resetConfirmButton')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
