/**
 * Schritt 3 — Anmelden oder registrieren.
 *
 * Zwei eigene Karten im Stil des Flusses: „Mit Google" startet den
 * Anbieterwechsel unmittelbar, „Mit E-Mail und Passwort" klappt das
 * Supabase-Auth-Widget auf. Das Widget bleibt, weil es Registrierung,
 * Anmeldung, Passwort-vergessen und Bestätigungsmail bereits vollständig
 * abdeckt; eigene Karten davor, weil ein Fremd-Widget als ERSTER Eindruck den
 * Stilbruch mitten in den Einstieg legen würde.
 *
 * Die drei Sonderfälle der abgelösten Anmeldeseite ziehen mit um: der native
 * Capacitor-Weg (System-Browser + Deep-Link), die iframe-Warnung und der
 * direkte Google-Aufruf.
 */

import { useState } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { Mail, Chrome } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { getRedirectOrigin } from '@/lib/app-origin';
import { useI18n } from '@/i18n/useI18n';

export interface AuthStepProps {
  /** Zurück zur Wegwahl — „doch lieber anonym". */
  onBack: () => void;
}

/** Der Auftritt des Widgets, an die Token der App gebunden. */
const WIDGET_APPEARANCE = {
  theme: ThemeSupa,
  variables: {
    default: {
      colors: {
        brand: 'hsl(var(--primary))',
        brandAccent: 'hsl(var(--primary))',
        brandButtonText: 'hsl(var(--primary-foreground))',
        inputBackground: 'hsl(var(--background))',
        inputText: 'hsl(var(--foreground))',
        inputBorder: 'hsl(var(--border))',
        inputLabelText: 'hsl(var(--muted-foreground))',
        messageText: 'hsl(var(--muted-foreground))',
        anchorTextColor: 'hsl(var(--muted-foreground))',
      },
      radii: { borderRadiusButton: '0.5rem', inputBorderRadius: '0.5rem' },
    },
  },
} as const;

export default function AuthStep({ onBack }: AuthStepProps) {
  const { t } = useI18n();
  const [showEmail, setShowEmail] = useState(false);
  const [failed, setFailed] = useState(false);

  const isInIframe = typeof window !== 'undefined' && window.top !== window.self;
  const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();

  const signInWithGoogle = async () => {
    setFailed(false);
    try {
      if (isNative) {
        // Nativ: PKCE im System-Browser, Rückweg über den Deep-Link.
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: 'ausgabentracker://auth-callback', skipBrowserRedirect: true },
        });
        if (error) {
          setFailed(true);
          return;
        }
        if (data?.url) await Browser.open({ url: data.url, windowName: '_self' });
        return;
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${getRedirectOrigin()}/` },
      });
      if (error) setFailed(true);
    } catch {
      setFailed(true);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold">
          {t('onboardingFlow.authTitle', 'Anmelden oder registrieren')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('onboardingFlow.authSubtitle', '')}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => void signInWithGoogle()}
          className="ds-section flex min-h-[44px] w-full cursor-pointer flex-col items-start gap-1 p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Chrome className="h-5 w-5 text-primary" aria-hidden="true" />
          <span className="font-display text-lg font-semibold">
            {t('onboardingFlow.authGoogleLabel', 'Mit Google fortfahren')}
          </span>
          <span className="text-sm text-muted-foreground">
            {t('onboardingFlow.authGoogleDescription', '')}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setShowEmail(true)}
          aria-expanded={showEmail}
          className="ds-section flex min-h-[44px] w-full cursor-pointer flex-col items-start gap-1 p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Mail className="h-5 w-5 text-primary" aria-hidden="true" />
          <span className="font-display text-lg font-semibold">
            {t('onboardingFlow.authEmailLabel', 'Mit E-Mail und Passwort')}
          </span>
          <span className="text-sm text-muted-foreground">
            {t('onboardingFlow.authEmailDescription', '')}
          </span>
        </button>
      </div>

      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {t('onboardingFlow.authError', 'Die Anmeldung konnte nicht gestartet werden.')}
        </p>
      )}

      {showEmail && (
        <div className="ds-section p-4">
          <Auth supabaseClient={supabase} providers={[]} appearance={WIDGET_APPEARANCE} />
        </div>
      )}

      {isNative && (
        <Button variant="secondary" size="sm" onClick={() => void signInWithGoogle()}>
          {t('onboardingFlow.authGoogleMobile', 'Google-Anmeldung (mobil)')}
        </Button>
      )}

      {isInIframe && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-3">
          <p className="text-xs text-warning dark:text-warning">
            {t('onboardingFlow.authIframeWarning', '')}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(window.location.href, '_blank', 'noopener,noreferrer')}
            >
              {t('onboardingFlow.authOpenInNewTab', 'Im neuen Tab öffnen')}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void signInWithGoogle()}>
              {t('onboardingFlow.authGoogleDirect', 'Google-Anmeldung (direkt)')}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3 border-t pt-4">
        <p className="text-xs text-muted-foreground">
          {t('onboardingFlow.authFutureProviders', '')}
        </p>
        <Button variant="ghost" size="sm" onClick={onBack}>
          {t('onboardingFlow.authSwitchToAnonymous', 'Doch lieber anonym starten')}
        </Button>
      </div>
    </div>
  );
}
