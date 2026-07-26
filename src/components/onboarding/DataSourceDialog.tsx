import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { FileUp, Landmark, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import InteractiveCard from '@/components/common/InteractiveCard';
import { getUserSettings, updateUserSettings } from '@/services/user-settings-service';
import { isDemoDataActive, loadDemoData } from '@/services/demo-data-service';
import type { TutorialSource } from '@/lib/tutorial-sequence';
import type { UserSettings } from '@/types';
import { showError } from '@/utils/toast';
import { useI18n } from '@/i18n/useI18n';

/**
 * Kapitel 0 des Tutorials — die Datenquellen-Weiche
 * (`docs/tutorial-sequence.md`).
 *
 * Sie steht **vor** der Lebenssituation, und das ist kein Geschmack: Die
 * Frage nach den Daten ist die unverfänglichere, und erst wenn Buchungen da
 * sind, kann die App eine Lebenssituation *vorschlagen* statt sie zu erfragen.
 * `OnboardingDialog` öffnet deshalb erst, wenn hier entschieden ist.
 *
 * Die drei Wege unterscheiden sich nicht im Lehrplan, der danach folgt —
 * sondern im Risiko, das ihr jeweiliges Kapitel erklären muss: Fehlzuordnung
 * und Dubletten (Datei), Vertrauen und Zustimmungsablauf (Bank), Verwechslung
 * mit echten Daten (Beispieldaten).
 */

type SourceOption = {
  id: TutorialSource;
  icon: typeof FileUp;
  labelKey: string;
  descriptionKey: string;
};

const OPTIONS: SourceOption[] = [
  {
    id: 'csv',
    icon: FileUp,
    labelKey: 'tutorialSource.csvLabel',
    descriptionKey: 'tutorialSource.csvDescription',
  },
  {
    id: 'bank',
    icon: Landmark,
    labelKey: 'tutorialSource.bankLabel',
    descriptionKey: 'tutorialSource.bankDescription',
  },
  {
    id: 'demo',
    icon: FlaskConical,
    labelKey: 'tutorialSource.demoLabel',
    descriptionKey: 'tutorialSource.demoDescription',
  },
];

/** Wohin der jeweilige Weg führt. Alle drei enden an derselben Stelle: Buchungen. */
const DESTINATION: Record<TutorialSource, string> = {
  csv: '/csv',
  bank: '/accounts',
  demo: '/dashboard',
};

export default function DataSourceDialog() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ['userSettings'], queryFn: getUserSettings });
  const [pending, setPending] = useState<TutorialSource | null>(null);

  const mutation = useMutation({
    mutationFn: (updates: Partial<UserSettings>) => updateUserSettings(updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['userSettings'] }),
    onError: () => showError(t('onboarding.saveError', 'Auswahl konnte nicht gespeichert werden.')),
  });

  // `undefined` = nie gefragt. Wer über den Demo-Knopf der Anmeldeseite
  // hereinkam, hat die Frage faktisch schon beantwortet — ein zweites Mal
  // fragen wäre Gedächtnisverlust, deshalb wird der Weg still notiert.
  const asked = settings !== undefined && settings.tutorial_source !== undefined;
  const demoAlreadyRunning = isDemoDataActive();
  const open = settings !== undefined && !asked && !demoAlreadyRunning;

  const { mutate } = mutation;
  useEffect(() => {
    if (settings === undefined || asked || !demoAlreadyRunning) return;
    mutate({ tutorial_source: 'demo' });
  }, [settings, asked, demoAlreadyRunning, mutate]);

  const choose = async (source: TutorialSource) => {
    setPending(source);
    try {
      if (source === 'demo') await loadDemoData();
      await mutation.mutateAsync({ tutorial_source: source });
      await queryClient.invalidateQueries();
      navigate(DESTINATION[source]);
    } finally {
      setPending(null);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent
        className="max-h-[85vh] max-w-2xl overflow-y-auto"
        // Kein Schließen per Escape/Klick daneben: der Weg hinaus führt über
        // „Später entscheiden", damit der Zustand eindeutig gespeichert wird.
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t('tutorialSource.title', 'Womit möchtest du anfangen?')}</DialogTitle>
          <DialogDescription>{t('tutorialSource.subtitle', '')}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            const busy = pending === option.id;
            return (
              <InteractiveCard
                key={option.id}
                onClick={() => void choose(option.id)}
                disabled={pending !== null}
                className="p-4"
              >
                <div className="flex items-start gap-3">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="font-medium">{t(option.labelKey, option.id)}</p>
                    <p className="text-sm text-muted-foreground">
                      {busy && option.id === 'demo'
                        ? t('tutorialSource.demoLoading', 'Beispieldaten werden geladen…')
                        : t(option.descriptionKey, '')}
                    </p>
                  </div>
                </div>
              </InteractiveCard>
            );
          })}
        </div>

        <div className="flex justify-start border-t pt-4">
          <Button
            variant="ghost"
            disabled={pending !== null || mutation.isPending}
            // `null` = gefragt und übersprungen. Ohne diesen Zustand käme die
            // Weiche bei jedem Start wieder.
            onClick={() => mutation.mutate({ tutorial_source: null })}
          >
            {t('tutorialSource.skip', 'Später entscheiden')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
