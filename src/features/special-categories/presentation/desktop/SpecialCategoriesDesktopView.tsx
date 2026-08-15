import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/useI18n';
import { cn } from '@/lib/utils';
import type { SpecialCategoriesViewProps } from '../special-categories-view-props';
import { SpecialCategoryTree } from '../shared/SpecialCategoryTree';

/**
 * Desktop-Sicht der Anlass-Übersicht: informationsreich – Titel, Aktion und der
 * gesamte Anlass-Baum mit Direkt- und Teilbaum-Summen gleichzeitig sichtbar.
 */
export function SpecialCategoriesDesktopView({ model, className, onCreate, onDelete, onAssign }: SpecialCategoriesViewProps) {
  const { t } = useI18n();

  return (
    <section className={cn('space-y-6', className)} aria-labelledby="special-categories-heading">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 id="special-categories-heading" className="text-2xl font-semibold">
            {t('specialCategories.title')}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t('specialCategories.subtitle')}</p>
        </div>
        {onCreate ? (
          <Button data-tour-id="occasions-create" onClick={onCreate}>
            <Plus className="mr-1 h-4 w-4" aria-hidden />
            {t('specialCategories.create')}
          </Button>
        ) : null}
      </header>

      {model.isEmpty ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <h2 className="text-lg font-medium">{t('specialCategories.emptyTitle')}</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{t('specialCategories.emptyBody')}</p>
        </div>
      ) : (
        <SpecialCategoryTree
          nodes={model.tree}
          getSuggestions={model.suggestionsFor}
          onAssignSuggested={onAssign}
          onDelete={onDelete}
          variant="desktop"
        />
      )}
    </section>
  );
}

export default SpecialCategoriesDesktopView;
