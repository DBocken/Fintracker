/**
 * Schritt 2 — „Du hast zwei Möglichkeiten."
 *
 * Anonym oder angemeldet. Die Einschränkung des anonymen Wegs wird beim Namen
 * genannt (Banksynchronisierung braucht ein Konto), statt sie später als
 * Überraschung auftauchen zu lassen.
 */

import { ShieldCheck, UserRound } from 'lucide-react';
import { useI18n } from '@/i18n/useI18n';
import DissolveChoiceGrid from '../DissolveChoiceGrid';
import type { OnboardingPath } from '../../domain/onboarding-draft';

export interface PathStepProps {
  onChoose: (path: OnboardingPath) => void;
}

export default function PathStep({ onChoose }: PathStepProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <h1 id="onboarding-path-title" className="font-display text-2xl font-semibold">
        {t('onboardingFlow.pathTitle', 'Du hast zwei Möglichkeiten.')}
      </h1>

      <DissolveChoiceGrid
        ariaLabelledBy="onboarding-path-title"
        className="sm:grid-cols-2"
        items={[
          {
            id: 'anonymous',
            content: (
              <>
                <UserRound className="h-5 w-5 text-primary" aria-hidden="true" />
                <span className="font-display text-lg font-semibold">
                  {t('onboardingFlow.pathAnonymousLabel', 'Anonym')}
                </span>
                <span className="text-sm leading-snug text-muted-foreground">
                  {t('onboardingFlow.pathAnonymousDescription', '')}
                </span>
              </>
            ),
          },
          {
            id: 'account',
            content: (
              <>
                <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
                <span className="font-display text-lg font-semibold">
                  {t('onboardingFlow.pathAccountLabel', 'Angemeldet')}
                </span>
                <span className="text-sm leading-snug text-muted-foreground">
                  {t('onboardingFlow.pathAccountDescription', '')}
                </span>
              </>
            ),
          },
        ]}
        onSelect={(id) => onChoose(id as OnboardingPath)}
      />

      <p className="text-xs text-muted-foreground">
        {t('onboardingFlow.pathLocalNote', '')}
      </p>
    </div>
  );
}
