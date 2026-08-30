/**
 * Schritt 5 — die Lebenssituation.
 *
 * Sie steht bewusst VOR der Bereichsauswahl und nicht dahinter: Sie ist die
 * einzige Quelle der Vorauswahl (`resolveFeatureSelection`) — ohne sie stünde
 * der nächste Schritt auf einer leeren Liste.
 */

import { Button } from '@/components/ui/button';
import type { LifeSituationId, ModifierId } from '@/lib/life-situations';
import { useI18n } from '@/i18n/useI18n';
import LifeSituationPicker from '../LifeSituationPicker';

export interface SituationStepProps {
  value: LifeSituationId | null;
  modifiers: readonly ModifierId[];
  onChange: (id: LifeSituationId) => void;
  onToggleModifier: (id: ModifierId) => void;
  onContinue: () => void;
  onSkip: () => void;
}

export default function SituationStep({
  value,
  modifiers,
  onChange,
  onToggleModifier,
  onContinue,
  onSkip,
}: SituationStepProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <LifeSituationPicker
        value={value}
        modifiers={modifiers}
        onChange={onChange}
        onToggleModifier={onToggleModifier}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <Button variant="ghost" onClick={onSkip}>
          {t('onboardingFlow.skip', 'Später entscheiden')}
        </Button>
        <Button onClick={onContinue} disabled={value === null}>
          {t('onboardingFlow.next', 'Weiter')}
        </Button>
      </div>
    </div>
  );
}
