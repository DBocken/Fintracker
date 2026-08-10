import { useState, useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import FinanceErrorState from '@/features/shared/presentation/FinanceErrorState';
import {
  Download,
  FileText,
  Database,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { getTransactions } from '@/services/transaction-service';
import { sumIncome, sumExpenses } from '@/lib/analysis-data';
import { transactionStorage } from '@/services/transaction-storage-service';
import { useI18n } from '@/i18n/useI18n';
import type { Transaction } from '@/types';

type ExportFormat = 'csv' | 'pdf';

export function DataExport() {
  const { t } = useI18n();
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const [selectedDateRange, setSelectedDateRange] = useState<'all' | '30d' | '90d' | '1y'>('all');

  // WP-9.6: Ohne den Fehlerfall exportiert die Seite stillschweigend eine
  // LEERE Datei — und die sieht aus wie ein vollstaendiger Export. Bei einer
  // Sicherung ist das die teuerste Verwechslung, die die App anbieten kann.
  const {
    data: transactions = [],
    isLoading: isLoadingTransactions,
    isError: transactionsError,
    refetch: refetchTransactions,
  } = useQuery<Transaction[]>({
    queryKey: ['transactions', 'export'],
    queryFn: () => getTransactions(10000),
  });

  const filteredTransactions = useMemo(() => {
    if (selectedDateRange === 'all') return transactions;
    
    const now = new Date();
    const cutoffDate = new Date();

    switch (selectedDateRange) {
      case '30d':
        cutoffDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        cutoffDate.setDate(now.getDate() - 90);
        break;
      case '1y':
        cutoffDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    return transactions.filter(t => new Date(t.date) >= cutoffDate);
  }, [transactions, selectedDateRange]);

  const exportMutation = useMutation({
    mutationFn: async (format: ExportFormat) => {
      if (format === 'csv') {
        const result = await transactionStorage.exportToCSV(filteredTransactions);
        if (!result.success || !result.data) {
          throw new Error(result.error || t('dataExport.genericExportFailed'));
        }
        return { format, csv: result.data, count: filteredTransactions.length };
      } else {
        return { format, csv: '', count: filteredTransactions.length };
      }
    },
    onSuccess: (result) => {
      if (result.format === 'csv' && result.csv) {
        downloadCSV(result.csv, result.count);
      } else if (result.format === 'pdf') {
        downloadPDF(filteredTransactions);
      }
      showSuccess(t('dataExport.exportSuccess').replace('{count}', String(result.count)));
    },
    onError: (error: Error) => {
      showError(t('dataExport.exportError').replace('{error}', error.message));
    },
  });

  const downloadCSV = (csv: string, count: number) => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const date = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `ausgabentracker_export_${date}_${count}_transactions.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadPDF = async (transactions: Transaction[]) => {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const doc = new jsPDF();
    const date = new Date().toLocaleDateString('de-DE');

    doc.setFontSize(18);
    doc.setFont('helvetica', 'normal');
    doc.text(t('dataExport.pdfExportTitle'), 14, 20);

    // Transferbereinigte Summen (Invariante 2) — gleiche Quelle wie das
    // Dashboard, damit der exportierte Bericht keine internen Überträge als
    // Einnahmen/Ausgaben ausweist (F-MONEY-3).
    const totalIncome = sumIncome(transactions);
    const totalExpenses = sumExpenses(transactions);

    const balance = totalIncome - totalExpenses;

    doc.setFontSize(10);
    doc.text(t('dataExport.pdfExportedAt').replace('{date}', date), 14, 28);
    doc.text(t('dataExport.pdfTotalIncome').replace('{amount}', totalIncome.toFixed(2)), 14, 42);
    doc.text(t('dataExport.pdfTotalExpenses').replace('{amount}', totalExpenses.toFixed(2)), 14, 48);
    doc.text(t('dataExport.pdfBalance').replace('{amount}', balance.toFixed(2)), 14, 54);

    const tableData = transactions
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map(tx => [
        tx.date,
        tx.payee,
        tx.description.substring(0, 50),
        tx.amount.toFixed(2) + ' €',
        tx.category_id || t('dataExport.uncategorized'),
      ]);

    autoTable(doc, {
      head: [[t('dataExport.pdfTableHeader.0'), t('dataExport.pdfTableHeader.1'), t('dataExport.pdfTableHeader.2'), t('dataExport.pdfTableHeader.3'), t('dataExport.pdfTableHeader.4')]],
      body: tableData,
      startY: 64,
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: { fillColor: [59, 130, 246] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });

    doc.save(`ausgabentracker_export_${date}.pdf`);
  };

  const getFileNamePreview = () => {
    const date = new Date().toISOString().split('T')[0];
    const count = filteredTransactions.length;
    const ext = exportFormat === 'csv' ? 'csv' : 'pdf';
    return `ausgabentracker_export_${date}_${count}_transactions.${ext}`;
  };

  const handleExport = () => {
    exportMutation.mutate(exportFormat);
  };

  return (
    <Card className="ui-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5 text-brand" />
          {t('dataExport.title')}
        </CardTitle>
        <CardDescription>
          {t('dataExport.description')}
        </CardDescription>
      </CardHeader>

      {/*
        WP 7.1 — „nicht ladbar" ist nicht „nichts zu exportieren".

        Bis hierher stand der Fehlerhinweis nur ÜBER dem vollständigen
        Exportformular: darunter behauptete dieselbe Fläche weiter
        „Anzahl Transaktionen: 0" und „Keine Transaktionen zum Exportieren
        verfügbar. Importiere zuerst Daten …" — eine Aufforderung, Daten neu
        zu erfassen, die es längst gibt. Zwei widersprechende Aussagen
        nebeneinander, und die untere ist die falsche.

        Deshalb ersetzt der Fehlerzustand das Formular, statt sich darüber zu
        setzen: Aus unlesbaren Daten gibt es weder eine Anzahl noch einen
        Export ([REGRESSION] `ExportPage.error-state.test.tsx`).
      */}
      {transactionsError ? (
        <CardContent>
          <FinanceErrorState variant="transactions" onRetry={() => void refetchTransactions()} />
        </CardContent>
      ) : (
        <CardContent className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">{t('dataExport.timeRange')}</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['all', '30d', '90d', '1y'] as const).map((range) => (
                <Button
                  key={range}
                  variant={selectedDateRange === range ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedDateRange(range)}
                  className="w-full"
                >
                  {range === 'all' ? t('dataExport.allData') :
                   range === '30d' ? t('dataExport.days30') :
                   range === '90d' ? t('dataExport.days90') : t('dataExport.year1')}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">{t('dataExport.format')}</label>
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant={exportFormat === 'csv' ? 'default' : 'outline'}
                onClick={() => setExportFormat('csv')}
                className="h-20 flex flex-col items-center justify-center gap-2"
              >
                <FileText className="h-6 w-6" />
                <div className="text-left">
                  <div className="font-semibold">{t('dataExport.csvTitle')}</div>
                  <div className="text-xs opacity-80">{t('dataExport.csvDesc')}</div>
                </div>
              </Button>
              <Button
                variant={exportFormat === 'pdf' ? 'default' : 'outline'}
                onClick={() => setExportFormat('pdf')}
                className="h-20 flex flex-col items-center justify-center gap-2"
              >
                <Database className="h-6 w-6" />
                <div className="text-left">
                  <div className="font-semibold">{t('dataExport.pdfTitle')}</div>
                  <div className="text-xs opacity-80">{t('dataExport.pdfDesc')}</div>
                </div>
              </Button>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-muted space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {t('dataExport.transactionCount')}
              </span>
              <span className="font-semibold">{filteredTransactions.length}</span>
            </div>
            <div className="flex items-start justify-between gap-2 text-sm">
              <span className="shrink-0 text-muted-foreground">
                {t('dataExport.fileName')}
              </span>
              <span className="min-w-0 break-all text-right font-mono text-xs">{getFileNamePreview()}</span>
            </div>
          </div>

          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              {t('dataExport.alertText')}
            </AlertDescription>
          </Alert>

          <Button
            onClick={handleExport}
            disabled={isLoadingTransactions || exportMutation.isPending || filteredTransactions.length === 0}
            className="w-full"
            size="lg"
          >
            {exportMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('dataExport.exporting')}
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                {t('dataExport.exportButton').replace('{count}', String(filteredTransactions.length))}
              </>
            )}
          </Button>

          {filteredTransactions.length === 0 && !isLoadingTransactions && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {t('dataExport.noTransactions')}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      )}
    </Card>
  );
}