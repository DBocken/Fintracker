import { useState } from 'react';
import { GraduationCap, ListChecks, Play } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useI18n } from '@/i18n/useI18n';
import { useTutorialControl } from '@/hooks/useTutorialControl';
import { useTutorialCatalog } from '../application/use-tutorial-catalog';

/**
 * Der **dauerhafte** Einstieg in die Führungen — auf jeder Seite, in der
 * Kopfzeile.
 *
 * Vorher gab es genau einen Weg hinein: den Einladungsstreifen, und der
 * erscheint nur, solange ein Kapitel offen ist, und verschwindet endgültig,
 * sobald man ihn einmal weggeklickt hat. Wer die Erklärung zu *dieser* Seite
 * später noch einmal wollte, hatte keinen Weg mehr dorthin. Ein Angebot, das
 * man nur einmal annehmen kann, ist kein Angebot.
 *
 * Zwei Ziele, weil es zwei Fragen gibt: „Was ist **hier**?" (die häufigere)
 * und „Was gibt es **überhaupt**?".
 */
export default function TutorialLauncher({ className }: { className?: string }) {
  const { t } = useI18n();
  const location = useLocation();
  const { start } = useTutorialControl();
  const { chapterForRoute, sectionForRoute } = useTutorialCatalog();

  const [open, setOpen] = useState(false);

  const chapter = chapterForRoute(location.pathname);
  const section = sectionForRoute(location.pathname);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className={className} aria-label={t('tutorials.launcherLabel')}>
          <GraduationCap className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        <p className="px-2 pb-1 pt-1 text-xs font-medium text-muted-foreground">
          {t('tutorials.launcherLabel')}
        </p>

        {chapter ? (
          <Button
            variant="ghost"
            className="h-auto w-full justify-start gap-2 whitespace-normal px-2 py-2 text-left text-sm"
            // Erst schließen, dann starten: Sonst stünde das Popup über der
            // Fläche, auf die die Führung gerade zeigt.
            onClick={() => {
              setOpen(false);
              start(chapter);
            }}
          >
            <Play className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block font-medium">{t('tutorials.explainThisPage')}</span>
              {section && (
                <span className="block text-xs text-muted-foreground">
                  {t('tutorials.sectionProgress')
                    .replace('{done}', String(section.doneCount))
                    .replace('{total}', String(section.total))}
                </span>
              )}
            </span>
          </Button>
        ) : (
          // Kein Kapitel für diese Fläche: Das wird gesagt, nicht durch einen
          // toten Knopf angedeutet.
          <p className="px-2 py-2 text-sm text-muted-foreground">{t('tutorials.noneHere')}</p>
        )}

        <Button
          asChild
          variant="ghost"
          className="h-auto w-full justify-start gap-2 px-2 py-2 text-left text-sm"
        >
          <Link to="/tutorials">
            <ListChecks className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="font-medium">{t('tutorials.allTutorials')}</span>
          </Link>
        </Button>
      </PopoverContent>
    </Popover>
  );
}
