import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  BarChart3,
  Database,
  FileKey2,
  FileLock2,
  FolderSync,
  HardDrive,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { showError, showSuccess } from '@/utils/toast';
import { useLocalEncryption } from '@/components/providers/LocalEncryptionProvider';
import { useI18n } from '@/i18n/useI18n';
import { getLocalFinanceStorageStatus } from '@/services/local-finance-store';
import {
  exportEncryptedSnapshot,
  getLatestSyncMetadata,
  getSyncPaths,
  importEncryptedSnapshot,
  SnapshotOlderVersionError,
  removeSyncPath,
  saveSyncPath,
  type SnapshotVersionComparison,
} from '@/services/snapshot-sync-service';
import { SnapshotVersionConflictDialog } from './SnapshotVersionConflictDialog';

function StatusBadge({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <Badge
      className={
        ok
          ? 'bg-positive text-positive-foreground hover:bg-positive'
          : 'bg-warning text-warning-foreground hover:bg-warning'
      }
    >
      {children}
    </Badge>
  );
}

export function PrivacySyncAnalyticsSettings() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const encryption = useLocalEncryption();
  const [pathLabel, setPathLabel] = useState(t('privacy.privacySync.labelField'));
  const [pathHint, setPathHint] = useState('');
  const [pathsVersion, setPathsVersion] = useState(0);
  const [storageStatus, setStorageStatus] = useState({
    encrypted: encryption.enabled,
    unlocked: encryption.unlocked,
    plaintextFound: false,
  });

  const [storagePersisted, setStoragePersisted] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void getLocalFinanceStorageStatus().then((status) => {
      if (active) setStorageStatus(status);
    });
    return () => {
      active = false;
    };
  }, [encryption.enabled, encryption.unlocked]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const persisted =
          typeof navigator !== 'undefined' && navigator.storage?.persisted
            ? await navigator.storage.persisted()
            : false;
        if (active) setStoragePersisted(persisted);
      } catch {
        if (active) setStoragePersisted(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // pathsVersion acts as a cache-bust counter; read it to satisfy exhaustive-deps
  const syncPaths = useMemo(() => { void pathsVersion; return getSyncPaths(); }, [pathsVersion]);
  const selectedPath = syncPaths[0];

  const latestSyncQuery = useQuery({
    queryKey: ['sync-metadata-latest'],
    queryFn: getLatestSyncMetadata,
    retry: false,
  });

  const snapshotMutation = useMutation({
    mutationFn: () => exportEncryptedSnapshot(selectedPath?.label, selectedPath?.pathHint),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-metadata-latest'] });
      showSuccess(t('privacy.privacySync.downloadSuccess'));
    },
    onError: (error: Error) => showError(error.message),
  });

  const [pendingImport, setPendingImport] = useState<{
    file: File;
    comparison: SnapshotVersionComparison;
  } | null>(null);

  const importSnapshotMutation = useMutation({
    mutationFn: ({ file, acknowledgeOlder }: { file: File; acknowledgeOlder?: boolean }) =>
      importEncryptedSnapshot(file, { acknowledgeOlder }),
    onSuccess: (snapshot) => {
      queryClient.invalidateQueries({ queryKey: ['sync-metadata-latest'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-positions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setPendingImport(null);
      showSuccess(t('privacy.privacySync.importSuccess').replace('{version}', String(snapshot.snapshot_version)));
    },
    // RES-4: Die Fläche fragt nicht vorher, ob sie darf — sie reagiert auf
    // die Absage. Der Service ist der einzige Ort, der über den Versionsstand
    // entscheidet (SnapshotOlderVersionError trägt den Vergleich mit), und
    // eine zweite Meinung in der Oberfläche könnte davon abdriften. Der
    // Preis: Auf dem Konfliktpfad wird die Datei zweimal entschlüsselt —
    // seltener Fall, kleine Datei, dafür genau ein Codepfad.
    onError: (error: Error, variables) => {
      if (error instanceof SnapshotOlderVersionError) {
        setPendingImport({ file: variables.file, comparison: error.comparison });
        return;
      }
      showError(error.message);
    },
  });

  const handleImportFileSelected = (file: File) => {
    importSnapshotMutation.mutate({ file });
  };

  const addPath = () => {
    if (!pathHint.trim()) {
      showError(t('privacy.privacySync.errorHintEmpty'));
      return;
    }

    saveSyncPath(pathLabel, pathHint);
    setPathHint('');
    setPathsVersion((v) => v + 1);
    showSuccess(t('privacy.privacySync.successHintSaved'));
  };

  return (
    <Card className="ui-card border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <FolderSync className="h-5 w-5 text-positive" />
          {t('privacy.privacySync.title')}
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          {t('privacy.privacySync.description')}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <FileLock2 className="h-4 w-4 text-positive" />
              {t('privacy.privacySync.localDataTitle')}
            </div>
            <StatusBadge ok={storageStatus.encrypted}>
              {storageStatus.encrypted ? t('privacy.privacySync.statusEncrypted') : t('privacy.privacySync.statusNotEncrypted')}
            </StatusBadge>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <Database className="h-4 w-4 text-brand" />
              {t('privacy.privacySync.supabaseTitle')}
            </div>
            <StatusBadge ok>{t('privacy.privacySync.supabaseStatus')}</StatusBadge>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <HardDrive className="h-4 w-4 text-brand" />
              {t('privacy.privacySync.storageTitle')}
            </div>
            <StatusBadge ok={storagePersisted === true}>
              {storagePersisted === null
                ? t('privacy.privacySync.storageChecking')
                : storagePersisted
                  ? t('privacy.privacySync.storagePersisted')
                  : t('privacy.privacySync.storageNotPersisted')}
            </StatusBadge>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <FileKey2 className="h-4 w-4 text-premium" />
              {t('privacy.privacySync.syncFileTitle')}
            </div>
            <StatusBadge ok={!!encryption.enabled}>
              {encryption.enabled ? t('privacy.privacySync.syncFileReady') : t('privacy.privacySync.syncFileWaiting')}
            </StatusBadge>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <BarChart3 className="h-4 w-4 text-warning" />
              {t('privacy.privacySync.cloudDataTitle')}
            </div>
            <StatusBadge ok>{t('privacy.privacySync.cloudDataStatus')}</StatusBadge>
          </div>
        </div>

        <Alert className="border-positive/20 bg-positive/10">
          <Sparkles className="h-4 w-4 text-positive" />
          <AlertDescription className="text-sm text-positive">
            <strong>Gedanke für künftig:</strong> {t('privacy.privacySync.futureNote')}
          </AlertDescription>
        </Alert>

        {!storageStatus.encrypted && (
          <Alert className="border-warning bg-warning/30">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {t('privacy.privacySync.encryptionWarning')}
            </AlertDescription>
          </Alert>
        )}

        {storageStatus.plaintextFound && encryption.enabled && (
          <Alert className="border-warning bg-warning/30">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {t('privacy.privacySync.plaintextWarning')}
            </AlertDescription>
          </Alert>
        )}

        <div className="rounded-2xl border border-border bg-card p-4">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-foreground">
            <FolderSync className="h-4 w-4 text-positive" />
            {t('privacy.privacySync.syncPathInfo')}
          </h3>
          <p className="text-sm leading-6 text-muted-foreground">
            {t('privacy.privacySync.syncPathInfo')}
          </p>
        </div>

        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <h3 className="flex items-center gap-2 font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 text-positive" />
            {t('privacy.privacySync.manageTitle')}
          </h3>

          <p className="text-sm text-muted-foreground">
            {t('privacy.privacySync.manageDescription')}
          </p>

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <Label htmlFor="sync-path-label" className="text-foreground">{t('privacy.privacySync.labelField')}</Label>
              <Input
                id="sync-path-label"
                value={pathLabel}
                onChange={(e) => setPathLabel(e.target.value)}
                className="border-border bg-card text-foreground"
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="sync-path-hint" className="text-foreground">{t('privacy.privacySync.hintField')}</Label>
              <Input
                id="sync-path-hint"
                value={pathHint}
                onChange={(e) => setPathHint(e.target.value)}
                placeholder={t('privacy.privacySync.hintPlaceholder')}
                className="border-border bg-card text-foreground"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={addPath} className="border-border bg-card text-foreground hover:bg-accent">
              {t('privacy.privacySync.rememberButton')}
            </Button>

            <Button
              onClick={() => snapshotMutation.mutate()}
              disabled={!encryption.unlocked || snapshotMutation.isPending}
              className="bg-positive text-positive-foreground hover:bg-positive"
            >
              <FileLock2 className="mr-2 h-4 w-4" />
              {t('privacy.privacySync.downloadButton')}
            </Button>

            <label className="inline-flex cursor-pointer items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-accent">
              {t('privacy.privacySync.importButton')}
              <Input
                type="file"
                accept="application/json,.json"
                className="hidden"
                disabled={!encryption.unlocked || importSnapshotMutation.isPending}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleImportFileSelected(file);
                  event.currentTarget.value = '';
                }}
              />
            </label>
          </div>

          {syncPaths.length > 0 && (
            <div className="space-y-2 text-sm">
              {syncPaths.map((path) => (
                <div key={path.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3 text-foreground">
                  <span>
                    <strong>{path.label}:</strong> {path.pathHint}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    aria-label={t('privacy.privacySync.removePathLabel').replace('{label}', path.label)}
                    onClick={() => {
                      removeSyncPath(path.id);
                      setPathsVersion((v) => v + 1);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {t('privacy.privacySync.latestSyncLabel')}
            {latestSyncQuery.data
              ? `${latestSyncQuery.data.snapshot_id} · ${new Date(latestSyncQuery.data.created_at).toLocaleString('de-DE')}`
              : t('privacy.privacySync.latestSyncNone')}
          </p>
        </div>

        <div className="space-y-2 rounded-2xl border border-positive/20 bg-positive/10 p-4">
          <h3 className="flex items-center gap-2 font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 text-positive" />
            {t('privacy.privacySync.strictBoundaryTitle')}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t('privacy.privacySync.strictBoundaryDesc')}
          </p>
        </div>
      </CardContent>

      <SnapshotVersionConflictDialog
        comparison={pendingImport?.comparison ?? null}
        open={pendingImport !== null}
        onCancel={() => setPendingImport(null)}
        onConfirm={() => {
          if (pendingImport) {
            importSnapshotMutation.mutate({ file: pendingImport.file, acknowledgeOlder: true });
          }
        }}
      />
    </Card>
  );
}
