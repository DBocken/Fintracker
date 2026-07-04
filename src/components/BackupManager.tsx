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
import { useI18n } from '@/i18n/useI18n';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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
  const { t } = useI18n();
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [encryptedBackupPassword, setEncryptedBackupPassword] = useState('');
  const [encryptedRestorePassword, setEncryptedRestorePassword] = useState('');
  const [restoreMode, setRestoreMode] = useState<'json' | 'enc'>('json');
  const [foreignPending, setForeignPending] = useState<BackupData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: backupInfo, isLoading: isLoadingInfo } = useQuery({
    queryKey: ['backup-info'],
    queryFn: () => backupService.getBackupInfo(),
    refetchInterval: false,
  });

  const downloadMutation = useMutation({
    mutationFn: async () => {
      // Bewusster Klartext-Export ("Datenumzug") – nur nach Bestätigung im Dialog.
      await backupService.downloadBackup(undefined, { acknowledgeUnencrypted: true });
    },
    onSuccess: () => {
      showSuccess(t('backup.unencryptedDownloadSuccess'));
    },
    onError: (error: Error) => {
      showError(`${t('backup.downloadError')} ${error.message}`);
    },
  });

  const downloadEncryptedMutation = useMutation({
    mutationFn: async (password: string) => {
      await backupService.downloadEncryptedBackup(password);
    },
    onSuccess: () => {
      setEncryptedBackupPassword('');
      showSuccess(t('backup.downloadSuccess'));
    },
    onError: (error: Error) => {
      showError(`${t('backup.downloadError')} ${error.message}`);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async ({ backupData, allowForeign }: { backupData: BackupData; allowForeign?: boolean }) => {
      return await backupService.restoreBackup(backupData, { allowForeign });
    },
    onSuccess: (result) => {
      showSuccess(result.message);
      setRestoreDialogOpen(false);
      setBackupFile(null);
      setEncryptedRestorePassword('');
      setForeignPending(null);
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    },
    onError: (error: Error, variables) => {
      // Fremd-Backup: nicht still importieren, sondern ausdrücklich bestätigen lassen.
      if (error.message === 'FOREIGN_BACKUP' && !variables.allowForeign) {
        setForeignPending(variables.backupData);
        return;
      }
      showError(error instanceof Error ? error.message : t('backup.restoreError'));
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
        restoreMutation.mutate({ backupData });
      } else {
        const backupData = await backupService.readBackupFile(backupFile);
        restoreMutation.mutate({ backupData });
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : t('backup.service.readError'));
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
            {t('backup.title')}
          </h2>
          <p className="text-muted-foreground mt-1">
            {t('backup.description')}
          </p>
        </div>
      </div>

      <Card className="ui-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            {t('backup.currentData')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingInfo ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : backupInfo ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-card space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span className="text-sm">{t('backup.transactions')}</span>
                </div>
                <p className="text-2xl font-bold">{backupInfo.transactionCount}</p>
              </div>

              <div className="p-4 rounded-lg bg-card space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span className="text-sm">{t('backup.categories')}</span>
                </div>
                <p className="text-2xl font-bold">{backupInfo.categoryCount}</p>
              </div>

              <div className="p-4 rounded-lg bg-card space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <HardDrive className="h-4 w-4" />
                  <span className="text-sm">{t('backup.accounts')}</span>
                </div>
                <p className="text-2xl font-bold">{backupInfo.accountCount}</p>
              </div>

              <div className="p-4 rounded-lg bg-card space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <HardDrive className="h-4 w-4" />
                  <span className="text-sm">{t('backup.estimatedSize')}</span>
                </div>
                <p className="text-2xl font-bold">{formatFileSize(backupInfo.estimatedSize)}</p>
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              {t('backup.noData')}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid min-w-0 gap-6 md:grid-cols-2">
        <Card className="ui-card min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-brand" />
              {t('backup.createBackup')}
            </CardTitle>
            <CardDescription>
              {t('backup.createDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {t('backup.backupInfo')}
              </AlertDescription>
            </Alert>

            {/* Standardweg: verschlüsseltes Backup */}
            <div className="rounded-lg border border-positive/40 bg-positive/5 p-3 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Lock className="h-4 w-4 text-positive" />
                {t('backup.encryptedBackup')}
              </div>
              <div className="space-y-2">
                <Label htmlFor="enc-backup-pw">{t('backup.password')}</Label>
                <Input
                  id="enc-backup-pw"
                  type="password"
                  value={encryptedBackupPassword}
                  onChange={(e) => setEncryptedBackupPassword(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                size="lg"
                onClick={() => downloadEncryptedMutation.mutate(encryptedBackupPassword)}
                disabled={downloadEncryptedMutation.isPending || !encryptedBackupPassword}
              >
                {downloadEncryptedMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('backup.creating')}
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    {t('backup.downloadEncrypted')}
                  </>
                )}
              </Button>
            </div>

            {/* Ausnahme: unverschlüsselter Export hinter ausdrücklicher Warnung */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-auto w-full whitespace-normal text-center text-muted-foreground"
                  size="sm"
                  disabled={downloadMutation.isPending || isLoadingInfo}
                >
                  <Download className="mr-2 h-4 w-4 shrink-0" />
                  {t('backup.unencryptedExport')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('backup.unencryptedWarningTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('backup.unencryptedWarning')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault();
                      downloadMutation.mutate();
                    }}
                  >
                    {t('backup.unencryptedExportAction')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        <Card className="ui-card min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-positive" />
              {t('backup.restoreBackup')}
            </CardTitle>
            <CardDescription>
              {t('backup.restoreDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {t('backup.restoreInfo')}
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
                {t('backup.jsonFormat')}
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
                {t('backup.encFormat')}
              </Button>
            </div>

            <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full" size="lg">
                  <Upload className="mr-2 h-4 w-4" />
                  {t('backup.uploadBackup')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('backup.restoreDialogTitle')}</DialogTitle>
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
                        {t('backup.selectFile')}
                      </>
                    )}
                  </Button>

                  {restoreMode === 'enc' && (
                    <div className="space-y-2">
                      <Label htmlFor="enc-restore-pw">{t('backup.password')}</Label>
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
                          {t('backup.fileSize').replace('{size}', formatFileSize(backupFile.size))}
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
                          {t('common.cancel')}
                        </Button>
                        <Button
                          onClick={handleRestore}
                          disabled={!backupFile || restoreMutation.isPending || (restoreMode === 'enc' && !encryptedRestorePassword)}
                          className="flex-1"
                        >
                          {restoreMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              {t('backup.restoring')}
                            </>
                          ) : (
                            t('backup.restoreButton')
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
              {t('backup.restoreSuccess')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {restoreMutation.data.message}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-lg bg-card">
                <p className="text-2xl font-bold text-positive">
                  {restoreMutation.data.details.transactions}
                </p>
                <p className="text-xs text-muted-foreground">{t('backup.transactions')}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-card">
                <p className="text-2xl font-bold text-positive">
                  {restoreMutation.data.details.categories}
                </p>
                <p className="text-xs text-muted-foreground">{t('backup.categories')}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-card">
                <p className="text-2xl font-bold text-positive">
                  {restoreMutation.data.details.accounts}
                </p>
                <p className="text-xs text-muted-foreground">{t('backup.accounts')}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-card">
                <p className="text-2xl font-bold">
                  {restoreMutation.data.details.settings ? '✓' : '✗'}
                </p>
                <p className="text-xs text-muted-foreground">{t('backup.settings')}</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mt-4">
              {t('backup.restoreLoading')}
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="ui-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            {t('backup.aboutBackups')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            {t('backup.regularBackups')}
          </p>
          <p>
            {t('backup.storageLocation')}
          </p>
          <p>
            {t('backup.restoration')}
          </p>
          <p>
            {t('backup.compatibility')}
          </p>
        </CardContent>
      </Card>

      <AlertDialog open={!!foreignPending} onOpenChange={(open) => !open && setForeignPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('backup.foreignBackupTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('backup.foreignBackupWarning')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (foreignPending) {
                  restoreMutation.mutate({ backupData: foreignPending, allowForeign: true });
                }
              }}
            >
              {t('backup.foreignBackupAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}