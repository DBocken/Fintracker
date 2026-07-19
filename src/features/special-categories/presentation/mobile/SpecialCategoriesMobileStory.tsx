import { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/useI18n';
import { cn } from '@/lib/utils';
import type { SpecialCategoriesViewProps } from '../special-categories-view-props';
import { SpecialCategoryTree } from '../shared/SpecialCategoryTree';

/**
 * Mobile-Sicht: fokussierte Story – eine Hauptaussage pro Karte (Gesamtsumme
 * inkl. Unter-Anlässe), Details per progressiver Offenlegung (Auf-/Zuklappen).
 * Gleiches ViewModel wie Desktop (Feature-Parität).
 */
export function SpecialCategoriesMobileStory({ model, className, onCreate, onDelete }: SpecialCategoriesViewProps) {
  const { t } = useI18n();

  const suggestionCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const node of model.flat) map.set(node.id, model.suggestionsFor(node.id).length);
    return map;
  }, [model]);

  return (
    <section className={cn('space-y-4', className)} aria-labelledby="special-categories-heading-mobile">
      <header className="space-y-1">
        <h1 id="special-categories-heading-mobile" className="text-xl font-semibold">
          {t('specialCategories.title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('specialCategories.subtitle')}</p>
      </header>

      {model.isEmpty ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <h2 className="text-base font-medium">{t('specialCategories.emptyTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('specialCategories.emptyBody')}</p>
        </div>
      ) : (
        <SpecialCategoryTree
          nodes={model.tree}
          suggestionCounts={suggestionCounts}
          onDelete={onDelete}
          variant="mobile"
        />
      )}

      {onCreate ? (
        <Button onClick={onCreate} className="w-full">
          <Plus className="mr-1 h-4 w-4" aria-hidden />
          {t('specialCategories.create')}
        </Button>
      ) : null}
    </section>
  );
}

export default SpecialCategoriesMobileStory;
