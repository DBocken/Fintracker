import { Briefcase } from 'lucide-react';
import InteractiveCard from '@/features/shared/presentation/InteractiveCard';
import { useI18n } from '@/i18n/useI18n';

/**
 * Wegweiser von /tax zur EÜR-Auswertung: Betriebseinnahmen/-ausgaben sind aus
 * dem Steuer-Report entkoppelt (eigene Netting-Regeln) und leben auf /euer.
 * Sichtbarkeit steuert die Seite (business_mode ODER vorhandene EÜR-Markierungen).
 */
export function EuerPointerCard() {
  const { t } = useI18n();
  return (
    <InteractiveCard to="/euer" aria-label={t('tax.euerPointer.title', 'Einnahmenüberschussrechnung (EÜR)')}>
      <div className="flex items-center gap-3">
        <Briefcase className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {t('tax.euerPointer.title', 'Einnahmenüberschussrechnung (EÜR)')}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('tax.euerPointer.body', 'Betriebseinnahmen & -ausgaben werden separat ausgewertet.')}
          </p>
        </div>
      </div>
    </InteractiveCard>
  );
}
