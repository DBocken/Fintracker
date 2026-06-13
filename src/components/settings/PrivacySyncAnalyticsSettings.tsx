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
  UploadCloud,
  X,
} from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { showError, showSuccess } from '@/utils/toast';
import { useLocalEncryption } from '@/components/providers/LocalEncryptionProvider';
import { getLocalFinanceStorageStatus } from '@/services/local-finance-store';
import { getAnalyticsConsent, setAnalyticsConsent } from '@/services/analytics-consent-service';
import { uploadEncryptedAnalyticsPackage } from '@/services/analytics-aggregation-service';
import {
  exportEncryptedSnapshot,
  getLatestSyncMetadata,
  getSyncPaths,
  importEncryptedSnapshot,
  removeSyncPath,
  saveSyncPath,
} from '@/services/snapshot-sync-service';

function StatusBadge({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <Badge className={ok ? 'bg-positive hover:bg-positive' : 'bg-warning hover:bg-warning'}>
      {children}
    </Badge>
  );
}

export function PrivacySyncAnalyticsSettings() {
  const queryClient = useQueryClient();
  const encryption = useLocalEncryption();
  const [pathLabel, setPathLabel] = useState('Meine Sync-Datei');
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

  const syncPaths = useMemo(() => getSyncPaths(), [pathsVersion]);
  const selectedPath = syncPaths[0];

  const consentQuery = useQuery({
    queryKey: ['analytics-consent'],
    queryFn: getAnalyticsConsent,
  });

  const latestSyncQuery = useQuery({
    queryKey: ['sync-metadata-latest'],
    queryFn: getLatestSyncMetadata,
    retry: false,
  });

  const consentMutation = useMutation({
    mutationFn: (optedIn: boolean) => setAnalyticsConsent(optedIn),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analytics-consent'] });
      showSuccess('Analytics-Einwilligung aktualisiert');
    },
    onError: (error: Error) => showError(error.message),
  });

  const snapshotMutation = useMutation({
    mutationFn: () => exportEncryptedSnapshot(selectedPath?.label, selectedPath?.pathHint),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-metadata-latest'] });
      showSuccess('Sync-Datei heruntergeladen');
    },
    onError: (error: Error) => showError(error.message),
  });

  const importSnapshotMutation = useMutation({
    mutationFn: importEncryptedSnapshot,
    onSuccess: (snapshot) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-positions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      showSuccess(`Sync-Datei v${snapshot.snapshot_version} importiert`);
    },
    onError: (error: Error) => showError(error.message),
  });

  const analyticsMutation = useMutation({
    mutationFn: uploadEncryptedAnalyticsPackage,
    onSuccess: (result) =>
      showSuccess(`${result.uploaded} verschlüsselte Analysepakete hochgeladen (${result.suppressed} unterdrückt)`),
    onError: (error: Error) => showError(error.message),
  });

  const addPath = () => {
    if (!pathHint.trim()) {
      showError('Bitte einen Speicherort-Hinweis eintragen');
      return;
    }

    saveSyncPath(pathLabel, pathHint);
    setPathHint('');
    setPathsVersion((v) => v + 1);
    showSuccess('Speicherort-Hinweis gespeichert');
  };

  return (
    <Card className="ui-card border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <FolderSync className="h-5 w-5 text-positive" />
          Sync-Datei & Datenschutz
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Deine Sync-Datei ist der verschlüsselte lokale Datenstand für alles, was nicht in Supabase gespeichert wird.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <FileLock2 className="h-4 w-4 text-positive" />
              Lokale Finanzdaten
            </div>
            <StatusBadge ok={storageStatus.encrypted}>
              {storageStatus.encrypted ? 'verschlüsselt' : 'noch nicht verschlüsselt'}
            </StatusBadge>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <Database className="h-4 w-4 text-brand" />
              Supabase
            </div>
            <StatusBadge ok>nur Metadaten</StatusBadge>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <HardDrive className="h-4 w-4 text-brand" />
              Lokaler Speicher (IndexedDB)
            </div>
            <StatusBadge ok={storagePersisted === true}>
              {storagePersisted === null
                ? 'wird geprüft …'
                : storagePersisted
                  ? 'dauerhaft gesichert'
                  : 'nicht dauerhaft'}
            </StatusBadge>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <FileKey2 className="h-4 w-4 text-premium" />
              Sync-Datei
            </div>
            <StatusBadge ok={!!encryption.enabled}>
              {encryption.enabled ? 'bereit' : 'wartet auf Passphrase'}
            </StatusBadge>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <BarChart3 className="h-4 w-4 text-warning" />
              Anonyme Auswertung
            </div>
            <StatusBadge ok={!!consentQuery.data?.opted_in}>
              {consentQuery.data?.opted_in ? 'aktiv' : 'inaktiv'}
            </StatusBadge>
          </div>
        </div>

        <Alert className="border-positive/20 bg-positive/10">
          <Sparkles className="h-4 w-4 text-positive" />
          <AlertDescription className="text-sm text-positive">
            <strong>Gedanke für künftig:</strong> Die Sync-Datei soll automatisch im Hintergrund gepflegt werden, damit
            der Nutzer davon möglichst wenig mitbekommt. Aktuell ist der Export noch manuell sichtbar, die Oberfläche
            ist jetzt aber bereits auf dieses Modell ausgerichtet.
          </AlertDescription>
        </Alert>

        {!storageStatus.encrypted && (
          <Alert className="border-warning bg-warning/30">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Aktiviere zuerst die lokale Verschlüsselung mit deiner Passphrase. Diese Passphrase schützt später auch
              deine Sync-Datei.
            </AlertDescription>
          </Alert>
        )}

        {storageStatus.plaintextFound && encryption.enabled && (
          <Alert className="border-warning bg-warning/30">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Es wurden lokale Klartextdaten erkannt. Nach dem Entsperren werden diese automatisch in den geschützten
              lokalen Speicher übernommen.
            </AlertDescription>
          </Alert>
        )}

        <div className="rounded-2xl border border-border bg-card p-4">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-foreground">
            <FolderSync className="h-4 w-4 text-positive" />
            Speicherort der Sync-Datei
          </h3>
          <p className="text-sm leading-6 text-muted-foreground">
            Im Moment wird die Sync-Datei beim Export als Download-Datei auf dein Gerät gespeichert. In der Praxis liegt
            sie also zuerst meist im Download-Ordner deines Browsers. Danach kannst du sie an deinen gewünschten Ort
            verschieben, zum Beispiel iCloud Drive, Dropbox oder einen lokalen Ordner.
          </p>
        </div>

        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <h3 className="flex items-center gap-2 font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 text-positive" />
            Sync-Datei verwalten
          </h3>

          <p className="text-sm text-muted-foreground">
            Diese Datei ersetzt das klassische Backup. Sie enthält deinen verschlüsselten lokalen Datenstand.
          </p>

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <Label className="text-foreground">Bezeichnung</Label>
              <Input
                value={pathLabel}
                onChange={(e) => setPathLabel(e.target.value)}
                className="border-border bg-card text-foreground"
              />
            </div>

            <div className="md:col-span-2">
              <Label className="text-foreground">Speicherort-Hinweis</Label>
              <Input
                value={pathHint}
                onChange={(e) => setPathHint(e.target.value)}
                placeholder="z. B. iCloud Drive/Ausgabentracker"
                className="border-border bg-card text-foreground"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={addPath} className="border-border bg-card text-foreground hover:bg-accent">
              Speicherort merken
            </Button>

            <Button
              onClick={() => snapshotMutation.mutate()}
              disabled={!encryption.unlocked || snapshotMutation.isPending}
              className="bg-positive text-white hover:bg-positive"
            >
              <FileLock2 className="mr-2 h-4 w-4" />
              Sync-Datei herunterladen
            </Button>

            <label className="inline-flex cursor-pointer items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-accent">
              Sync-Datei importieren
              <Input
                type="file"
                accept="application/json,.json"
                className="hidden"
                disabled={!encryption.unlocked || importSnapshotMutation.isPending}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) importSnapshotMutation.mutate(file);
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
            Letzte bekannte Sync-Metadaten:{' '}
            {latestSyncQuery.data
              ? `${latestSyncQuery.data.snapshot_id} · ${new Date(latestSyncQuery.data.created_at).toLocaleString('de-DE')}`
              : 'noch keine vorhanden'}
          </p>
        </div>

        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <h3 className="flex items-center gap-2 font-semibold text-foreground">
            <UploadCloud className="h-4 w-4 text-warning" />
            Anonyme Auswertung
          </h3>

          <p className="text-sm text-muted-foreground">
            Es werden keine Einzeltransaktionen oder Freitexte hochgeladen. Nur lokal erzeugte, verschlüsselte
            Aggregationen werden übertragen.
          </p>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-3">
            <div>
              <div className="text-sm font-medium text-foreground">Anonyme Auswertung erlauben</div>
              <div className="text-xs text-muted-foreground">
                Zeitraum, Kategoriegruppe und aggregierte Kennzahlen; Mindestgruppe lokal: n ≥ 5
              </div>
            </div>

            <Switch
              checked={!!consentQuery.data?.opted_in}
              onCheckedChange={(checked) => consentMutation.mutate(checked)}
            />
          </div>

          <Button
            variant="outline"
            onClick={() => analyticsMutation.mutate()}
            disabled={!consentQuery.data?.opted_in || !encryption.unlocked || analyticsMutation.isPending}
            className="border-border bg-card text-foreground hover:bg-accent"
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            Analysepakete erzeugen & hochladen
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}