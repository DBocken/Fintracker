import { useState } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/components/providers/AuthProvider';
import { deleteAccount, deleteLocalData } from '@/services/account-deletion-service';
import { showError, showSuccess } from '@/utils/toast';

const CONFIRM_WORD = 'löschen';

type DeleteKind = 'local' | 'account' | null;

/**
 * Datenschutz-„Gefahrenzone" (Issue #31): lokale Daten löschen (auch anonym)
 * und – für eingeloggte Nutzer – das Konto inkl. Cloud-Daten löschen.
 * Beide Aktionen erfordern eine zweistufige Bestätigung (Tippen von „löschen").
 */
export function DangerZoneSettings() {
  const { status } = useAuth();
  const isAuthenticated = status === 'authenticated';

  const [kind, setKind] = useState<DeleteKind>(null);
  const [confirmText, setConfirmText] = useState('');
  const [alsoLocal, setAlsoLocal] = useState(true);
  const [busy, setBusy] = useState(false);

  const open = kind !== null;
  const confirmed = confirmText.trim().toLowerCase() === CONFIRM_WORD;

  function close() {
    setKind(null);
    setConfirmText('');
  }

  async function handleConfirm() {
    if (!confirmed || !kind) return;
    setBusy(true);
    try {
      if (kind === 'local') {
        await deleteLocalData();
        showSuccess('Lokale Daten gelöscht');
        close();
        setTimeout(() => window.location.reload(), 800);
      } else {
        await deleteAccount({ alsoLocal });
        showSuccess('Konto und Daten gelöscht');
        close();
        setTimeout(() => window.location.reload(), 800);
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Löschen fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-destructive">
        <AlertTriangle className="h-4 w-4" />
        Gefahrenzone
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium text-white">Lokale Daten löschen</div>
            <p className="text-sm text-muted-foreground">
              Entfernt alle auf diesem Gerät gespeicherten Daten (Transaktionen, Konten,
              Schulden, Einstellungen). Cloud-Daten bleiben erhalten.
            </p>
          </div>
          <Button variant="outline" className="shrink-0" onClick={() => setKind('local')}>
            <Trash2 className="mr-2 h-4 w-4" />
            Lokale Daten löschen
          </Button>
        </div>

        {isAuthenticated && (
          <div className="flex flex-col gap-2 border-t border-destructive/20 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-medium text-white">Konto löschen</div>
              <p className="text-sm text-muted-foreground">
                Löscht dein Konto endgültig: serverseitige Daten, Bankverbindungen
                (GoCardless) und den Zugang. Dieser Schritt kann nicht rückgängig gemacht werden.
              </p>
            </div>
            <Button variant="destructive" className="shrink-0" onClick={() => setKind('account')}>
              <Trash2 className="mr-2 h-4 w-4" />
              Konto löschen
            </Button>
          </div>
        )}
      </div>

      <AlertDialog open={open} onOpenChange={(next) => !next && close()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {kind === 'account' ? 'Konto endgültig löschen?' : 'Lokale Daten löschen?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {kind === 'account'
                ? 'Alle serverseitigen Daten, Bankverbindungen und dein Zugang werden dauerhaft entfernt. Dieser Schritt ist endgültig.'
                : 'Alle lokal gespeicherten Daten auf diesem Gerät werden entfernt. Dieser Schritt ist endgültig.'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {kind === 'account' && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={alsoLocal}
                onChange={(e) => setAlsoLocal(e.target.checked)}
              />
              Auch die lokalen Daten auf diesem Gerät löschen
            </label>
          )}

          <div className="space-y-2">
            <Label htmlFor="delete-confirm">
              Tippe <span className="font-mono font-semibold">{CONFIRM_WORD}</span> zur Bestätigung
            </Label>
            <Input
              id="delete-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              aria-label={`Bestätigung – tippe ${CONFIRM_WORD}`}
            />
          </div>

          <AlertDialogFooter>
            <Button variant="outline" onClick={close} disabled={busy}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={!confirmed || busy}
            >
              {busy ? 'Wird gelöscht…' : 'Endgültig löschen'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default DangerZoneSettings;
