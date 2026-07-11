import { AlertTriangle } from 'lucide-react';
import { InfoGroup } from '@/components/common/InfoGroup';
import { formatCurrency } from '@/lib/utils';
import { useI18n } from '@/i18n/useI18n';
import type { EuerReport, EuerWarning } from '@/lib/euer-report';

interface Props {
  report: EuerReport;
  /** Kandidaten-Hinweis nur im Business-Modus zeigen (Doktrin: nie Auto-Zählung). */
  showCandidates?: boolean;
  onOpenTransaction?: (id: string) => void;
}

function warningText(w: EuerWarning, t: (k: string, f?: string) => string): string {
  return t(`euer.warning.${w.kind}`, w.kind)
    .replace('{count}', String(w.count ?? 0))
    .replace('{amount}', formatCurrency(w.amount ?? 0));
}

/** Kartenlose Hinweis-Liste (reine Info; Deep-Links als explizite Buttons). */
export function EuerWarningsCard({ report, showCandidates, onOpenTransaction }: Props) {
  const { t } = useI18n();
  const candidates = showCandidates ? report.candidateIncomeTxIds : [];
  if (report.warnings.length === 0 && candidates.length === 0) return null;

  return (
    <InfoGroup title={t('euer.page.warningsTitle', 'Hinweise')}>
      <div className="space-y-2">
        {report.warnings.map((w, i) => (
          <p key={`${w.kind}-${i}`} className="flex items-start gap-1.5 text-xs text-warning">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              {warningText(w, t)}
              {w.kind === 'unassignedExpenses' && onOpenTransaction && report.unassignedExpenseTxIds.length > 0 && (
                <button
                  type="button"
                  className="ml-1 text-brand underline underline-offset-2"
                  onClick={() => onOpenTransaction(report.unassignedExpenseTxIds[0])}
                >
                  {t('euer.page.openTransaction', 'Buchung ansehen')}
                </button>
              )}
            </span>
          </p>
        ))}

        {candidates.length > 0 && (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              {t('euer.warning.candidates', '{count} mögliche Betriebseinnahmen auf Privatkonten – prüfen und ggf. markieren.').replace(
                '{count}',
                String(candidates.length),
              )}
              {onOpenTransaction && (
                <button
                  type="button"
                  className="ml-1 text-brand underline underline-offset-2"
                  onClick={() => onOpenTransaction(candidates[0])}
                >
                  {t('euer.page.openTransaction', 'Buchung ansehen')}
                </button>
              )}
            </span>
          </p>
        )}
      </div>
    </InfoGroup>
  );
}
