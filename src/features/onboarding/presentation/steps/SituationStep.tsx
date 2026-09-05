/**
 * Schritt 5 — die Lebenssituation.
 *
 * Sie steht bewusst VOR der Bereichsauswahl: Sie ist die einzige Quelle der
 * Vorauswahl (`resolveFeatureSelection`) — ohne sie stünde der übernächste
 * Schritt auf einer leeren Liste.
 *
 * **Nur die Situation, nicht auch die Umstände.** Beides zusammen waren 17
 * Auswahlelemente in zwei verschiedenen Auswahllogiken auf einer Seite. Die
 * Umstände sind jetzt ein eigener Schritt (`ModifiersStep`) —
 * `docs/architecture/darstellungsdichte.md`, Regel „Aussage → Detail →
 * Konfiguration".
 *
 * Die Wahl führt unmittelbar weiter, wie in jedem anderen Auswahl-Schritt des
 * Flusses: Ein zusätzlicher „Weiter"-Knopf wäre eine zweite Entscheidung für
 * eine bereits getroffene.
 */

import { Button } from '@/components/ui/button';
import { LIFE_SITUATIONS, type LifeSituationId } from '@/lib/life-situations';
import { useI18n } from '@/i18n/useI18n';
import DissolveChoiceGrid from '../DissolveChoiceGrid';

export interface SituationStepProps {
  onChoose: (id: LifeSituationId) => void;
  onSkip: () => void;
}

export default function SituationStep({ onChoose, onSkip }: SituationStepProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 id="onboarding-situation-title" className="font-display text-2xl font-semibold">
          {t('onboarding.title', 'Welche Situation beschreibt dich am ehesten?')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('onboarding.subtitle', '')}</p>
      </div>

      <DissolveChoiceGrid
        ariaLabelledBy="onboarding-situation-title"
        className="sm:grid-cols-2"
        items={LIFE_SITUATIONS.map((situation) => ({
          id: situation.id,
          content: (
            <>
              <span className="font-medium">{t(situation.labelKey, situation.id)}</span>
              <span className="text-sm leading-snug text-muted-foreground">
                {t(situation.descriptionKey, '')}
              </span>
            </>
          ),
        }))}
        onSelect={(id) => onChoose(id as LifeSituationId)}
      />

      <div className="border-t pt-4">
        <Button variant="ghost" onClick={onSkip}>
          {t('onboardingFlow.skip', 'Später entscheiden')}
        </Button>
      </div>
    </div>
  );
}
