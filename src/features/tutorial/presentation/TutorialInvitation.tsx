import { useState } from 'react';
import { GraduationCap, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/useI18n';
import type { TutorialRun } from '../application/useTutorialRun';

/**
 * Die Einladung zum nächsten Kapitel — bewusst ein Angebot, kein Dialog.
 *
 * Ein modaler Dialog würde die App anhalten und damit genau das tun, was die
 * behutsame Heranführung vermeiden soll (`docs/tutorial-progressive-disclosure.md`).
 *
 * Form ist bewusst der Banner-Streifen von `DemoDataBanner` und keine Karte:
 * Karten-Chrome verlangt, dass die ganze Fläche eine Handlung auslöst
 * (`docs/design-principles.md`, „Karten sind Aktionen"). Hier gibt es aber
 * zwei gleichberechtigte Ziele — starten und wegklicken —, und „Nicht jetzt"
 * darf niemals versehentlich die Führung starten.
 */
export default function TutorialInvitation({ run }: { run: TutorialRun }) {
  const { t } = useI18n();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !run.upcoming) return null;

  return (
    <div className="border-b border-brand/30 bg-brand/10">
      <div className="mx-auto flex w-full max-w-[1320px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5 text-xs sm:text-sm md:px-8">
        <GraduationCap className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="font-medium">{t('tutorial.invitationTitle', 'Soll ich es dir zeigen?')}</span>{' '}
          <span className="text-muted-foreground">
            {t('tutorial.invitationBody', 'Eine kurze Führung durch diesen Bereich.')}
          </span>
        </span>
        <Button variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-xs" onClick={() => run.start()}>
          {t('tutorial.invitationStart', 'Zeig es mir')}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          aria-label={t('tutorial.invitationDismiss', 'Nicht jetzt')}
          onClick={() => setDismissed(true)}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
