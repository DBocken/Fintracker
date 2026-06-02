"use client";

import { useState, useEffect, useMemo } from 'react';
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

  // Refresh metrics
  const refreshMetrics = async () => {
    const currentMetrics = performanceMonitor.getMetrics();
    setMetrics(currentMetrics);
    setMemoryInfo(getMemoryUsage());
    
    const stats = await transactionStorage.getStorageStats();
    setStorageStats(stats);
  };

  // Auto-refresh metrics every 5 seconds
  useEffect(() => {
    refreshMetrics();
    
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      refreshMetrics();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Calculate average durations
  const averageMetrics = useMemo(() => {
    const grouped = new Map<string, number[]>();
    
    metrics.forEach(m => {
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

  // Get slow operations (> 100ms)
  const slowOperations = useMemo(() => {
    return averageMetrics.filter(m => m.avgDuration > 100);
  }, [averageMetrics]);

  // Clear performance metrics
  const clearMetrics = () => {
    performanceMonitor.clear();
    setMetrics([]);
    showSuccess('Performance-Metriken gelöscht');
  };

  // Download metrics as JSON
  const downloadMetrics = () => {
    const data = {
      timestamp: new Date().toISOString(),
      metrics: metrics,
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-blue-500" />
            Performance Dashboard
          </h2>
          <p className="text-muted-foreground mt-1">
            Echtzeit-Überwachung der App-Leistung
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? '🔄 Auto-Refresh An' : '⏸️ Auto-Refresh Aus'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshMetrics}
          >
            🔄 Aktualisieren
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadMetrics}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportieren
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clearMetrics}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Löschen
          </Button>
        </div>
      </div>

      {/* Storage Stats */}
      <Card className="ui-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-purple-500" />
            Speicher-Statistik
          </CardTitle>
        </CardHeader>
        <CardContent>
          {storageStats ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-slate-900/50 space-y-2">
                <p className="text-sm text-muted-foreground">Lokale Transaktionen</p>
                <p className="text-2xl font-bold">{storageStats.data.local.count.toLocaleString('de-DE')}</p>
                <p className="text-xs text-muted-foreground">
                  {(storageStats.data.local.size / 1024).toFixed(2)} KB
                </p>
              </div>
              
              <div className="p-4 rounded-lg bg-slate-900/50 space-y-2">
                <p className="text-sm text-muted-foreground">Cloud-Transaktionen</p>
                <p className="text-2xl font-bold">
                  {storageStats.data.cloud?.count?.toLocaleString('de-DE') || 'N/A'}
                </p>
              </div>
              
              <div className="p-4 rounded-lg bg-slate-900/50 space-y-2">
                <p className="text-sm text-muted-foreground">Letzter Sync</p>
                <p className="text-lg font-semibold">
                  {storageStats.data.lastSync
                    ? new Date(storageStats.data.lastSync).toLocaleTimeString('de-DE')
                    : 'Nie'}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              Keine Speicher-Informationen verfügbar
            </p>
          )}
        </CardContent>
      </Card>

      {/* Memory Stats */}
      {memoryInfo && (
        <Card className="ui-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5 text-green-500" />
              Speicher-Verbrauch
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-slate-900/50 space-y-2">
                <p className="text-sm text-muted-foreground">Genutzt</p>
                <p className="text-2xl font-bold">
                  {(memoryInfo.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              
              <div className="p-4 rounded-lg bg-slate-900/50 space-y-2">
                <p className="text-sm text-muted-foreground">Gesamt</p>
                <p className="text-2xl font-bold">
                  {(memoryInfo.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              
              <div className="p-4 rounded-lg bg-slate-900/50 space-y-2">
                <p className="text-sm text-muted-foreground">Limit</p>
                <p className="text-2xl font-bold">
                  {(memoryInfo.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            
            {/* Memory usage bar */}
            <div className="mt-4">
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-yellow-500"
                  style={{
                    width: `${(memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit) * 100}%`,
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {((memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit) * 100).toFixed(1)}% genutzt
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Metrics */}
      <Card className="ui-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Operations-Leistung
          </CardTitle>
        </CardHeader>
        <CardContent>
          {slowOperations.length > 0 && (
            <Alert className="mb-4 bg-yellow-500/10 border-yellow-500/30">
              <Zap className="h-4 w-4 text-yellow-500" />
              <AlertDescription>
                <span className="font-semibold text-yellow-600">Langsame Operationen erkannt</span>
                <br />
                {slowOperations.length} Operation(en) brauchen mehr als 100ms. 
                Dies kann die Benutzererfahrung beeinträchtigen.
              </AlertDescription>
            </Alert>
          )}
          
          {averageMetrics.length > 0 ? (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {averageMetrics.map((metric, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border ${
                    metric.avgDuration > 100
                      ? 'bg-yellow-500/10 border-yellow-500/30'
                      : 'bg-slate-900/50 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{metric.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {metric.count} Aufrufe
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${
                        metric.avgDuration > 100 ? 'text-yellow-500' : 'text-green-500'
                      }`}>
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
            <p className="text-center text-muted-foreground py-8">
              Keine Performance-Daten verfügbar. Führe einige Aktionen aus, um Metriken zu sammeln.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recent Operations */}
      <Card className="ui-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-500" />
            Letzte Operationen
          </CardTitle>
        </CardHeader>
        <CardContent>
          {metrics.length > 0 ? (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {metrics.slice(-10).reverse().map((metric, index) => (
                <div key={index} className="flex items-center justify-between p-2 rounded bg-slate-900/50">
                  <div>
                    <p className="text-sm font-medium">{metric.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(metric.timestamp).toLocaleTimeString('de-DE')}
                    </p>
                  </div>
                  <p className={`text-sm font-mono ${
                    metric.duration > 100 ? 'text-yellow-500' : 'text-green-500'
                  }`}>
                    {metric.duration.toFixed(2)}ms
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              Keine Operationen aufgezeichnet
            </p>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="ui-card">
        <CardHeader>
          <CardTitle>Performance-Tipps</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Lange Listen:</strong> Bei über 100 Transaktionen wird automatisch virtualisiertes Scrollen verwendet, um die Performance zu verbessern.
          </p>
          <p>
            <strong className="text-foreground">Cache:</strong> React Query cacht Daten für 5 Minuten, um unnötige API-Aufrufe zu vermeiden.
          </p>
          <p>
            <strong className="text-foreground">Speicher:</strong> Der lokale Speicher hat ein Limit von ~5 MB. Verwende Cloud-Storage für große Datensätze.
          </p>
          <p>
            <strong className="text-foreground">Langsame Operationen:</strong> Operationen über 100ms werden als "langsam" markiert. Überprüfe diese auf Optimierungsmöglichkeiten.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}