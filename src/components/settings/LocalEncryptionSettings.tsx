import { useMemo, useState } from 'react';
import { Shield, Lock, Unlock, KeyRound, Trash2, FileKey2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { showError, showSuccess } from '@/utils/toast';
import { estimatePasswordStrength } from '@/services/local-crypto';
import { useLocalEncryption } from '@/components/providers/LocalEncryptionProvider';

export function LocalEncryptionSettings() {
  const { enabled, unlocked, enable, unlock, lock, disable } = useLocalEncryption();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const strength = useMemo(() => estimatePasswordStrength(password), [password]);

  const handleEnable = async () => {
    if (!password) return;
    if (password !== confirm) {
      showError('Passphrasen stimmen nicht überein');
      return;
    }

    setBusy(true);
    try {
      await enable(password);
      setPassword('');
      setConfirm('');
      showSuccess('Lokale Verschlüsselung aktiviert');
    } catch (e: any) {
      showError(e?.message || 'Aktivierung fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  };

  const handleUnlock = async () => {
    if (!password) return;
    setBusy(true);
    try {
      await unlock(password);
      setPassword('');
      showSuccess('Sync-Datei entsperrt');
    } catch (e: any) {
      showError(e?.message || 'Entsperren fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    if (!password) return;
    setBusy(true);
    try {
      await disable(password);
      setPassword('');
      setConfirm('');
      showSuccess('Lokale Verschlüsselung deaktiviert');
    } catch (e: any) {
      showError(e?.message || 'Deaktivierung fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="ui-card border-slate-800 bg-slate-950/70">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Shield className="h-5 w-5 text-emerald-400" />
          Passphrase & lokale Verschlüsselung
        </CardTitle>
        <CardDescription className="text-slate-400">
          Diese Passphrase schützt deine lokalen Finanzdaten und die zukünftige Sync-Datei.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <Alert className="border-amber-700 bg-amber-950/30">
          <AlertDescription className="text-sm text-amber-100">
            Wichtig: Wenn du die Passphrase vergisst, können die lokal verschlüsselten Daten nicht wiederhergestellt
            werden.
          </AlertDescription>
        </Alert>

        <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="text-sm text-slate-300">
            Status:{' '}
            <span className={enabled ? 'text-emerald-400' : 'text-slate-400'}>
              {enabled ? (unlocked ? 'aktiv und entsperrt' : 'aktiv und gesperrt') : 'noch nicht eingerichtet'}
            </span>
          </div>

          {enabled && unlocked ? (
            <Button
              variant="outline"
              onClick={lock}
              disabled={busy}
              className="border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800"
            >
              <Lock className="mr-2 h-4 w-4" />
              Sperren
            </Button>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
            <FileKey2 className="h-4 w-4 text-emerald-400" />
            Passphrase verwalten
          </div>

          <div className="space-y-2">
            <Label htmlFor="enc-password" className="text-slate-300">
              Passphrase
            </Label>
            <Input
              id="enc-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-slate-700 bg-slate-950 text-white"
            />

            {!enabled && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="enc-confirm" className="text-slate-300">
                    Passphrase bestätigen
                  </Label>
                  <Input
                    id="enc-confirm"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="border-slate-700 bg-slate-950 text-white"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Stärke</span>
                    <span>{strength.label}</span>
                  </div>
                  <Progress value={strength.score} />
                </div>
              </>
            )}
          </div>
        </div>

        {!enabled ? (
          <Button
            className="w-full bg-emerald-600 text-white hover:bg-emerald-500"
            onClick={handleEnable}
            disabled={busy || !password || password !== confirm}
          >
            <KeyRound className="mr-2 h-4 w-4" />
            Passphrase einrichten
          </Button>
        ) : unlocked ? (
          <Button
            variant="destructive"
            className="w-full"
            onClick={handleDisable}
            disabled={busy || !password}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Verschlüsselung deaktivieren
          </Button>
        ) : (
          <Button
            className="w-full bg-emerald-600 text-white hover:bg-emerald-500"
            onClick={handleUnlock}
            disabled={busy || !password}
          >
            <Unlock className="mr-2 h-4 w-4" />
            Mit Passphrase entsperren
          </Button>
        )}
      </CardContent>
    </Card>
  );
}