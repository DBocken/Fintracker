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
import {
  disableCloudMcpSync,
  enableCloudMcpSync,
  getCloudMcpSyncStatus,
  hasValidConsent,
  MCP_CONFIRM_PHRASE,
  syncCloudMcpAggregates,
  type EnableResult,
} from '@/services/cloud-mcp-sync-service';

/**
 * Proof of Concept (Issue: MCP-Sprachabfrage). Schaltet – nur mit DOPPELTER
 * roter Bestätigung – einen Cloud-Sync der Finanz-AGGREGATE frei, damit Claude/
 * ChatGPT sie per Connector lesen können. Widerspricht bewusst dem Local-only-
 * Designkonzept (siehe docs/mcp-poc.md). Es verlassen ausschließlich Aggregate
 * das Gerät – niemals Rohtransaktionen.
 */
export function CloudMcpSyncCard() {
  const { status } = useAuth();
  const isAuthenticated = status === 'authenticated';

  const [enabled, setEnabled] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [ack, setAck] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState<EnableResult | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
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
      setReveal(result);
      setEnabled(true);
      setLastSyncedAt(new Date().toISOString());
      resetDialog();
      showSuccess('Cloud-Sync aktiviert – Aggregate hochgeladen.');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Aktivieren fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  async function handleSync() {
    setBusy(true);
    try {
      const { updatedAt } = await syncCloudMcpAggregates();
      setLastSyncedAt(updatedAt);
      showSuccess('Aggregate aktualisiert.');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Sync fehlgeschlagen');
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
      setReveal(null);
      showSuccess('Cloud-Sync deaktiviert – Snapshot gelöscht.');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Deaktivieren fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  function copy(value: string, label: string) {
    navigator.clipboard
      .writeText(value)
      .then(() => showSuccess(`${label} kopiert`))
      .catch(() => showError('Kopieren fehlgeschlagen'));
  }

  return (
    <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5">
      <div className="mb-1 flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400">
        <ShieldAlert className="h-4 w-4" />
        Sprach-/KI-Zugriff (MCP) · Proof of Concept
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Lädt <strong>nur Aggregate</strong> (Monatsausgaben, Budget-Status, Cashflow, Ausreißer) in
        die Cloud, damit du sie per Sprache/Chat aus Claude oder ChatGPT abfragen kannst.{' '}
        <strong className="text-amber-600 dark:text-amber-400">
          Das widerspricht dem Local-only-Prinzip dieser App.
        </strong>{' '}
        Rohtransaktionen, IBANs und Texte verlassen dein Gerät <strong>nicht</strong>.
      </p>

      {!isAuthenticated && (
        <p className="text-sm text-muted-foreground">
          Für den Cloud-Sync ist ein Login nötig.
        </p>
      )}

      {isAuthenticated && (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              Status:{' '}
              <span className={enabled ? 'font-medium text-emerald-600' : 'font-medium text-foreground'}>
                {enabled ? 'aktiv' : 'inaktiv'}
              </span>
              {lastSyncedAt && (
                <> · zuletzt: {new Date(lastSyncedAt).toLocaleString('de-DE')}</>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              {enabled ? (
                <>
                  <Button variant="outline" onClick={handleSync} disabled={busy}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Synchronisieren
                  </Button>
                  <Button variant="destructive" onClick={handleDisable} disabled={busy}>
                    <CloudOff className="mr-2 h-4 w-4" />
                    Deaktivieren
                  </Button>
                </>
              ) : (
                <Button
                  className="bg-amber-600 text-white hover:bg-amber-700"
                  onClick={() => setDialogOpen(true)}
                  disabled={busy}
                >
                  <Cloud className="mr-2 h-4 w-4" />
                  Cloud-Sync aktivieren …
                </Button>
              )}
            </div>
          </div>

          {reveal && (
            <div className="space-y-3 rounded-xl border border-amber-500/40 bg-background p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                Wird nur EINMAL angezeigt – jetzt kopieren!
              </div>
              <FieldCopy label="Connector-URL" value={reveal.connectorUrl} onCopy={copy} />
              <FieldCopy label="Zugriffstoken" value={reveal.token} onCopy={copy} />
              <p className="text-xs text-muted-foreground">
                Trage die Connector-URL als „No Auth"-MCP-Connector in Claude/ChatGPT ein. Das Token
                steckt im Pfad (POC-Vereinfachung – produktiv wäre OAuth nötig).
              </p>
            </div>
          )}
        </div>
      )}

      {/* Stufe 1 + 2: doppelte rote Bestätigung */}
      <AlertDialog open={dialogOpen} onOpenChange={(next) => !next && resetDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Finanz-Aggregate aus dem Gerät freigeben?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-left">
                <p className="font-medium text-destructive">
                  Dies hebt die Local-only-Garantie dieser App bewusst auf.
                </p>
                <p>
                  Aggregierte Finanzdaten (Monatssummen je Kategorie, Budget-Status, Cashflow,
                  Ausreißer) werden zu Supabase hochgeladen und beim Abfragen zusätzlich an den
                  KI-Anbieter (Anthropic/OpenAI) übertragen. Rohtransaktionen, IBANs und Freitexte
                  bleiben lokal.
                </p>
                <p className="text-xs">
                  Dies ist ein Proof of Concept ohne produktive OAuth-Absicherung.
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
              Ich verstehe, dass meine Finanz-Aggregate das Gerät verlassen und an Cloud-Dienste
              gehen.
            </span>
          </label>

          <div className="space-y-2">
            <Label htmlFor="mcp-confirm">
              Tippe zur Bestätigung:{' '}
              <span className="font-mono font-semibold">{MCP_CONFIRM_PHRASE}</span>
            </Label>
            <Input
              id="mcp-confirm"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              autoComplete="off"
              aria-label={`Bestätigung – tippe ${MCP_CONFIRM_PHRASE}`}
            />
          </div>

          <AlertDialogFooter>
            <Button variant="outline" onClick={resetDialog} disabled={busy}>
              Abbrechen
            </Button>
            <Button
              className="bg-amber-600 text-white hover:bg-amber-700"
              onClick={handleEnable}
              disabled={!consentOk || busy}
            >
              Endgültig freigeben
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
}: {
  label: string;
  value: string;
  onCopy: (value: string, label: string) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2">
        <code className="flex-1 overflow-x-auto rounded-lg bg-muted px-3 py-2 text-xs">{value}</code>
        <Button variant="outline" size="icon" onClick={() => onCopy(value, label)} aria-label={`${label} kopieren`}>
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default CloudMcpSyncCard;
