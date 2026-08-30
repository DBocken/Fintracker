/**
 * Schritt 6 — „Welche Funktionen sind für dich wichtig?"
 *
 * Vorbelegt aus der Lebenssituation, einzeln umschaltbar. Der Hinweis auf die
 * Einstellungen steht direkt unter der Überschrift: Wer weiss, dass er die
 * Wahl zurücknehmen kann, entscheidet leichter.
 */

import { Button } from '@/components/ui/button';
import type { NavFeatureId } from '@/lib/life-situations';
import { useI18n } from '@/i18n/useI18n';
import FeatureSelection from '../FeatureSelection';
import type { FeatureCatalog } from '../../domain/feature-rows';

export interface FeaturesStepProps {
  catalog: FeatureCatalog;
  selected: readonly NavFeatureId[];
  onToggle: (id: NavFeatureId) => void;
  onContinue: () => void;
  onBack: () => void;
}

export default function FeaturesStep({
  catalog,
  selected,
  onToggle,
  onContinue,
  onBack,
}: FeaturesStepProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold">
          {t('onboardingFlow.featuresTitle', 'Welche Funktionen sind für dich wichtig?')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('onboardingFlow.featuresSubtitle', '')}
        </p>
      </div>

      <FeatureSelection hideHeading catalog={catalog} selected={selected} onToggle={onToggle} />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <Button variant="ghost" onClick={onBack}>
          {t('onboardingFlow.back', 'Zurück')}
        </Button>
        <Button onClick={onContinue}>{t('onboardingFlow.next', 'Weiter')}</Button>
      </div>
    </div>
  );
}
