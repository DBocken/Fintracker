/**
 * Schritt 1 — die Sprachwahl am Übergabepunkt.
 *
 * Die Begrüßung steht **gleichzeitig in allen Sprachen** da, jede mit ihrer
 * Flagge und ihrem Endonym. Der Text wird deshalb je Sprache direkt aus dem
 * Übersetzungsbaum gelesen und NICHT über die aktive Sprache aufgelöst: Eine
 * Sprachauswahl muss lesbar sein, ohne dass man die gerade eingestellte
 * Sprache versteht — dieselbe Begründung wie das Endonym in
 * `src/i18n/locale-options.ts`.
 */

import { LOCALE_OPTIONS } from '@/i18n/locale-options';
import { lookupTranslation } from '@/i18n/I18nProvider';
import { useI18n } from '@/i18n/useI18n';
import DissolveChoiceGrid from '../DissolveChoiceGrid';

export interface LanguageStepProps {
  onChoose: (locale: string) => void;
}

export default function LanguageStep({ onChoose }: LanguageStepProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 id="onboarding-language-title" className="font-display text-2xl font-semibold">
          {t('onboardingFlow.languageTitle', 'Wähle deine Sprache')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('onboardingFlow.languageHint', '')}
        </p>
      </div>

      <DissolveChoiceGrid
        ariaLabelledBy="onboarding-language-title"
        className="sm:grid-cols-3"
        items={LOCALE_OPTIONS.map((option) => ({
          id: option.value,
          ariaLabel: t('onboardingFlow.languageChoose', 'Auf {language} fortfahren').replace(
            '{language}',
            option.label,
          ),
          content: (
            <>
              <span aria-hidden="true" className="text-3xl leading-none">
                {option.flag}
              </span>
              <span className="font-display text-lg font-semibold">
                {/* Der Gruß in GENAU dieser Sprache, nicht in der aktiven. */}
                {lookupTranslation(option.value, 'onboardingFlow.greeting') ?? option.label}
              </span>
              <span className="text-sm text-muted-foreground">{option.label}</span>
            </>
          ),
        }))}
        onSelect={onChoose}
      />
    </div>
  );
}
