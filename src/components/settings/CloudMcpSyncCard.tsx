import { useEffect, useState } from 'react';
import { AlertTriangle, Cloud, CloudOff, Copy, RefreshCw, ShieldAlert } from 'lucide-react';
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
import { showError, showSuccess } from '@/utils/toast';
import { useI18n } from '@/i18n/useI18n';
import {
  disableCloudMcpSync,
  enableCloudMcpSync,
  getCloudMcpSyncStatus,
  getStoredConnectorUrl,
  hasValidConsent,
  MCP_CONFIRM_PHRASE,
  syncCloudMcpAggregates,
} from '@/services/cloud-mcp-sync-service';

/**
 * Proof of Concept (Issue: MCP-Sprachabfrage). Schaltet – nur mit DOPPELTER
 * roter Bestätigung – einen Cloud-Sync der Finanz-AGGREGATE frei, damit Claude/
 * ChatGPT sie per Connector lesen können. Widerspricht bewusst dem Local-only-
 * Designkonzept (siehe docs/mcp-poc.md). Es verlassen ausschließlich Aggregate
 * das Gerät – niemals Rohtransaktionen.
 */
export function CloudMcpSyncCard() {
  const { t } = useI18n();
  const { status } = useAuth();
  const isAuthenticated = status === 'authenticated';

  const [enabled, setEnabled] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [ack, setAck] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [connectorUrl, setConnectorUrl] = useState<string | null>(null);
  const [tokenOnce, setTokenOnce] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    setConnectorUrl(getStoredConnectorUrl());
    getCloudMcpSyncStatus()
      .then((s) => {
        setEnabled(s.enabled);
        setLastSyncedAt(s.lastSyncedAt);
      })
      .catch(() => undefined);
  }, [isAuthenticated]);

  const consentOk = hasValidConsent({ acknowledgedRisk: ack, confirmPhrase: phrase });

  function resetDialog() {
    setDialogOpen(false);
    setAck(false);
    setPhrase('');
  }

  async function handleEnable() {
    if (!consentOk) return;
    setBusy(true);
    try {
      const result = await enableCloudMcpSync({ acknowledgedRisk: ack, confirmPhrase: phrase });
      setConnectorUrl(result.connectorUrl);
      setTokenOnce(result.token);
      setEnabled(true);
      setLastSyncedAt(new Date().toISOString());
      resetDialog();
      showSuccess(t('settings.cloudMcpSync.successEnabledMessage'));
    } catch (error) {
      showError(error instanceof Error ? error.message : t('settings.cloudMcpSync.errorMessage').replace('{error}', t('settings.cloudMcpSync.enableButton')));
    } finally {
      setBusy(false);
    }
  }

  async function handleSync() {
    setBusy(true);
    try {
      const { updatedAt } = await syncCloudMcpAggregates();
      setLastSyncedAt(updatedAt);
      showSuccess(t('settings.cloudMcpSync.successSyncMessage'));
    } catch (error) {
      showError(error instanceof Error ? error.message : t('settings.cloudMcpSync.errorMessage').replace('{error}', t('settings.cloudMcpSync.synchronizeButton')));
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    setBusy(true);
    try {
      await disableCloudMcpSync();
      setEnabled(false);
      setLastSyncedAt(null);
      setConnectorUrl(null);
      setTokenOnce(null);
      showSuccess(t('settings.cloudMcpSync.successDisabledMessage'));
    } catch (error) {
      showError(error instanceof Error ? error.message : t('settings.cloudMcpSync.errorMessage').replace('{error}', t('settings.cloudMcpSync.disableButton')));
    } finally {
      setBusy(false);
    }
  }

  function copy(value: string, label: string) {
    navigator.clipboard
      .writeText(value)
      .then(() => showSuccess(t('settings.cloudMcpSync.successCopied').replace('{label}', label)))
      .catch(() => showError(t('settings.cloudMcpSync.copyFailed')));
  }

  return (
    <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5">
      <div className="mb-1 flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400">
        <ShieldAlert className="h-4 w-4" />
        {t('settings.cloudMcpSync.title')}
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        {t('settings.cloudMcpSync.description')}{' '}
        <strong className="text-amber-600 dark:text-amber-400">
          {t('settings.cloudMcpSync.localOnlyWarning')}
        </strong>{' '}
        {t('settings.cloudMcpSync.rawDataStay')}{' '}
        {/* SEC-5: Umfang + Speicherform stehen am Schalter selbst, bevor
            überhaupt ein Login oder die doppelte Bestätigung erfolgt —
            nicht nur in docs/mcp-poc.md. */}
        <strong className="text-amber-600 dark:text-amber-400">
          {t('settings.cloudMcpSync.plaintextStorageNotice')}
        </strong>
      </p>

      {!isAuthenticated && (
        <p className="text-sm text-muted-foreground">
          {t('settings.cloudMcpSync.loginRequired')}
        </p>
      )}

      {isAuthenticated && (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              {t('settings.cloudMcpSync.status')}{' '}
              <span className={enabled ? 'font-medium text-emerald-600' : 'font-medium text-foreground'}>
                {enabled ? t('settings.cloudMcpSync.active') : t('settings.cloudMcpSync.inactive')}
              </span>
              {lastSyncedAt && (
                <> · {t('settings.cloudMcpSync.lastSynced')} {new Date(lastSyncedAt).toLocaleString('de-DE')}</>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              {enabled ? (
                <>
                  <Button variant="outline" onClick={handleSync} disabled={busy}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {t('settings.cloudMcpSync.synchronizeButton')}
                  </Button>
                  <Button variant="destructive" onClick={handleDisable} disabled={busy}>
                    <CloudOff className="mr-2 h-4 w-4" />
                    {t('settings.cloudMcpSync.disableButton')}
                  </Button>
                </>
              ) : (
                <Button
                  className="bg-warning text-warning-foreground hover:bg-warning/90"
                  onClick={() => setDialogOpen(true)}
                  disabled={busy}
                >
                  <Cloud className="mr-2 h-4 w-4" />
                  {t('settings.cloudMcpSync.enableButton')}
                </Button>
              )}
            </div>
          </div>

          {enabled && connectorUrl && (
            <div className="space-y-3 rounded-xl border border-amber-500/40 bg-background p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Cloud className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                {t('settings.cloudMcpSync.connectorInstructions')}
              </div>
              <FieldCopy label={t('settings.cloudMcpSync.connectorLabel')} value={connectorUrl} onCopy={copy} t={t} />

              <ol className="ml-4 list-decimal space-y-1 text-sm text-muted-foreground">
                <li>{t('settings.cloudMcpSync.step1')}</li>
                <li>{t('settings.cloudMcpSync.step2')}</li>
                <li>{t('settings.cloudMcpSync.step3')}</li>
              </ol>

              {tokenOnce && (
                <p className="text-xs text-muted-foreground">
                  {t('settings.cloudMcpSync.tokenWarning')}
                </p>
              )}
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {t('settings.cloudMcpSync.voiceModeNote')}
              </p>
            </div>
          )}

          {enabled && !connectorUrl && (
            <p className="rounded-xl border border-muted bg-background p-3 text-sm text-muted-foreground">
              {t('settings.cloudMcpSync.connectorUrlWarning')}
            </p>
          )}
        </div>
      )}

      {/* Stufe 1 + 2: doppelte rote Bestätigung */}
      <AlertDialog open={dialogOpen} onOpenChange={(next) => !next && resetDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {t('settings.cloudMcpSync.confirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-left">
                <p className="font-medium text-destructive">
                  {t('settings.cloudMcpSync.confirmWarning')}
                </p>
                <p>
                  {t('settings.cloudMcpSync.confirmAggregateDetails')}
                </p>
                <p className="text-xs">
                  {t('settings.cloudMcpSync.confirmProofOfConcept')}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <label className="flex items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="mt-1"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
            />
            <span>
              {t('settings.cloudMcpSync.confirmCheckbox')}
            </span>
          </label>

          <div className="space-y-2">
            <Label htmlFor="mcp-confirm">
              {t('settings.cloudMcpSync.confirmLabel')}{' '}
              <span className="font-mono font-semibold">{MCP_CONFIRM_PHRASE}</span>
            </Label>
            <Input
              id="mcp-confirm"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              autoComplete="off"
              aria-label={t('settings.cloudMcpSync.confirmPhraseAriaLabel').replace('{phrase}', MCP_CONFIRM_PHRASE)}
            />
          </div>

          <AlertDialogFooter>
            <Button variant="outline" onClick={resetDialog} disabled={busy}>
              {t('settings.cloudMcpSync.cancelButton')}
            </Button>
            <Button
              className="bg-warning text-warning-foreground hover:bg-warning/90"
              onClick={handleEnable}
              disabled={!consentOk || busy}
            >
              {t('settings.cloudMcpSync.confirmButton')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FieldCopy({
  label,
  value,
  onCopy,
  t,
}: {
  label: string;
  value: string;
  onCopy: (value: string, label: string) => void;
  t: (key: string, fallback?: string) => string;
}) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2">
        <code className="flex-1 overflow-x-auto rounded-lg bg-muted px-3 py-2 text-xs">{value}</code>
        <Button variant="outline" size="icon" onClick={() => onCopy(value, label)} aria-label={t('settings.cloudMcpSync.copyFieldAriaLabel').replace('{label}', label)}>
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default CloudMcpSyncCard;
