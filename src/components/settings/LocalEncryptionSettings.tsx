import { useMemo, useState } from 'react'
import { Shield, Lock, Unlock, KeyRound, Trash2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { showError, showSuccess } from '@/utils/toast'
import { estimatePasswordStrength } from '@/services/local-crypto'
import { useLocalEncryption } from '@/components/providers/LocalEncryptionProvider'

export function LocalEncryptionSettings() {
  const { enabled, unlocked, enable, unlock, lock, disable } = useLocalEncryption()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)

  const strength = useMemo(() => estimatePasswordStrength(password), [password])

  const handleEnable = async () => {
    if (!password) return
    if (password !== confirm) {
      showError('Passwörter stimmen nicht überein')
      return
    }

    setBusy(true)
    try {
      await enable(password)
      setPassword('')
      setConfirm('')
      showSuccess('Lokale Verschlüsselung aktiviert')
    } catch (e: any) {
      showError(e?.message || 'Aktivierung fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }

  const handleUnlock = async () => {
    if (!password) return
    setBusy(true)
    try {
      await unlock(password)
      setPassword('')
      showSuccess('Entsperrt')
    } catch (e: any) {
      showError(e?.message || 'Entsperren fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }

  const handleDisable = async () => {
    if (!password) return
    setBusy(true)
    try {
      await disable(password)
      setPassword('')
      setConfirm('')
      showSuccess('Lokale Verschlüsselung deaktiviert')
    } catch (e: any) {
      showError(e?.message || 'Deaktivierung fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="ui-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-emerald-500" />
          Lokale Verschlüsselung
        </CardTitle>
        <CardDescription>
          Verschlüsselt lokale Finanzdaten (Transaktionen) mit einem Passwort (AES‑GCM + PBKDF2).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription className="text-sm">
            Wichtig: Wenn du das Passwort vergisst, können die lokalen Daten nicht wiederhergestellt werden.
          </AlertDescription>
        </Alert>

        <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/40 p-3">
          <div className="text-sm">
            Status:{' '}
            <span className={enabled ? 'text-emerald-400' : 'text-slate-400'}>
              {enabled ? (unlocked ? 'aktiv (entsperrt)' : 'aktiv (gesperrt)') : 'inaktiv'}
            </span>
          </div>
          {enabled && unlocked ? (
            <Button variant="outline" onClick={lock} disabled={busy}>
              <Lock className="mr-2 h-4 w-4" />
              Sperren
            </Button>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="enc-password">Passwort</Label>
          <Input
            id="enc-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-slate-950 border-slate-700"
          />

          {!enabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="enc-confirm">Passwort bestätigen</Label>
                <Input
                  id="enc-confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="bg-slate-950 border-slate-700"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Passwortstärke</span>
                  <span>{strength.label}</span>
                </div>
                <Progress value={strength.score} />
              </div>
            </>
          )}
        </div>

        {!enabled ? (
          <Button className="w-full" onClick={handleEnable} disabled={busy || !password || password !== confirm}>
            <KeyRound className="mr-2 h-4 w-4" />
            Aktivieren
          </Button>
        ) : unlocked ? (
          <Button variant="destructive" className="w-full" onClick={handleDisable} disabled={busy || !password}>
            <Trash2 className="mr-2 h-4 w-4" />
            Deaktivieren (entschlüsselt lokal)
          </Button>
        ) : (
          <Button className="w-full" onClick={handleUnlock} disabled={busy || !password}>
            <Unlock className="mr-2 h-4 w-4" />
            Entsperren
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
