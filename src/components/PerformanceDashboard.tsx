/**
 * Internes Dev-/Diagnose-Tool (Audit D/E): zeigt Performance-Metriken,
 * Speicher- und Storage-Statistiken. Bewusst NICHT in der Hauptnavigation;
 * erreichbar nur als Abschnitt in den Einstellungen. Die alte Route
 * `/performance` leitet auf `/settings` um.
 */
import { useEffect, useMemo, useState } from 'react';
import { Activity, Zap, Database, Monitor, Clock, Trash2, Download } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { performanceMonitor, getMemoryUsage, formatDuration } from '@/lib/performance';
import { transactionStorage } from '@/services/transaction-storage-service';
import { showSuccess } from '@/utils/toast';
import { useI18n } from '@/i18n/useI18n';

export function PerformanceDashboard() {
  const { t } = useI18n();
  const [metrics, setMetrics] = useState<import('@/lib/performance').PerformanceMetric[]>([]);
  const [memoryInfo, setMemoryInfo] = useState<{ usedJSHeapSize?: number; totalJSHeapSize?: number; jsHeapSizeLimit?: number } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [storageStats, setStorageStats] = useState<any>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const refreshMetrics = async () => {
    const currentMetrics = performanceMonitor.getMetrics();
    setMetrics(currentMetrics);
    setMemoryInfo(getMemoryUsage());

    const stats = await transactionStorage.getStorageStats();
    setStorageStats(stats);
  };

  useEffect(() => {
    refreshMetrics();

    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refreshMetrics();
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const averageMetrics = useMemo(() => {
    const grouped = new Map<string, number[]>();

    metrics.forEach((m) => {
      if (!grouped.has(m.name)) {
        grouped.set(m.name, []);
      }
      grouped.get(m.name)!.push(m.duration);
    });

    return Array.from(grouped.entries()).map(([name, durations]) => ({
      name,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      count: durations.length,
    }));
  }, [metrics]);

  const slowOperations = useMemo(() => {
    return averageMetrics.filter((m) => m.avgDuration > 100);
  }, [averageMetrics]);

  const clearMetrics = () => {
    performanceMonitor.clear();
    setMetrics([]);
    showSuccess(t('performanceDashboard.metricsCleared'));
  };

  const downloadMetrics = () => {
    const data = {
      timestamp: new Date().toISOString(),
      metrics,
      averageMetrics,
      memoryInfo,
      storageStats,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `performance_metrics_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);

    showSuccess(t('performanceDashboard.metricsDownloaded'));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Activity className="h-6 w-6 text-positive" />
            {t('performanceDashboard.title')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('performanceDashboard.subtitle')}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="border-border bg-card text-foreground hover:bg-accent"
          >
            {autoRefresh ? t('performanceDashboard.autoRefreshOn') : t('performanceDashboard.autoRefreshOff')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshMetrics}
            className="border-border bg-card text-foreground hover:bg-accent"
          >
            {t('performanceDashboard.refreshButton')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadMetrics}
            className="border-border bg-card text-foreground hover:bg-accent"
          >
            <Download className="mr-2 h-4 w-4" />
            {t('performanceDashboard.exportButton')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clearMetrics}
            className="border-border bg-card text-foreground hover:bg-accent"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {t('performanceDashboard.deleteButton')}
          </Button>
        </div>
      </div>

      <Card className="ui-card border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Database className="h-5 w-5 text-premium" />
            {t('performanceDashboard.storageStatusTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {storageStats ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">{t('performanceDashboard.localTransactions')}</p>
                <p className="text-2xl font-bold text-foreground">{storageStats.data.local.count.toLocaleString('de-DE')}</p>
                <p className="text-xs text-muted-foreground">{(storageStats.data.local.size / 1024).toFixed(2)} KB</p>
              </div>

              <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">{t('performanceDashboard.externalPlaintext')}</p>
                <p className="text-2xl font-bold text-foreground">0</p>
                <p className="text-xs text-muted-foreground">{t('performanceDashboard.sensitiveDataLocal')}</p>
              </div>

              <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">{t('performanceDashboard.lastSyncAction')}</p>
                <p className="text-lg font-semibold text-foreground">
                  {storageStats.data.lastSync
                    ? new Date(storageStats.data.lastSync).toLocaleTimeString('de-DE')
                    : t('performanceDashboard.neverSynced')}
                </p>
              </div>
            </div>
          ) : (
            <p className="py-4 text-center text-muted-foreground">{t('performanceDashboard.noStorageInfo')}</p>
          )}
        </CardContent>
      </Card>

      {memoryInfo && (
        <Card className="ui-card border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Monitor className="h-5 w-5 text-brand" />
              {t('performanceDashboard.memoryUsageTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">{t('performanceDashboard.used')}</p>
                <p className="text-2xl font-bold text-foreground">
                  {((memoryInfo.usedJSHeapSize ?? 0) / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>

              <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">{t('performanceDashboard.total')}</p>
                <p className="text-2xl font-bold text-foreground">
                  {((memoryInfo.totalJSHeapSize ?? 0) / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>

              <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">{t('performanceDashboard.limit')}</p>
                <p className="text-2xl font-bold text-foreground">
                  {((memoryInfo.jsHeapSizeLimit ?? 0) / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>

            <div className="mt-4">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-gradient-to-r from-positive to-brand"
                  style={{
                    width: `${((memoryInfo.usedJSHeapSize ?? 0) / (memoryInfo.jsHeapSizeLimit ?? 1)) * 100}%`,
                  }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('performanceDashboard.percentUsed').replace('{percent}', (((memoryInfo.usedJSHeapSize ?? 0) / (memoryInfo.jsHeapSizeLimit ?? 1)) * 100).toFixed(1))}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="ui-card border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Zap className="h-5 w-5 text-warning" />
            {t('performanceDashboard.operationsPerformanceTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {slowOperations.length > 0 && (
            <Alert className="mb-4 border-warning/30 bg-warning/10">
              <Zap className="h-4 w-4 text-warning" />
              <AlertDescription className="text-warning">
                {t('performanceDashboard.slowOperationsWarning').replace('{count}', String(slowOperations.length))}
              </AlertDescription>
            </Alert>
          )}

          {averageMetrics.length > 0 ? (
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {averageMetrics.map((metric, index) => (
                <div
                  key={index}
                  className={`rounded-xl border p-3 ${
                    metric.avgDuration > 100
                      ? 'border-warning/30 bg-warning/10'
                      : 'border-border bg-card'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-foreground">{metric.name}</p>
                      <p className="text-xs text-muted-foreground">{t('performanceDashboard.calls').replace('{count}', String(metric.count))}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${metric.avgDuration > 100 ? 'text-warning' : 'text-positive'}`}>
                        {formatDuration(metric.avgDuration)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t('performanceDashboard.minMaxDuration').replace('{min}', formatDuration(metric.minDuration)).replace('{max}', formatDuration(metric.maxDuration))}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-muted-foreground">
              {t('performanceDashboard.noPerformanceData')}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="ui-card border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Clock className="h-5 w-5 text-brand" />
            {t('performanceDashboard.recentOperationsTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {metrics.length > 0 ? (
            <div className="max-h-60 space-y-2 overflow-y-auto">
              {metrics.slice(-10).reverse().map((metric, index) => (
                <div key={index} className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{metric.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(metric.timestamp).toLocaleTimeString('de-DE')}
                    </p>
                  </div>
                  <p className={`text-sm font-mono ${metric.duration > 100 ? 'text-warning' : 'text-positive'}`}>
                    {metric.duration.toFixed(2)}ms
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-muted-foreground">{t('performanceDashboard.noOperations')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}