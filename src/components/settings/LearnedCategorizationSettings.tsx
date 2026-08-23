import { GraduationCap, LoaderCircle } from 'lucide-react';
import { InfoGroup } from '@/features/shared/presentation/InfoGroup';
import { useI18n } from '@/i18n/useI18n';
import { useCategoryModelReport } from '@/hooks/useCategoryModelReport';

/** Anteil als ganze Prozentzahl — der Bericht redet in „von 100", nicht in Kommastellen. */
function alsProzent(anteil: number): string {
  return String(Math.round(anteil * 100));
}

/**
 * „Wie gut ordnet Fintracker zu?" — der Rechenschaftsbericht der gelernten
 * Kategorisierung (WP-B).
 *
 * Steht in den Einstellungen und nicht im Coach: Es ist eine Auskunft über das
 * Verhalten der App, keine Coaching-Aufgabe. Bewusst zwei Sätze statt eines
 * Prozentwerts als Selbstzweck — eine nackte Zahl beantwortet nicht, ob sich
 * das Lernen lohnt.
 */
export function LearnedCategorizationSettings() {
  const { t } = useI18n();
  const { report, isLoading, isError } = useCategoryModelReport();

  return (
    <InfoGroup
      title={
        <span className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4" />
          {t('learnedCategorization.title')}
        </span>
      }
    >
      {isError ? (
        <p className="text-sm text-muted-foreground">{t('learnedCategorization.error')}</p>
      ) : isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          {t('learnedCategorization.loading')}
        </p>
      ) : !report || report.mitModell.oberhalbSchwelle === 0 ? (
        // Leerzustand mit Grund: „noch nichts gelernt" ist eine andere Aussage
        // als „funktioniert nicht" — und nur die erste stimmt hier.
        <p className="text-sm text-muted-foreground">{t('learnedCategorization.empty')}</p>
      ) : (
        <>
          <p className="text-sm">
            {t('learnedCategorization.withModel')
              .replace('{correct}', alsProzent(report.mitModell.praezision))}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('learnedCategorization.withoutModel')
              .replace('{correct}', alsProzent(report.ohneModell.praezision))
              .replace('{coverage}', alsProzent(report.ohneModell.abdeckung))
              .replace('{modelCoverage}', alsProzent(report.mitModell.abdeckung))}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {t('learnedCategorization.basis').replace('{count}', String(report.bewertet))}
          </p>
        </>
      )}
    </InfoGroup>
  );
}
