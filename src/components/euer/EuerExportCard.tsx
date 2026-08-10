import InteractiveCard from '@/features/shared/presentation/InteractiveCard';
import { Download } from 'lucide-react';
import { useI18n } from '@/i18n/useI18n';
import type { Category, Transaction } from '@/types';
import type { EuerReport } from '@/lib/euer-report';
import { buildEuerCsv, euerCsvFilename } from '@/lib/euer-export';

interface Props {
  report: EuerReport;
  transactions: Transaction[];
  categories: Category[];
}

export function EuerExportCard({ report, transactions, categories }: Props) {
  const { t } = useI18n();

  const handleExport = () => {
    const categoryNames = new Map(categories.map((c) => [c.id, c.name]));
    const csv = buildEuerCsv(report, transactions, (key, fallback) => t(key as never, fallback), categoryNames);
    // UTF-8 BOM, damit Excel Umlaute korrekt liest (Muster TaxExportCard).
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', euerCsvFilename(report.year));
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <InteractiveCard onClick={handleExport} indicator="none" aria-label={t('euer.export.button', 'EÜR als CSV exportieren')}>
      <div className="flex items-center gap-3">
        <Download className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-medium">{t('euer.export.title', 'Export für die Anlage EÜR')}</p>
          <p className="text-xs text-muted-foreground">
            {t('euer.export.description', 'Alle Zeilen mit Einzelbuchungen, Summen und Abziehbar-Spalte – für Steuerberater oder ELSTER-Vorbereitung.')}
          </p>
        </div>
      </div>
    </InteractiveCard>
  );
}
