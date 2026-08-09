import { FilterX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/i18n/useI18n';
import type { ActiveFilterDescriptor } from '@/features/shared/domain/active-filters';
import type { Account, Category } from '@/types';

type FilteredEmptyStateProps = {
  active: ActiveFilterDescriptor[];
  categories: Category[];
  accounts: Account[];
  onReset: () => void;
};

/**
 * „Kein Treffer" statt „nichts vorhanden" (WP-9.4).
 *
 * Der dritte Fall neben Leerzustand und Fehlerzustand — und der, den beide
 * bisher verschluckt haben. Bisher stand hier „Passe Filter oder Suchbegriff
 * an": richtig, aber unbrauchbar. Der Nutzer kann sieben Dimensionen gesetzt
 * haben und weiß nicht, welche zu eng ist.
 *
 * Deshalb werden die aktiven Filter **benannt und einzeln gezeigt**. Der
 * entscheidende Satz ist aber der Hinweis darunter: „Es gibt Buchungen — nur
 * keine, die zu allen gesetzten Filtern passt." Er trennt diesen Zustand von
 * „du hast noch nichts erfasst", und genau diese Verwechslung ist der Befund.
 */
export default function FilteredEmptyState({
  active,
  categories,
  accounts,
  onReset,
}: FilteredEmptyStateProps) {
  const { t } = useI18n();

  const label = (descriptor: ActiveFilterDescriptor): string => {
    const template = t(`filteredEmptyState.${descriptor.dimension}`);

    // Kategorie und Konto kommen als stabile ID herein (die Domäne kennt keine
    // Anzeigenamen). Fehlt der Datensatz — etwa weil die Kategorie inzwischen
    // gelöscht wurde —, bleibt die ID stehen: besser ein technischer Schlüssel
    // als ein leerer Platzhalter, der aussieht, als greife der Filter nicht.
    if (descriptor.dimension === 'category') {
      const name = categories.find((c) => c.id === descriptor.value)?.name;
      return template.replace('{value}', name ?? descriptor.value);
    }
    if (descriptor.dimension === 'account') {
      const name = accounts.find((a) => a.id === descriptor.value)?.name;
      return template.replace('{value}', name ?? descriptor.value);
    }

    return template.replace('{value}', descriptor.value);
  };

  return (
    <div className="space-y-4 py-8 text-center text-muted-foreground">
      <FilterX className="mx-auto h-8 w-8" aria-hidden="true" />
      <div>
        <div className="font-medium text-foreground">{t('filteredEmptyState.title')}</div>
        <div className="text-sm">{t('filteredEmptyState.hint')}</div>
      </div>

      {active.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <span className="text-xs">{t('filteredEmptyState.activeTitle')}</span>
          {active.map((descriptor) => (
            <Badge
              key={`${descriptor.dimension}:${descriptor.value}`}
              variant="secondary"
              className="text-xs font-normal"
            >
              {label(descriptor)}
            </Badge>
          ))}
        </div>
      )}

      <Button type="button" variant="outline" size="sm" onClick={onReset}>
        {t('filteredEmptyState.resetButton')}
      </Button>
    </div>
  );
}
