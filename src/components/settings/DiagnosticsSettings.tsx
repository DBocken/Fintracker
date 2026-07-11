import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { InfoGroup, InfoStatStrip } from '@/components/common/InfoGroup';
import InteractiveCard from '@/components/common/InteractiveCard';
import { useI18n } from '@/i18n/useI18n';
import { showError, showSuccess } from '@/utils/toast';
import {
  clearErrorLog,
  exportErrorLogAsJson,
  getErrorLog,
  type ErrorLogEntry,
} from '@/services/error-log-service';
import { Copy, Download, Trash2 } from 'lucide-react';

/**
 * Diagnose-Panel (Einstellungen → Technischer Status): macht das lokale,
 * redigierte Fehlerprotokoll sichtbar und teilbar. Das Protokoll verlässt das
 * Gerät ausschließlich über die hiesigen, nutzerinitiierten Aktionen
 * (Kopieren/Exportieren) — es gibt bewusst keinen automatischen Versand.
 */
export default function DiagnosticsSettings() {
  const { t } = useI18n();
  const [entries, setEntries] = useState<ErrorLogEntry[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const refresh = useCallback(() => {
    void getErrorLog().then(setEntries);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(await exportErrorLogAsJson());
      showSuccess(t('settings.diagnostics.copySuccess'));
    } catch {
      showError(t('settings.diagnostics.copyError'));
    }
  };

  const handleExport = async () => {
    const blob = new Blob([await exportErrorLogAsJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `fintracker-error-log-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = async () => {
    await clearErrorLog();
    setConfirmOpen(false);
    refresh();
    showSuccess(t('settings.diagnostics.clearSuccess'));
  };

  const lastEntry = entries[entries.length - 1];

  return (
    <InfoGroup
      title={t('settings.diagnostics.title')}
      description={t('settings.diagnostics.description')}
      className="mt-6"
    >
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('settings.diagnostics.empty')}</p>
      ) : (
        <>
          <InfoStatStrip
            items={[
              {
                label: t('settings.diagnostics.title'),
                value: t('settings.diagnostics.entryCount').replace(
                  '{count}',
                  String(entries.length),
                ),
              },
              {
                label: t('settings.diagnostics.lastError'),
                value: lastEntry ? new Date(lastEntry.timestamp).toLocaleString() : '—',
                tone: 'warning',
              },
            ]}
          />

          <ul className="space-y-2">
            {[...entries].reverse().map((entry) => (
              <li key={entry.id}>
                <InteractiveCard
                  onClick={() => setExpandedId((cur) => (cur === entry.id ? null : entry.id))}
                  expanded={expandedId === entry.id}
                  aria-controls={`diag-entry-${entry.id}`}
                >
                  <div className="flex items-baseline gap-2">
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                      {entry.source}
                      {entry.count > 1 ? ` ×${entry.count}` : ''}
                    </span>
                    <span className="truncate text-sm">{entry.message}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(entry.timestamp).toLocaleString()}
                  </div>
                </InteractiveCard>
                {expandedId === entry.id && entry.stack && (
                  <pre
                    id={`diag-entry-${entry.id}`}
                    className="mt-1 max-h-48 overflow-auto rounded-lg bg-muted/40 p-3 text-xs font-mono text-muted-foreground whitespace-pre-wrap"
                  >
                    {entry.stack}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={handleCopy} disabled={entries.length === 0}>
          <Copy className="mr-2 h-4 w-4" />
          {t('settings.diagnostics.copyButton')}
        </Button>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={entries.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          {t('settings.diagnostics.exportButton')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirmOpen(true)}
          disabled={entries.length === 0}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {t('settings.diagnostics.clearButton')}
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.diagnostics.clearConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.diagnostics.clearConfirmMessage')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('settings.diagnostics.clearConfirmCancel')}</AlertDialogCancel>
            <Button variant="destructive" onClick={handleClear}>
              {t('settings.diagnostics.clearConfirmAction')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </InfoGroup>
  );
}
