"use client";

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
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
import { connectEtoroAccount } from '@/services/etoro-service';

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
  const [username, setUsername] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [userKey, setUserKey] = useState('');
  const [error, setError] = useState<string | null>(null);

  const connectionMutation = useMutation({
    mutationFn: async () => {
      if (!username.trim() || !apiKey.trim() || !userKey.trim()) {
        throw new Error('Bitte geben Sie Benutzername, API Key und User Key ein.');
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
      setError(err.message || 'Verbindung fehlgeschlagen');
    },
  });

  const handleTestConnection = async () => {
    if (!username.trim() || !apiKey.trim() || !userKey.trim()) {
      setError('Bitte geben Sie Benutzername, API Key und User Key ein.');
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
          <DialogTitle>eToro-Konto verbinden</DialogTitle>
          <DialogDescription>
            Verbinden Sie Ihr eToro-Konto, um Ihr Portfolio automatisch zu importieren.
            Sie benötigen API Key und User Key aus Ihrem eToro Developer-Konto.
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
            <Label htmlFor="username">eToro Benutzername</Label>
            <Input
              id="username"
              placeholder="Ihr eToro Benutzername"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={connectionMutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="Ihr eToro API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={connectionMutation.isPending}
            />
            <p className="text-xs text-muted-foreground">
              API Key vom eToro Developer Portal (api-portal.etoro.com)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="userKey">User Key</Label>
            <Input
              id="userKey"
              type="password"
              placeholder="Ihr eToro User Key"
              value={userKey}
              onChange={(e) => setUserKey(e.target.value)}
              disabled={connectionMutation.isPending}
            />
            <p className="text-xs text-muted-foreground">
              User Key von Ihren eToro Konto-Einstellungen
            </p>
          </div>

          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Security Note:</strong> Ihre API Keys werden verschlüsselt gespeichert und nur für den Zugriff auf Ihr Portfolio verwendet.
              Wir haben keinen Zugriff auf Ihr eToro-Passwort oder Ihre Transaktionen.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={connectionMutation.isPending}
          >
            Abbrechen
          </Button>
          <Button
            onClick={handleTestConnection}
            disabled={connectionMutation.isPending}
          >
            {connectionMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verbinde...
              </>
            ) : (
              'Verbinden & Importieren'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}