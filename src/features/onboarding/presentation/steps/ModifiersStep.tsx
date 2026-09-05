/**
 * Schritt 6 — die Umstände.
 *
 * Mehrfachauswahl, rein additiv: Jeder Umstand schaltet zusätzliche Bereiche
 * frei, keiner nimmt etwas weg. Deshalb steht hier ein „Weiter" und keine
 * unmittelbare Wahl — anders als bei der Lebenssituation ist die Antwort erst
 * vollständig, wenn der Nutzer sagt, dass sie es ist.
 *
 * Eigener Schritt seit dem Dichte-Umbau; vorher stand er unter der
 * Lebenssituation auf derselben Seite.
 */

import { Button } from '@/components/ui/button';
import { MODIFIERS, type ModifierId } from '@/lib/life-situations';
import { useI18n } from '@/i18n/useI18n';
import { cn } from '@/lib/utils';

export interface ModifiersStepProps {
  selected: readonly ModifierId[];
  onToggle: (id: ModifierId) => void;
  onContinue: () => void;
  onBack: () => void;
}

export default function ModifiersStep({
  selected,
  onToggle,
  onContinue,
  onBack,
}: ModifiersStepProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 id="onboarding-modifiers-title" className="font-display text-2xl font-semibold">
          {t('onboarding.modifiersTitle', 'Trifft davon etwas zu?')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('onboarding.modifiersHint', '')}</p>
      </div>

      <div aria-labelledby="onboarding-modifiers-title" className="flex flex-wrap gap-2">
        {MODIFIERS.map((modifier) => {
          const active = selected.includes(modifier.id);
          return (
            <button
              key={modifier.id}
              type="button"
              role="checkbox"
              aria-checked={active}
              onClick={() => onToggle(modifier.id)}
              className={cn(
                'min-h-[44px] rounded-full border px-4 py-2 text-sm transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active
                  ? 'border-primary bg-primary/10 font-medium text-foreground'
                  : 'border-border text-muted-foreground hover:bg-accent/40',
              )}
            >
              {t(modifier.labelKey, modifier.id)}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <Button variant="ghost" onClick={onBack}>
          {t('onboardingFlow.back', 'Zurück')}
        </Button>
        <Button onClick={onContinue}>
          {selected.length === 0
            ? t('onboardingFlow.modifiersNone', 'Nichts davon')
            : t('onboardingFlow.next', 'Weiter')}
        </Button>
      </div>
    </div>
  );
}
