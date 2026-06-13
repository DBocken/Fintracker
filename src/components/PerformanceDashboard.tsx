import { useEffect, useMemo, useState } from 'react';
import { Activity, Zap, Database, Monitor, Clock, Trash2, Download } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { performanceMonitor, getMemoryUsage, formatDuration } from '@/lib/performance';
import { transactionStorage } from '@/services/transaction-storage-service';
import { showSuccess } from '@/utils/toast';

export function PerformanceDashboard() {
  const [metrics, setMetrics] = useState<any[]>([]);
  const [memoryInfo, setMemoryInfo] = useState<any>(null);
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
    showSuccess('Performance-Metriken gelöscht');
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

    showSuccess('Performance-Metriken heruntergeladen');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Activity className="h-6 w-6 text-positive" />
            Technischer Status
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ergänzende Informationen zur lokalen Speicherung und App-Leistung.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="border-border bg-card text-foreground hover:bg-accent"
          >
            {autoRefresh ? 'Auto-Refresh an' : 'Auto-Refresh aus'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshMetrics}
            className="border-border bg-card text-foreground hover:bg-accent"
          >
            Aktualisieren
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadMetrics}
            className="border-border bg-card text-foreground hover:bg-accent"
          >
            <Download className="mr-2 h-4 w-4" />
            Exportieren
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clearMetrics}
            className="border-border bg-card text-foreground hover:bg-accent"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Löschen
          </Button>
        </div>
      </div>

      <Card className="ui-card border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Database className="h-5 w-5 text-premium" />
            Lokaler Speicherstatus
          </CardTitle>
        </CardHeader>
        <CardContent>
          {storageStats ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">Lokale Transaktionen</p>
                <p className="text-2xl font-bold text-foreground">{storageStats.data.local.count.toLocaleString('de-DE')}</p>
                <p className="text-xs text-muted-foreground">{(storageStats.data.local.size / 1024).toFixed(2)} KB</p>
              </div>

              <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">Externe Klartext-Speicherung</p>
                <p className="text-2xl font-bold text-foreground">0</p>
                <p className="text-xs text-muted-foreground">sensible Daten liegen lokal</p>
              </div>

              <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">Letzte Sync-Aktion</p>
                <p className="text-lg font-semibold text-foreground">
                  {storageStats.data.lastSync
                    ? new Date(storageStats.data.lastSync).toLocaleTimeString('de-DE')
                    : 'noch keine'}
                </p>
              </div>
            </div>
          ) : (
            <p className="py-4 text-center text-muted-foreground">Keine Speicher-Informationen verfügbar</p>
          )}
        </CardContent>
      </Card>

      {memoryInfo && (
        <Card className="ui-card border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Monitor className="h-5 w-5 text-brand" />
              Speicherverbrauch
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">Genutzt</p>
                <p className="text-2xl font-bold text-foreground">
                  {(memoryInfo.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>

              <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">Gesamt</p>
                <p className="text-2xl font-bold text-foreground">
                  {(memoryInfo.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>

              <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">Limit</p>
                <p className="text-2xl font-bold text-foreground">
                  {(memoryInfo.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>

            <div className="mt-4">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-gradient-to-r from-positive to-brand"
                  style={{
                    width: `${(memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit) * 100}%`,
                  }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {((memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit) * 100).toFixed(1)}% genutzt
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="ui-card border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Zap className="h-5 w-5 text-warning" />
            Operations-Leistung
          </CardTitle>
        </CardHeader>
        <CardContent>
          {slowOperations.length > 0 && (
            <Alert className="mb-4 border-warning/30 bg-warning/10">
              <Zap className="h-4 w-4 text-warning" />
              <AlertDescription className="text-warning">
                {slowOperations.length} Operation(en) brauchen mehr als 100ms.
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
                      <p className="text-xs text-muted-foreground">{metric.count} Aufrufe</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${metric.avgDuration > 100 ? 'text-warning' : 'text-positive'}`}>
                        {formatDuration(metric.avgDuration)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Ø {formatDuration(metric.minDuration)} - {formatDuration(metric.maxDuration)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-muted-foreground">
              Keine Performance-Daten verfügbar. Führe einige Aktionen aus, um Metriken zu sammeln.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="ui-card border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Clock className="h-5 w-5 text-brand" />
            Letzte Operationen
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
            <p className="py-4 text-center text-muted-foreground">Keine Operationen aufgezeichnet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}