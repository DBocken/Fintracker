/**
 * „Einstieg neu starten" — der Weg zurück an den Anfang des Flusses.
 *
 * Zwei Nutzungen, dieselbe Handlung: Wer den Einstieg entwickelt, muss ihn
 * wiederholt ansehen können; wer ihn einmal überflogen hat, will die
 * Einrichtung vielleicht in Ruhe neu machen.
 *
 * **Mit Rückfrage, weil die Fläche wechselt.** Der Klick führt aus der App
 * heraus in den Einstieg — das ist nichts, was man versehentlich tun will.
 * Die Rückfrage sagt zugleich das, was man wissen muss: Es werden keine Daten
 * gelöscht. Ohne diesen Satz liest sich „neu starten" wie ein Zurücksetzen der
 * ganzen App.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCcw } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/useI18n';
import { showError } from '@/utils/toast';
import { restartOnboarding } from '../data/onboarding-restart';

export interface RestartOnboardingButtonProps {
  className?: string;
}

export default function RestartOnboardingButton({ className }: RestartOnboardingButtonProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [laeuft, setLaeuft] = useState(false);

  const starten = async () => {
    setLaeuft(true);
    try {
      await restartOnboarding();
      navigate('/willkommen/sprache');
    } catch {
      // Scheitert das Zurücksetzen, bleibt der Nutzer wo er ist — eine
      // Weiterleitung in einen Fluss, dessen Zustand nicht steht, wäre
      // schlimmer als kein Neustart.
      showError(t('onboardingFlow.restartError', 'Der Einstieg konnte nicht zurückgesetzt werden.'));
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className={cn('min-h-11', className)} disabled={laeuft}>
          <RotateCcw className="mr-1 h-3 w-3" aria-hidden="true" />
          {t('onboardingFlow.restartAction', 'Einstieg neu starten')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('onboardingFlow.restartConfirmTitle', 'Einstieg neu starten?')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('onboardingFlow.restartConfirmBody', '')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('onboardingFlow.restartCancel', 'Abbrechen')}</AlertDialogCancel>
          <AlertDialogAction onClick={() => void starten()}>
            {t('onboardingFlow.restartAction', 'Einstieg neu starten')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
