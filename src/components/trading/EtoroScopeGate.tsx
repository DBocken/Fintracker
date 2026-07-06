import type { ReactNode } from 'react';
import { Loader2, Lock, ShieldAlert, RefreshCw } from 'lucide-react';
import { useI18n } from '@/i18n/useI18n';
import EmptyState from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { EtoroAccountError } from '@/services/etoro-account-service';

interface EtoroScopeGateProps {
  /** Verschlüsselung gesperrt → Credentials nicht nutzbar. */
  isLocked: boolean;
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
  children: ReactNode;
}

/**
 * Rahmen um eToro-Live-Ansichten: zeigt statt eines Absturzes einen klaren
 * Zustand, wenn die Daten (noch) nicht verfügbar sind — gesperrte
 * Verschlüsselung, Laden, fehlender API-Scope (401/403) oder Ladefehler.
 *
 * Wichtig: Der Tab selbst bleibt immer sichtbar; nur sein Inhalt degradiert.
 * Ein fehlender Scope wirkt sonst wie ein Bug ("Tab verschwunden").
 */
export default function EtoroScopeGate({ isLocked, isLoading, error, onRetry, children }: EtoroScopeGateProps) {
  const { t } = useI18n();

  if (isLocked) {
    return (
      <EmptyState
        icon={Lock}
        title={t('trading.etoro.gate.lockedTitle')}
        description={t('trading.etoro.gate.lockedDesc')}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12" role="status" aria-label={t('trading.etoro.gate.loading')}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    const isScopeMissing = error instanceof EtoroAccountError && error.isAuthError;
    return (
      <EmptyState
        icon={ShieldAlert}
        title={isScopeMissing ? t('trading.etoro.gate.scopeMissingTitle') : t('trading.etoro.gate.errorTitle')}
        description={isScopeMissing ? t('trading.etoro.gate.scopeMissingDesc') : error.message}
        action={
          !isScopeMissing && onRetry ? (
            <Button variant="outline" onClick={onRetry}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('trading.etoro.gate.retry')}
            </Button>
          ) : undefined
        }
      />
    );
  }

  return <>{children}</>;
}
