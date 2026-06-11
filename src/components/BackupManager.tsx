import { useState, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Alert,
  AlertDescription
} from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import {
  Download,
  Upload,
  Database,
  CheckCircle2,
  AlertCircle,
  Loader2,
  HardDrive,
  Info,
  FileText,
  Lock,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { showSuccess, showError } from '@/utils/toast';
import { backupService } from '@/services/backup-service';
import type { BackupData } from '@/services/backup-service';

export function BackupManager() {
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [encryptedBackupPassword, setEncryptedBackupPassword] = useState('');
  const [encryptedRestorePassword, setEncryptedRestorePassword] = useState('');
  const [restoreMode, setRestoreMode] = useState<'json' | 'enc'>('json');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: backupInfo, isLoading: isLoadingInfo } = useQuery({
    queryKey: ['backup-info'],
    queryFn: () => backupService.getBackupInfo(),
    refetchInterval: false,
  });

  const downloadMutation = useMutation({
    mutationFn: async () => {
      await backupService.downloadBackup();
    },
    onSuccess: () => {
      showSuccess('Backup erfolgreich heruntergeladen');
    },
    onError: (error: Error) => {
      showError(`Download fehlgeschlagen: ${error.message}`);
    },
  });

  const downloadEncryptedMutation = useMutation({
    mutationFn: async (password: string) => {
      await backupService.downloadEncryptedBackup(password);
    },
    onSuccess: () => {
      setEncryptedBackupPassword('');
      showSuccess('Verschlüsseltes Backup heruntergeladen');
    },
    onError: (error: Error) => {
      showError(`Download fehlgeschlagen: ${error.message}`);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (backupData: BackupData) => {
      return await backupService.restoreBackup(backupData);
    },
    onSuccess: (result) => {
      showSuccess(result.message);
      setRestoreDialogOpen(false);
      setBackupFile(null);
      setEncryptedRestorePassword('');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    },
    onError: (error: Error) => {
      showError(error instanceof Error ? error.message : 'Wiederherstellung fehlgeschlagen');
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBackupFile(file);
    }
  };

  const handleRestore = async () => {
    if (!backupFile) return;

    try {
      if (restoreMode === 'enc') {
        const backupData = await backupService.readEncryptedBackupFile(backupFile, encryptedRestorePassword);
        restoreMutation.mutate(backupData);
      } else {
        const backupData = await backupService.readBackupFile(backupFile);
        restoreMutation.mutate(backupData);
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Fehler beim Lesen der Backup-Datei');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const accept = restoreMode === 'enc' ? '.enc.json,.json' : '.json';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6 text-premium" />
            Backup & Wiederherstellung
          </h2>
          <p className="text-muted-foreground mt-1">
            Sichere deine Daten mit Backups
          </p>
        </div>
      </div>

      <Card className="ui-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Aktueller Datenbestand
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingInfo ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : backupInfo ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-slate-900/50 space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span className="text-sm">Transaktionen</span>
                </div>
                <p className="text-2xl font-bold">{backupInfo.transactionCount}</p>
              </div>

              <div className="p-4 rounded-lg bg-slate-900/50 space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span className="text-sm">Kategorien</span>
                </div>
                <p className="text-2xl font-bold">{backupInfo.categoryCount}</p>
              </div>

              <div className="p-4 rounded-lg bg-slate-900/50 space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <HardDrive className="h-4 w-4" />
                  <span className="text-sm">Konten</span>
                </div>
                <p className="text-2xl font-bold">{backupInfo.accountCount}</p>
              </div>

              <div className="p-4 rounded-lg bg-slate-900/50 space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <HardDrive className="h-4 w-4" />
                  <span className="text-sm">Geschätzte Größe</span>
                </div>
                <p className="text-2xl font-bold">{formatFileSize(backupInfo.estimatedSize)}</p>
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Keine Daten verfügbar
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="ui-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-brand" />
              Backup erstellen
            </CardTitle>
            <CardDescription>
              Lade alle deine Daten als JSON-Datei herunter
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Das Backup enthält Transaktionen, Kategorien, Konten und Einstellungen.
                Speichere die Datei an einem sicheren Ort.
              </AlertDescription>
            </Alert>

            <Button
              onClick={() => downloadMutation.mutate()}
              disabled={downloadMutation.isPending || isLoadingInfo}
              className="w-full"
              size="lg"
            >
              {downloadMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Erstelle Backup...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Backup herunterladen
                </>
              )}
            </Button>

            <div className="rounded-lg border border-slate-800 p-3 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Lock className="h-4 w-4" />
                Verschlüsseltes Backup (.enc.json)
              </div>
              <div className="space-y-2">
                <Label htmlFor="enc-backup-pw">Passwort</Label>
                <Input
                  id="enc-backup-pw"
                  type="password"
                  value={encryptedBackupPassword}
                  onChange={(e) => setEncryptedBackupPassword(e.target.value)}
                />
              </div>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => downloadEncryptedMutation.mutate(encryptedBackupPassword)}
                disabled={downloadEncryptedMutation.isPending || !encryptedBackupPassword}
              >
                {downloadEncryptedMutation.isPending ? 'Erstelle…' : 'Verschlüsseltes Backup herunterladen'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="ui-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-positive" />
              Backup wiederherstellen
            </CardTitle>
            <CardDescription>
              Lade ein Backup von einer Datei (.json oder .enc.json)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Achtung: Beim Wiederherstellen werden vorhandene Daten überschrieben.
                Erstelle vorher ein Backup.
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button
                type="button"
                variant={restoreMode === 'json' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => {
                  setRestoreMode('json');
                  setBackupFile(null);
                }}
              >
                .json
              </Button>
              <Button
                type="button"
                variant={restoreMode === 'enc' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => {
                  setRestoreMode('enc');
                  setBackupFile(null);
                }}
              >
                .enc.json
              </Button>
            </div>

            <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full" size="lg">
                  <Upload className="mr-2 h-4 w-4" />
                  Backup hochladen
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Backup wiederherstellen</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={accept}
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    variant="outline"
                    className="w-full"
                    disabled={restoreMutation.isPending}
                  >
                    {backupFile ? (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4 text-positive" />
                        {backupFile.name}
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Datei auswählen
                      </>
                    )}
                  </Button>

                  {restoreMode === 'enc' && (
                    <div className="space-y-2">
                      <Label htmlFor="enc-restore-pw">Passwort</Label>
                      <Input
                        id="enc-restore-pw"
                        type="password"
                        value={encryptedRestorePassword}
                        onChange={(e) => setEncryptedRestorePassword(e.target.value)}
                      />
                    </div>
                  )}

                  {backupFile && (
                    <>
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription className="text-sm">
                          Datei: {backupFile.name}
                          <br />
                          Größe: {formatFileSize(backupFile.size)}
                        </AlertDescription>
                      </Alert>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setRestoreDialogOpen(false);
                            setBackupFile(null);
                            setEncryptedRestorePassword('');
                          }}
                          className="flex-1"
                          disabled={restoreMutation.isPending}
                        >
                          Abbrechen
                        </Button>
                        <Button
                          onClick={handleRestore}
                          disabled={!backupFile || restoreMutation.isPending || (restoreMode === 'enc' && !encryptedRestorePassword)}
                          className="flex-1"
                        >
                          {restoreMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Wiederherstellen...
                            </>
                          ) : (
                            'Wiederherstellen'
                          )}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>

      {restoreMutation.data && restoreMutation.data.success && (
        <Card className="ui-card border-positive/50 bg-positive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-positive">
              <CheckCircle2 className="h-5 w-5" />
              Wiederherstellung erfolgreich
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {restoreMutation.data.message}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-lg bg-slate-900/50">
                <p className="text-2xl font-bold text-positive">
                  {restoreMutation.data.details.transactions}
                </p>
                <p className="text-xs text-muted-foreground">Transaktionen</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-slate-900/50">
                <p className="text-2xl font-bold text-positive">
                  {restoreMutation.data.details.categories}
                </p>
                <p className="text-xs text-muted-foreground">Kategorien</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-slate-900/50">
                <p className="text-2xl font-bold text-positive">
                  {restoreMutation.data.details.accounts}
                </p>
                <p className="text-xs text-muted-foreground">Konten</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-slate-900/50">
                <p className="text-2xl font-bold">
                  {restoreMutation.data.details.settings ? '✓' : '✗'}
                </p>
                <p className="text-xs text-muted-foreground">Einstellungen</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mt-4">
              Die Seite wird automatisch neu geladen...
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="ui-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Über Backups
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <strong>Regelmäßige Backups:</strong> Erstelle wöchentlich ein Backup,
            um Datenverlust zu vermeiden.
          </p>
          <p>
            <strong>Speicherort:</strong> Speichere Backups an einem sicheren Ort
            (z. B. Cloud-Speicher, externe Festplatte).
          </p>
          <p>
            <strong>Wiederherstellung:</strong> Beim Wiederherstellen werden alle
            Daten durch die Backup-Daten ersetzt.
          </p>
          <p>
            <strong>Kompatibilität:</strong> Backups sind mit der gleichen
            App-Version kompatibel. Updates könnten neue Felder hinzufügen.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}