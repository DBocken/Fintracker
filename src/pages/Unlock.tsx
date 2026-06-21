import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Lock } from 'lucide-react'
import { useLocalEncryption } from '@/components/providers/LocalEncryptionProvider'

export default function UnlockPage() {
  const { enabled, unlocked, unlock } = useLocalEncryption()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
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
      setError((e as Error)?.message || 'Entsperren fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand/10 via-premium/10 to-transparent" />

      <Card variant="premium" className="z-10 w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lock className="h-5 w-5" />
            App entsperren
          </CardTitle>
          <CardDescription>
            Lokale Verschlüsselung ist aktiv. Bitte Passwort eingeben, um auf lokale Finanzdaten zuzugreifen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="unlock-password">Passwort</Label>
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
            {busy ? 'Entsperren…' : 'Entsperren'}
          </Button>

          <p className="text-xs text-muted-foreground">
            Hinweis: Das Passwort wird nicht gespeichert. Nach einem Refresh musst du erneut entsperren.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
