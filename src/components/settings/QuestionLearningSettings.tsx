import { Button } from '@/components/ui/button';
import { InfoGroup } from '@/features/shared/presentation/InfoGroup';
import { useI18n } from '@/i18n/useI18n';
import { useQuestionLearning } from '@/hooks/useQuestionLearning';

/**
 * Rechenschaft über die Lernschleife der Nachfragen-Fläche (WP-F.5): Was der
 * Router aus den eigenen Bestätigungen gelernt hat, ist hier sichtbar und
 * mit EINEM Klick löschbar — gespeicherte Fragen können Händlernamen tragen,
 * und gespeichertes Lernen ohne Löschpfad wäre keine Einstellung, sondern
 * eine Falle.
 */
export function QuestionLearningSettings() {
  const { t } = useI18n();
  const lernen = useQuestionLearning();

  return (
    <InfoGroup title={t('settings.questionLearning.title')}>
      <p className="text-sm text-muted-foreground">
        {lernen.isError
          ? t('settings.questionLearning.loadError')
          : t('settings.questionLearning.description')
              .split('{anzahl}')
              .join(String(lernen.anzahl))}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-2"
        disabled={lernen.anzahl === 0 || lernen.loeschenLaeuft}
        onClick={lernen.loeschen}
      >
        {t('settings.questionLearning.clear')}
      </Button>
    </InfoGroup>
  );
}
