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

import type { ReactNode } from 'react';
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

/**
 * Die Aufzählungen stehen als AUSGESCHRIEBENE `t()`-Aufrufe da, nicht als
 * Liste von Schlüsseln, die eine Schleife durchreicht.
 *
 * Eine Liste wäre kürzer und trotzdem falsch: Ein aus einer Variablen
 * gebauter Schlüssel ist für `call-site-keys.test.ts` nicht mehr prüfbar —
 * ein Tippfehler darin rendert den rohen Punkt-String auf den Bildschirm,
 * und die Locale-Parität sieht das nicht (sie vergleicht die Bäume
 * gegeneinander, nicht die Aufrufstellen). Die Ratsche für durchgereichte
 * Schlüssel gilt den Stellen, an denen die Durchreichung der ENTWURF ist
 * (Register-Einträge, Nav-Labels); hier ist sie nur Bequemlichkeit.
 */
function Punkt({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm text-muted-foreground">
      {icon}
      <span>{children}</span>
    </li>
  );
}

export default function PremiumStep({
  anonymous,
  onContinue,
  onBack,
  onOpenBilling,
}: PremiumStepProps) {
  const { t } = useI18n();
  const frei = <Check className="mt-0.5 h-4 w-4 shrink-0 text-positive" aria-hidden="true" />;
  const premium = <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-premium" aria-hidden="true" />;

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
            <Punkt icon={frei}>{t('onboardingFlow.premiumFreeImport', '')}</Punkt>
            <Punkt icon={frei}>{t('onboardingFlow.premiumFreeCoach', '')}</Punkt>
            <Punkt icon={frei}>{t('onboardingFlow.premiumFreeBank', '')}</Punkt>
          </ul>
        </div>

        <div className="ds-section border-premium/40 p-4">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold">
            <Sparkles className="h-4 w-4 text-premium" aria-hidden="true" />
            {t('onboardingFlow.premiumPaidHeading', 'Mit Premium')}
          </h2>
          <ul className="mt-3 space-y-2">
            <Punkt icon={premium}>{t('onboardingFlow.premiumPaidAnalytics', '')}</Punkt>
            <Punkt icon={premium}>{t('onboardingFlow.premiumPaidSimulation', '')}</Punkt>
            <Punkt icon={premium}>{t('onboardingFlow.premiumPaidContracts', '')}</Punkt>
            <Punkt icon={premium}>{t('onboardingFlow.premiumPaidOccasions', '')}</Punkt>
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
