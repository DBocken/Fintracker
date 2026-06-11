import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, RotateCcw, CheckCircle } from 'lucide-react';

interface BulkAssignmentProps {
  status: 'idle' | 'processing' | 'completed';
  results: {
    total: number;
    assigned: number;
    unassigned: number;
  } | null;
  onBulkAssign: () => void;
  onRecategorize: () => void;
  isRecategorizing: boolean;
}

export function BulkAssignment({ 
  status, 
  results, 
  onBulkAssign, 
  onRecategorize, 
  isRecategorizing 
}: BulkAssignmentProps) {
  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <Play className="h-5 w-5" />
          Massenzuweisung der Kategorien
        </CardTitle>
        <CardDescription>
          Weise vordefinierte Kategorien basierend auf Stichworten automatisch allen Transaktionen zu
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="p-4 bg-brand/15 rounded-lg">
            <h3 className="font-semibold mb-2">Wie funktioniert die Massenzuweisung?</h3>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• Alle vorhandenen Transaktionen werden analysiert</li>
              <li>• Die Filter-Schlüsselwörter jeder Kategorie werden angewendet</li>
              <li>• Transaktionen werden basierend auf Payee und Beschreibung kategorisiert</li>
              <li>• Bereits kategorisierte Transaktionen werden überschrieben</li>
            </ul>
          </div>

          <div className="flex gap-4">
            <Button
              onClick={onBulkAssign}
              disabled={status === 'processing'}
              className="btn-premium"
            >
              {status === 'processing' ? (
                <>
                  <Play className="h-4 w-4 mr-2 animate-spin" />
                  Verarbeite...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Jetzt zuweisen
                </>
              )}
            </Button>
            <Button
              onClick={onRecategorize}
              disabled={isRecategorizing}
              variant="outline"
              className="btn-secondary-premium"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Neu kategorisieren
            </Button>
          </div>

          {status === 'completed' && results && (
            <Card className="bg-positive/15 border-positive/15">
              <CardHeader>
                <CardTitle className="text-positive flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Zuweisung abgeschlossen
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-positive">{results.total}</div>
                    <div className="text-sm text-muted-foreground">Gesamt</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-brand">{results.assigned}</div>
                    <div className="text-sm text-muted-foreground">Zugewiesen</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-warning">{results.unassigned}</div>
                    <div className="text-sm text-muted-foreground">Unkategorisiert</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </CardContent>
    </Card>
  );
}