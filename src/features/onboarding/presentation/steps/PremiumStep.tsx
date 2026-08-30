/**
 * Schritt 7 — was kostenlos bleibt und was Premium ist.
 *
 * Eine Gegenüberstellung, kein Kaufabschluss: Der Einstieg soll erklären, wo
 * die Grenze liegt, und nicht mitten im Einrichten eine Zahlung verlangen. Der
 * Weg zur Kaufseite steht als Angebot daneben.
 *
 * Wer anonym unterwegs ist, sieht zusätzlich, dass Buchen ein Konto braucht —
 * die Einschränkung gehört an die Stelle, an der sie zum ersten Mal
 * bedeutsam wird, nicht erst in den Kaufvorgang.
 */

import { Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/useI18n';

export interface PremiumStepProps {
  /** Anonymer Weg — dann kann hier nichts gebucht werden. */
  anonymous: boolean;
  onContinue: () => void;
  onBack: () => void;
  onOpenBilling: () => void;
}

const FREE_KEYS = [
  'onboardingFlow.premiumFreeImport',
  'onboardingFlow.premiumFreeCoach',
  'onboardingFlow.premiumFreeBank',
];

const PAID_KEYS = [
  'onboardingFlow.premiumPaidAnalytics',
  'onboardingFlow.premiumPaidSimulation',
  'onboardingFlow.premiumPaidContracts',
  'onboardingFlow.premiumPaidOccasions',
];

export default function PremiumStep({
  anonymous,
  onContinue,
  onBack,
  onOpenBilling,
}: PremiumStepProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold">
          {t('onboardingFlow.premiumTitle', '')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('onboardingFlow.premiumIntro', '')}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="ds-section p-4">
          <h2 className="font-display text-base font-semibold">
            {t('onboardingFlow.premiumFreeHeading', 'Immer kostenlos')}
          </h2>
          <ul className="mt-3 space-y-2">
            {FREE_KEYS.map((key) => (
              <li key={key} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-positive" aria-hidden="true" />
                <span>{t(key, '')}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="ds-section border-premium/40 p-4">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold">
            <Sparkles className="h-4 w-4 text-premium" aria-hidden="true" />
            {t('onboardingFlow.premiumPaidHeading', 'Mit Premium')}
          </h2>
          <ul className="mt-3 space-y-2">
            {PAID_KEYS.map((key) => (
              <li key={key} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-premium" aria-hidden="true" />
                <span>{t(key, '')}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {anonymous && (
        <p className="text-xs text-muted-foreground">
          {t('onboardingFlow.premiumAccountNote', '')}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <Button variant="ghost" onClick={onBack}>
          {t('onboardingFlow.back', 'Zurück')}
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onOpenBilling}>
            {t('onboardingFlow.premiumOpenBilling', 'Preise ansehen')}
          </Button>
          <Button onClick={onContinue}>{t('onboardingFlow.premiumLater', 'Weiter')}</Button>
        </div>
      </div>
    </div>
  );
}
