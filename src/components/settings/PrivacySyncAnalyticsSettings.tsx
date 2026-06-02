import { type ReactNode, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  BarChart3,
  Database,
  Download,
  FileLock2,
  FolderSync,
  ShieldCheck,
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
    <Badge className={ok ? 'bg-emerald-600 hover:bg-emerald-600' : 'bg-amber-600 hover:bg-amber-600'}>
      {children}
    </Badge>
  );
}

export function PrivacySyncAnalyticsSettings() {
  const queryClient = useQueryClient();
  const encryption = useLocalEncryption();
  const [pathLabel, setPathLabel] = useState('Desktop-Sync');
  const [pathHint, setPathHint] = useState('');
  const [pathsVersion, setPathsVersion] = useState(0);
  const storageStatus = getLocalFinanceStorageStatus();

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
      showSuccess('Verschlüsseltes Backup heruntergeladen');
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
      showSuccess(`Verschlüsseltes Backup v${snapshot.snapshot_version} importiert`);
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
      showError('Bitte einen Pfadhinweis eintragen');
      return;
    }

    saveSyncPath(pathLabel, pathHint);
    setPathHint('');
    setPathsVersion((v) => v + 1);
  };

  return (
    <Card className="ui-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-500" />
          Datenschutz, Sync & verschlüsseltes Backup
        </CardTitle>
        <CardDescription>
          Deine sensiblen Finanzdaten bleiben lokal, und dein Snapshot ist jetzt dein verschlüsseltes Backup.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <FileLock2 className="h-4 w-4" />
              Finanzdaten
            </div>
            <StatusBadge ok={storageStatus.encrypted}>
              lokal {storageStatus.encrypted ? 'verschlüsselt' : 'nicht verschlüsselt'}
            </StatusBadge>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Database className="h-4 w-4" />
              Supabase
            </div>
            <StatusBadge ok>Ziel: Metadaten + verschlüsselte Blobs</StatusBadge>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <BarChart3 className="h-4 w-4" />
              Anonyme Auswertung
            </div>
            <StatusBadge ok={!!consentQuery.data?.opted_in}>
              {consentQuery.data?.opted_in ? 'aktiv' : 'inaktiv'}
            </StatusBadge>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <FolderSync className="h-4 w-4" />
              Verschlüsseltes Backup
            </div>
            <StatusBadge ok={syncPaths.length > 0 || true}>
              Download-Datei
            </StatusBadge>
          </div>
        </div>

        {!storageStatus.encrypted && (
          <Alert className="border-amber-700 bg-amber-950/30">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Lokale Finanzdaten können noch als Klartext vorliegen. Aktiviere die lokale Verschlüsselung und entsperre
              sie einmal, damit vorhandene lokale Daten migriert werden.
            </AlertDescription>
          </Alert>
        )}

        {storageStatus.plaintextFound && encryption.enabled && (
          <Alert className="border-amber-700 bg-amber-950/30">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Es wurden lokale Klartext-Finanzdaten erkannt. Entsperren migriert diese Datensätze automatisch in
              verschlüsselte Envelopes.
            </AlertDescription>
          </Alert>
        )}

        <Alert className="border-blue-700 bg-blue-950/30">
          <Download className="h-4 w-4" />
          <AlertDescription>
            <strong>Wo liegt die Sync-Datei?</strong> Beim Export wird dein verschlüsseltes Backup als Datei auf dein
            Gerät heruntergeladen, zum Beispiel in den normalen Download-Ordner deines Browsers. Der Dateiname sieht so
            aus: <span className="font-mono">ausgabentracker_snapshot_vX_YYYY-MM-DD.enc.json</span>.
          </AlertDescription>
        </Alert>

        <Alert className="border-slate-700 bg-slate-950/40">
          <FolderSync className="h-4 w-4" />
          <AlertDescription>
            <strong>Wichtig:</strong> Der hier gespeicherte Pfadhinweis ist nur eine Merkhilfe für dich, etwa
            „iCloud/Ausgabentracker“ oder „Desktop/Backups“. Die Web-App speichert die Datei nicht automatisch dort,
            sondern lädt sie herunter. Du kannst sie danach selbst in deinen gewünschten Ordner oder Cloud-Speicher
            verschieben.
          </AlertDescription>
        </Alert>

        <Alert className="border-amber-700 bg-amber-950/30">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Bestehende Supabase-Klartextdaten wurden aus Sicherheitsgründen nicht automatisch gelöscht. Exportiere
            zuerst ein verschlüsseltes Backup und führe die Cloud-Bereinigung anschließend bewusst aus.
          </AlertDescription>
        </Alert>

        <div className="space-y-3 rounded-lg border border-slate-800 p-4">
          <h3 className="flex items-center gap-2 font-semibold">
            <FolderSync className="h-4 w-4" />
            Verschlüsseltes Backup exportieren / importieren
          </h3>

          <p className="text-sm text-muted-foreground">
            Dieses Backup ist die neue Sync-Datei. Es enthält deine lokal verschlüsselten Finanzdaten und kann später
            wieder importiert werden.
          </p>

          <div className="grid gap-2 md:grid-cols-3">
            <div>
              <Label>Label</Label>
              <Input
                value={pathLabel}
                onChange={(e) => setPathLabel(e.target.value)}
                className="border-slate-700 bg-slate-950"
              />
            </div>

            <div className="md:col-span-2">
              <Label>Pfadhinweis</Label>
              <Input
                value={pathHint}
                onChange={(e) => setPathHint(e.target.value)}
                placeholder="z. B. iCloud/Ausgabentracker"
                className="border-slate-700 bg-slate-950"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={addPath}>
              Pfadhinweis speichern
            </Button>

            <Button
              onClick={() => snapshotMutation.mutate()}
              disabled={!encryption.unlocked || snapshotMutation.isPending}
            >
              <FileLock2 className="mr-2 h-4 w-4" />
              Verschlüsseltes Backup herunterladen
            </Button>

            <label className="inline-flex cursor-pointer items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground">
              Verschlüsseltes Backup importieren
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
                <div key={path.id} className="flex items-center justify-between rounded-md bg-slate-950/60 p-2">
                  <span>
                    <strong>{path.label}:</strong> {path.pathHint}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
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
            Neueste Snapshot-Metadaten:{' '}
            {latestSyncQuery.data
              ? `${latestSyncQuery.data.snapshot_id} (${latestSyncQuery.data.created_at})`
              : 'keine gefunden'}
          </p>
        </div>

        <div className="space-y-3 rounded-lg border border-slate-800 p-4">
          <h3 className="flex items-center gap-2 font-semibold">
            <UploadCloud className="h-4 w-4" />
            Analytics-Einwilligung
          </h3>

          <p className="text-sm text-muted-foreground">
            Es werden keine Einzeltransaktionen, Beträge pro Buchung oder Freitexte hochgeladen. Lokal erzeugte
            Aggregationen werden vor dem Upload verschlüsselt.
          </p>

          <div className="flex items-center justify-between gap-4 rounded-md bg-slate-950/60 p-3">
            <div>
              <div className="text-sm font-medium">Anonyme Auswertung erlauben</div>
              <div className="text-xs text-muted-foreground">
                Datenklassen: Zeitraum, Kategoriegruppe, aggregierte Kennzahlen; Mindestgruppe lokal: n ≥ 5
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
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            Verschlüsselte Analysepakete erzeugen & hochladen
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}