import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, RotateCcw, CheckCircle } from 'lucide-react';
import { useI18n } from '@/i18n/useI18n';

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
  const { t } = useI18n();

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <Play className="h-5 w-5" />
          {t('settings.bulkAssignment.title')}
        </CardTitle>
        <CardDescription>
          {t('settings.bulkAssignment.description')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="p-4 bg-brand/15 rounded-lg">
            <h3 className="font-semibold mb-2">{t('settings.bulkAssignment.howItWorks')}</h3>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• {t('settings.bulkAssignment.step1')}</li>
              <li>• {t('settings.bulkAssignment.step2')}</li>
              <li>• {t('settings.bulkAssignment.step3')}</li>
              <li>• {t('settings.bulkAssignment.step4')}</li>
            </ul>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
            <Button
              onClick={onBulkAssign}
              disabled={status === 'processing'}
              className="btn-premium w-full sm:w-auto"
            >
              {status === 'processing' ? (
                <>
                  <Play className="h-4 w-4 mr-2 animate-spin" />
                  {t('settings.bulkAssignment.processingLabel')}
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  {t('settings.bulkAssignment.assignButton')}
                </>
              )}
            </Button>
            <Button
              onClick={onRecategorize}
              disabled={isRecategorizing}
              variant="outline"
              className="btn-secondary-premium w-full sm:w-auto"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              {t('settings.bulkAssignment.recategorizeButton')}
            </Button>
          </div>

          {status === 'completed' && results && (
            <Card className="bg-positive/15 border-positive/15">
              <CardHeader>
                <CardTitle className="text-positive flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  {t('settings.bulkAssignment.completedTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-positive">{results.total}</div>
                    <div className="text-sm text-muted-foreground">{t('settings.bulkAssignment.totalLabel')}</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-brand">{results.assigned}</div>
                    <div className="text-sm text-muted-foreground">{t('settings.bulkAssignment.assignedLabel')}</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-warning">{results.unassigned}</div>
                    <div className="text-sm text-muted-foreground">{t('settings.bulkAssignment.unassignedLabel')}</div>
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