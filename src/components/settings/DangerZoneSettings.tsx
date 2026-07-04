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
import { useI18n } from '@/i18n/useI18n';

type DeleteKind = 'local' | 'account' | null;

/**
 * Datenschutz-„Gefahrenzone" (Issue #31): lokale Daten löschen (auch anonym)
 * und – für eingeloggte Nutzer – das Konto inkl. Cloud-Daten löschen.
 * Beide Aktionen erfordern eine zweistufige Bestätigung (Tippen von „löschen").
 */
export function DangerZoneSettings() {
  const { t } = useI18n();
  const { status } = useAuth();
  const isAuthenticated = status === 'authenticated';

  const [kind, setKind] = useState<DeleteKind>(null);
  const [confirmText, setConfirmText] = useState('');
  const [alsoLocal, setAlsoLocal] = useState(true);
  const [busy, setBusy] = useState(false);

  const confirmWord = t('dangerZoneSettings.confirmWord');
  const open = kind !== null;
  const confirmed = confirmText.trim().toLowerCase() === confirmWord;

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
        showSuccess(t('dangerZoneSettings.localDataDeletedSuccess'));
        close();
        setTimeout(() => window.location.reload(), 800);
      } else {
        await deleteAccount({ alsoLocal });
        showSuccess(t('dangerZoneSettings.accountDeletedSuccess'));
        close();
        setTimeout(() => window.location.reload(), 800);
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : t('dangerZoneSettings.deleteFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-destructive">
        <AlertTriangle className="h-4 w-4" />
        {t('dangerZoneSettings.dangerZoneHeading')}
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium text-foreground">{t('dangerZoneSettings.localDataDeleteTitle')}</div>
            <p className="text-sm text-muted-foreground">
              {t('dangerZoneSettings.localDataDeleteDescription')}
            </p>
          </div>
          <Button variant="outline" className="shrink-0" onClick={() => setKind('local')}>
            <Trash2 className="mr-2 h-4 w-4" />
            {t('dangerZoneSettings.localDataDeleteButton')}
          </Button>
        </div>

        {isAuthenticated && (
          <div className="flex flex-col gap-2 border-t border-destructive/20 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-medium text-foreground">{t('dangerZoneSettings.accountDeleteTitle')}</div>
              <p className="text-sm text-muted-foreground">
                {t('dangerZoneSettings.accountDeleteDescription')}
              </p>
            </div>
            <Button variant="destructive" className="shrink-0" onClick={() => setKind('account')}>
              <Trash2 className="mr-2 h-4 w-4" />
              {t('dangerZoneSettings.accountDeleteButton')}
            </Button>
          </div>
        )}
      </div>

      <AlertDialog open={open} onOpenChange={(next) => !next && close()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {kind === 'account' ? t('dangerZoneSettings.accountDeleteDialogTitle') : t('dangerZoneSettings.localDeleteDialogTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {kind === 'account'
                ? t('dangerZoneSettings.accountDeleteDialogDescription')
                : t('dangerZoneSettings.localDeleteDialogDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {kind === 'account' && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={alsoLocal}
                onChange={(e) => setAlsoLocal(e.target.checked)}
              />
              {t('dangerZoneSettings.alsoDeleteLocalCheckbox')}
            </label>
          )}

          <div className="space-y-2">
            <Label htmlFor="delete-confirm">
              {t('dangerZoneSettings.confirmLabel').replace('{word}', confirmWord)}
            </Label>
            <Input
              id="delete-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              aria-label={t('dangerZoneSettings.confirmAriaLabel').replace('{word}', confirmWord)}
            />
          </div>

          <AlertDialogFooter>
            <Button variant="outline" onClick={close} disabled={busy}>
              {t('dangerZoneSettings.cancelButton')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={!confirmed || busy}
            >
              {busy ? t('dangerZoneSettings.confirmButtonBusy') : t('dangerZoneSettings.confirmButton')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default DangerZoneSettings;
