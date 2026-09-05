/**
 * Schritt 4 — die Anrede.
 *
 * Angemeldet: „Hallo {Vorname}" aus dem Anbieterprofil. Anonym: die Frage, wie
 * die App den Nutzer ansprechen soll — samt der Zusage, dass die Antwort das
 * Gerät nicht verlässt. Die Zusage steht bei der Eingabe und nicht im
 * Kleingedruckten am Seitenende: Sie ist der Grund, warum die Frage überhaupt
 * zumutbar ist.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/i18n/useI18n';

export interface GreetingStepProps {
  /** Anzeigename aus dem Konto, sofern angemeldet. */
  accountName: string | null;
  initialName: string;
  onContinue: (name: string) => void;
}

/** Der Vorname aus einem vollständigen Namen — die Anrede, nicht der Ausweis. */
export function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

export default function GreetingStep({
  accountName,
  initialName,
  onContinue,
}: GreetingStepProps) {
  const { t } = useI18n();
  const [name, setName] = useState(initialName);

  if (accountName) {
    const vorname = firstNameOf(accountName);
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-semibold">
            {t('onboardingFlow.greetingKnownTitle', 'Hallo {name}').replace('{name}', vorname)}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('onboardingFlow.greetingKnownBody', '')}
          </p>
        </div>
        <Button onClick={() => onContinue(vorname)}>
          {t('onboardingFlow.next', 'Weiter')}
        </Button>
      </div>
    );
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        onContinue(name);
      }}
    >
      <h1 className="font-display text-2xl font-semibold">
        {t('onboardingFlow.greetingAnonymousTitle', 'Wie soll ich dich ansprechen?')}
      </h1>

      <div className="space-y-2">
        <Label htmlFor="onboarding-name">
          {t('onboardingFlow.greetingNameLabel', 'Dein Name')}
        </Label>
        <Input
          id="onboarding-name"
          value={name}
          maxLength={80}
          autoComplete="given-name"
          placeholder={t('onboardingFlow.greetingNamePlaceholder', '')}
          onChange={(event) => setName(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          {t('onboardingFlow.greetingLocalNote', '')}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={name.trim().length === 0}>
          {t('onboardingFlow.next', 'Weiter')}
        </Button>
        <Button type="button" variant="ghost" onClick={() => onContinue('')}>
          {t('onboardingFlow.greetingSkipName', 'Ohne Namen fortfahren')}
        </Button>
      </div>
    </form>
  );
}
