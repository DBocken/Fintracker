/**
 * Kopfzeile der Trading-Fläche: Privatsphäre-Hinweis, Titel und Aktionsleiste.
 *
 * Aus `TradingDashboard.tsx` herausgelöst (WP 6.3, ARCH-5/KOMP-1). Der
 * Baustein kennt keine Abfrage und keinen Zustand — er bekommt, was er zeigt,
 * und meldet, was gedrückt wurde. Genau das erlaubt später eine zweite
 * Präsentation (Android, anderer Shell) auf demselben ViewModel.
 */
import type { Portfolio, PortfolioPosition } from '@/types';
import { useI18n } from '@/i18n/useI18n';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, FileText, Plus, RefreshCw, Shield, Upload } from 'lucide-react';
import ProviderSelector from './ProviderSelector';

export interface TradingHeaderProps {
  activePortfolio: Portfolio | null;
  positions: PortfolioPosition[] | undefined;
  quoteProvider: 'yahoo' | 'stooq';
  /** Gespeicherter Favorit — durchgereicht an den ProviderSelector. */
  favoriteProvider: 'yahoo' | 'stooq';
  onProviderChange: (provider: 'yahoo' | 'stooq') => void;
  /** Kursaktualisierung läuft gerade — Knopf gesperrt, Symbol dreht sich. */
  isRefreshingQuotes: boolean;
  onRefreshQuotes: () => void;
  onAddPosition: () => void;
  onImportImage: () => void;
  onImportCsv: () => void;
  /** eToro-Abgleich läuft gerade. */
  isSyncingEtoro: boolean;
  onSyncEtoro: () => void;
  onConnectEtoro: () => void;
  /** Zeitpunkt der letzten Kursaktualisierung; `null`, solange keine lief. */
  lastUpdate: Date | null;
}

export default function TradingHeader({
  activePortfolio,
  positions,
  quoteProvider,
  favoriteProvider,
  onProviderChange,
  isRefreshingQuotes,
  onRefreshQuotes,
  onAddPosition,
  onImportImage,
  onImportCsv,
  isSyncingEtoro,
  onSyncEtoro,
  onConnectEtoro,
  lastUpdate,
}: TradingHeaderProps) {
  const { t } = useI18n();

  return (
    <>
      {/* Privacy Banner */}
      <Alert className="border-primary/50 bg-primary/5">
        <Shield className="h-4 w-4" />
        <AlertDescription className="text-sm">
          <strong>🔒 {t('trading.dashboard.privacyModeTitle')}</strong> {t('trading.dashboard.privacyModeDesc')}
          {positions && positions.length > 0 && (
            <>
              <br />
              <span className="text-xs text-muted-foreground">
                💡 {t('trading.dashboard.pricesManualEditHint')}
              </span>
            </>
          )}
        </AlertDescription>
      </Alert>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t('trading.dashboard.title')}</h1>
          <p className="text-muted-foreground">
            {t('trading.dashboard.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ProviderSelector
            currentProvider={quoteProvider}
            favoriteProvider={favoriteProvider}
            onProviderChange={onProviderChange}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={onRefreshQuotes}
            disabled={isRefreshingQuotes || !positions || positions.length === 0}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshingQuotes ? 'animate-spin' : ''}`} />
            {t('trading.dashboard.refreshPrices')}
          </Button>
          <Button
            size="sm"
            onClick={onAddPosition}
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('trading.dashboard.addPosition')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onImportImage}
          >
            <Upload className="h-4 w-4 mr-2" />
            {t('trading.dashboard.importImage')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onImportCsv}
            title={t('trading.dashboard.csvComingSoon')}
          >
            <FileText className="h-4 w-4 mr-2" />
            {t('trading.dashboard.importCsv')}
          </Button>
          {activePortfolio?.type === 'etoro' && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSyncEtoro}
              disabled={isSyncingEtoro}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isSyncingEtoro ? 'animate-spin' : ''}`} />
              {t('trading.dashboard.syncEtoro')}
            </Button>
          )}
          <Button
            size="sm"
            onClick={onConnectEtoro}
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('trading.dashboard.connectEtoro')}
          </Button>
        </div>
      </div>

      {/* Live Update Status */}
      {lastUpdate && (
        <Alert>
          <Activity className="h-4 w-4" />
          <AlertDescription>
            {t('trading.dashboard.lastUpdated')
              .replace('{time}', lastUpdate.toLocaleTimeString('de-DE'))
              .replace('{provider}', quoteProvider.toUpperCase())}
            <Badge variant="outline" className="ml-1">{quoteProvider.toUpperCase()}</Badge>
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
