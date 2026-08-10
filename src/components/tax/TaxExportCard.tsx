import InteractiveCard from '@/features/shared/presentation/InteractiveCard';
import { Download } from 'lucide-react';
import { useI18n } from '@/i18n/useI18n';
import type { Transaction } from '@/types';
import type { TaxYearReport } from '@/lib/tax-report';
import { buildTaxCsv, taxCsvFilename } from '@/lib/tax-export';

interface Props {
  report: TaxYearReport;
  transactions: Transaction[];
}

export function TaxExportCard({ report, transactions }: Props) {
  const { t } = useI18n();

  const handleExport = () => {
    const csv = buildTaxCsv(report, transactions, (key, fallback) => t(key as never, fallback));
    // UTF-8 BOM, damit Excel Umlaute in den Empfänger-Namen korrekt liest.
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', taxCsvFilename(report.year));
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Ganze Fläche ist das Klick-Ziel (Export-Aktion), Chevron entfällt zugunsten
  // des Download-Icons.
  return (
    <InteractiveCard onClick={handleExport} indicator="none" aria-label={t('tax.export.button', 'Als CSV exportieren')}>
      <div className="flex items-center gap-3">
        <Download className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-medium">{t('tax.export.title', 'Export für die Steuererklärung')}</p>
          <p className="text-xs text-muted-foreground">{t('tax.export.description', '')}</p>
        </div>
      </div>
    </InteractiveCard>
  );
}
