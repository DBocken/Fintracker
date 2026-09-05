/**
 * Schritt 8 — woher die Daten kommen, und ob es geführt losgeht.
 *
 * Zwei Fragen auf einer Seite, nacheinander: erst die Datenquelle (die
 * abgelöste „Kapitel 0"-Weiche), dann das Tutorial. Die Reihenfolge ist
 * Inhalt — was gezeigt wird, hängt davon ab, woher die Daten kommen
 * (`docs/tutorial-sequence.md`).
 */

import { useState } from 'react';
import { Compass, FileUp, FlaskConical, GraduationCap, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { TutorialSource } from '@/lib/tutorial-sequence';
import { useI18n } from '@/i18n/useI18n';
import DissolveChoiceGrid from '../DissolveChoiceGrid';

export interface StartStepProps {
  /** Anonymer Weg — die Bankanbindung braucht dann ein Konto. */
  anonymous: boolean;
  saving: boolean;
  saveFailed: boolean;
  onBack: () => void;
  onFinish: (input: { source: TutorialSource; startTutorial: boolean }) => void;
}

const SOURCES: { id: TutorialSource; icon: typeof FileUp; labelKey: string; descriptionKey: string }[] = [
  { id: 'csv', icon: FileUp, labelKey: 'tutorialSource.csvLabel', descriptionKey: 'tutorialSource.csvDescription' },
  { id: 'bank', icon: Landmark, labelKey: 'tutorialSource.bankLabel', descriptionKey: 'tutorialSource.bankDescription' },
  { id: 'demo', icon: FlaskConical, labelKey: 'tutorialSource.demoLabel', descriptionKey: 'tutorialSource.demoDescription' },
];

export default function StartStep({
  anonymous,
  saving,
  saveFailed,
  onBack,
  onFinish,
}: StartStepProps) {
  const { t } = useI18n();
  const [source, setSource] = useState<TutorialSource | null>(null);

  if (source === null) {
    return (
      <div className="space-y-6">
        <h1 id="onboarding-source-title" className="font-display text-2xl font-semibold">
          {t('tutorialSource.title', 'Womit möchtest du anfangen?')}
        </h1>

        <DissolveChoiceGrid
          ariaLabelledBy="onboarding-source-title"
          items={SOURCES.map((option) => {
            const Icon = option.icon;
            return {
              id: option.id,
              content: (
                <>
                  <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  <span className="font-display text-lg font-semibold">
                    {t(option.labelKey, option.id)}
                  </span>
                  <span className="text-sm leading-snug text-muted-foreground">
                    {t(option.descriptionKey, '')}
                  </span>
                  {option.id === 'bank' && anonymous && (
                    <span className="text-xs text-muted-foreground">
                      {t('onboardingFlow.startBankNeedsAccount', '')}
                    </span>
                  )}
                </>
              ),
            };
          })}
          onSelect={(id) => setSource(id as TutorialSource)}
        />

        <div className="border-t pt-4">
          <Button variant="ghost" onClick={onBack}>
            {t('onboardingFlow.back', 'Zurück')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 id="onboarding-tutorial-title" className="font-display text-2xl font-semibold">
        {t('onboardingFlow.startTutorialTitle', 'Möchtest du ein Tutorial starten?')}
      </h1>

      {source === 'demo' && (
        <p className="text-sm text-muted-foreground">
          {t('onboardingFlow.startTutorialDemoNote', '')}
        </p>
      )}

      <DissolveChoiceGrid
        ariaLabelledBy="onboarding-tutorial-title"
        className="sm:grid-cols-2"
        disabled={saving}
        items={[
          {
            id: 'guided',
            content: (
              <>
                <GraduationCap className="h-5 w-5 text-primary" aria-hidden="true" />
                <span className="font-display text-lg font-semibold">
                  {t('onboardingFlow.startTutorialYes', 'Tutorial starten')}
                </span>
                <span className="text-sm text-muted-foreground">
                  {t('onboarding.tutorial.guidedDescription', '')}
                </span>
              </>
            ),
          },
          {
            id: 'explore',
            content: (
              <>
                <Compass className="h-5 w-5 text-primary" aria-hidden="true" />
                <span className="font-display text-lg font-semibold">
                  {t('onboardingFlow.startTutorialNo', 'Selbst erkunden')}
                </span>
                <span className="text-sm text-muted-foreground">
                  {t('onboarding.tutorial.exploreDescription', '')}
                </span>
              </>
            ),
          },
        ]}
        onSelect={(id) => onFinish({ source, startTutorial: id === 'guided' })}
      />

      {saveFailed && (
        <p role="alert" className="text-sm text-destructive">
          {t('onboardingFlow.saveError', 'Deine Auswahl konnte nicht gespeichert werden.')}
        </p>
      )}

      <div className="border-t pt-4">
        <Button variant="ghost" disabled={saving} onClick={() => setSource(null)}>
          {t('onboardingFlow.back', 'Zurück')}
        </Button>
      </div>
    </div>
  );
}
