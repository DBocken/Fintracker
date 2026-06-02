"use client";

import { useState, useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Download,
  FileText,
  Database,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { getTransactions } from '@/services/transaction-service';
import { transactionStorage } from '@/services/transaction-storage-service';
import type { Transaction } from '@/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type ExportFormat = 'csv' | 'pdf';

export function DataExport() {
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const [selectedDateRange, setSelectedDateRange] = useState<'all' | '30d' | '90d' | '1y'>('all');

  const { data: transactions = [], isLoading: isLoadingTransactions } = useQuery<Transaction[]>({
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
          throw new Error(result.error || 'Export failed');
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
      showSuccess(`Erfolgreich ${result.count} Transaktionen exportiert`);
    },
    onError: (error: Error) => {
      showError(`Export fehlgeschlagen: ${error.message}`);
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

  const downloadPDF = (transactions: Transaction[]) => {
    const doc = new jsPDF();
    const date = new Date().toLocaleDateString('de-DE');

    doc.setFontSize(18);
    doc.setFont('helvetica', 'normal');
    doc.text('Ausgabentracker Export', 14, 20);

    const totalIncome = transactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = Math.abs(
      transactions
        .filter(t => t.amount < 0)
        .reduce((sum, t) => sum + t.amount, 0)
    );

    const balance = totalIncome - totalExpenses;

    doc.setFontSize(10);
    doc.text(`Exportiert am: ${date}`, 14, 28);
    doc.text(`Gesamteinnahmen: €${totalIncome.toFixed(2)}`, 14, 42);
    doc.text(`Gesamtausgaben: €${totalExpenses.toFixed(2)}`, 14, 48);
    doc.text(`Saldo: €${balance.toFixed(2)}`, 14, 54);

    const tableData = transactions
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map(t => [
        t.date,
        t.payee,
        t.description.substring(0, 50),
        t.amount.toFixed(2) + ' €',
        t.category_id || 'Unkategorisiert',
      ]);

    autoTable(doc, {
      head: [['Datum', 'Empfänger', 'Beschreibung', 'Betrag', 'Kategorie']],
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
          <Download className="h-5 w-5 text-blue-500" />
          Daten Export
        </CardTitle>
        <CardDescription>
          Exportiere deine Transaktionen als CSV oder PDF für externe Analyse oder Backup
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">Zeitraum</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(['all', '30d', '90d', '1y'] as const).map((range) => (
              <Button
                key={range}
                variant={selectedDateRange === range ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedDateRange(range)}
                className="w-full"
              >
                {range === 'all' ? 'Alle Daten' :
                 range === '30d' ? '30 Tage' :
                 range === '90d' ? '90 Tage' : '1 Jahr'}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Exportformat</label>
          <div className="grid grid-cols-2 gap-4">
            <Button
              variant={exportFormat === 'csv' ? 'default' : 'outline'}
              onClick={() => setExportFormat('csv')}
              className="h-20 flex flex-col items-center justify-center gap-2"
            >
              <FileText className="h-6 w-6" />
              <div className="text-left">
                <div className="font-semibold">CSV</div>
                <div className="text-xs text-muted-foreground">Kompatibel mit Excel</div>
              </div>
            </Button>
            <Button
              variant={exportFormat === 'pdf' ? 'default' : 'outline'}
              onClick={() => setExportFormat('pdf')}
              className="h-20 flex flex-col items-center justify-center gap-2"
            >
              <Database className="h-6 w-6" />
              <div className="text-left">
                <div className="font-semibold">PDF</div>
                <div className="text-xs text-muted-foreground">Formatierter Bericht</div>
              </div>
            </Button>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-muted space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Anzahl Transaktionen:
            </span>
            <span className="font-semibold">{filteredTransactions.length}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Dateiname:
            </span>
            <span className="font-mono text-xs">{getFileNamePreview()}</span>
          </div>
        </div>

        <Alert className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Der Export enthält alle Transaktionen mit ihren Kategorien und Beschreibungen. 
            CSV-Dateien können in Excel, Numbers oder anderen Tabellenkalkulationen geöffnet werden.
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
              Exportiere...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              {filteredTransactions.length} Transaktionen exportieren
            </>
          )}
        </Button>

        {filteredTransactions.length === 0 && !isLoadingTransactions && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Keine Transaktionen zum Exportieren verfügbar. 
              Importiere zuerst Daten oder wähle einen anderen Zeitraum.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}