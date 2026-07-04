import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useI18n } from '@/i18n/useI18n';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { connectEtoroAccount, ETORO_PREVIEW_NOTICE } from '@/services/etoro-service';

interface EtoroConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function EtoroConnectDialog({
  open,
  onOpenChange,
  onSuccess,
}: EtoroConnectDialogProps) {
  const { t } = useI18n();
  const [username, setUsername] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [userKey, setUserKey] = useState('');
  const [error, setError] = useState<string | null>(null);

  const connectionMutation = useMutation({
    mutationFn: async () => {
      if (!username.trim() || !apiKey.trim() || !userKey.trim()) {
        throw new Error(t('trading.etoroConnectDialog.messages.credentialsRequired'));
      }
      return await connectEtoroAccount(username.trim(), apiKey.trim(), userKey.trim());
    },
    onSuccess: () => {
      setError(null);
      setUsername('');
      setApiKey('');
      setUserKey('');
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: Error) => {
      setError(err.message || t('trading.etoroConnectDialog.messages.connectionError'));
    },
  });

  const handleTestConnection = async () => {
    if (!username.trim() || !apiKey.trim() || !userKey.trim()) {
      setError(t('trading.etoroConnectDialog.messages.credentialsRequired'));
      return;
    }

    setError(null);
    // The connection test will be done as part of the connection process
    connectionMutation.mutate();
  };

  const handleClose = () => {
    if (!connectionMutation.isPending) {
      setError(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('trading.etoroConnectDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('trading.etoroConnectDialog.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="username">{t('trading.etoroConnectDialog.usernameLabel')}</Label>
            <Input
              id="username"
              placeholder={t('trading.etoroConnectDialog.usernamePlaceholder')}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={connectionMutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">{t('trading.etoroConnectDialog.apiKeyLabel')}</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder={t('trading.etoroConnectDialog.apiKeyPlaceholder')}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={connectionMutation.isPending}
            />
            <p className="text-xs text-muted-foreground">
              {t('trading.etoroConnectDialog.apiKeyHint')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="userKey">{t('trading.etoroConnectDialog.userKeyLabel')}</Label>
            <Input
              id="userKey"
              type="password"
              placeholder={t('trading.etoroConnectDialog.userKeyPlaceholder')}
              value={userKey}
              onChange={(e) => setUserKey(e.target.value)}
              disabled={connectionMutation.isPending}
            />
            <p className="text-xs text-muted-foreground">
              {t('trading.etoroConnectDialog.userKeyHint')}
            </p>
          </div>

          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{ETORO_PREVIEW_NOTICE}</AlertDescription>
          </Alert>

          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>{t('trading.etoroConnectDialog.securityTitle')}</strong> {t('trading.etoroConnectDialog.securityDesc')}
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={connectionMutation.isPending}
          >
            {t('trading.etoroConnectDialog.cancelButton')}
          </Button>
          <Button
            onClick={handleTestConnection}
            disabled={connectionMutation.isPending}
          >
            {connectionMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('trading.etoroConnectDialog.connectingButton')}
              </>
            ) : (
              t('trading.etoroConnectDialog.connectButton')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}