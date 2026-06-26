import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, ChevronDown, Plus, Edit3, Trash2 } from 'lucide-react';
import type { HierarchicalCategory } from '../../types';

interface CategoryTreeProps {
  categories: HierarchicalCategory[];
  expandedCategories: Set<string>;
  onToggleExpand: (categoryId: string) => void;
  onEdit: (category: HierarchicalCategory) => void;
  onDelete: (category: HierarchicalCategory) => void;
  onAddSubcategory: (parentId: string) => void;
}

function cn(...classes: (string | undefined | null | boolean)[]) {
  return classes.filter(Boolean).join(' ');
}

function getCategoryLevel(category: HierarchicalCategory): number {
  let level = 0;
  let current = category.parent;
  while (current) {
    level++;
    current = current.parent;
  }
  return level;
}

export function CategoryTree({
  categories,
  expandedCategories,
  onToggleExpand,
  onEdit,
  onDelete,
  onAddSubcategory,
}: CategoryTreeProps) {
  const renderCategoryTree = (categories: HierarchicalCategory[]) => {
    return categories.map((category, index) => {
      const level = getCategoryLevel(category);
      const hasChildren = category.children && category.children.length > 0;
      const isExpanded = expandedCategories.has(category.id);

      const isVertrag = category.attributes?.ist_vertrag;
      const isEssential = category.attributes?.essenziell;
      const filterCount = category.filters.length;

      return (
        <div key={`${category.id}-${level}-${index}`}>
          {/* Kompakte Zeile: keine Card-in-Card, max. 2 Statussymbole, Tap öffnet Detail. */}
          <div
            className={cn(
              "flex items-center justify-between gap-2 rounded-md px-2 py-2 hover:bg-accent transition-colors cursor-pointer",
            )}
            style={{ marginLeft: `${level * 20}px` }}
            onClick={() => onEdit(category)}
          >
            <div className="flex min-w-0 items-center gap-2">
              {hasChildren ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleExpand(category.id);
                  }}
                  className="rounded p-1 hover:bg-accent"
                  aria-label={isExpanded ? "Einklappen" : "Ausklappen"}
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              ) : (
                <div className="w-6" />
              )}

              <span className="text-lg">{category.icon}</span>
              <span className="truncate font-medium">{category.name}</span>
              {/* Höchstens zwei Statussymbole, dezent. */}
              {isVertrag && <Badge variant="secondary" className="text-[10px]">Vertrag</Badge>}
              {isEssential && <Badge variant="secondary" className="text-[10px]">Essenziell</Badge>}
              {filterCount > 0 && (
                <span className="shrink-0 text-xs text-muted-foreground">{filterCount} Regeln</span>
              )}
            </div>

            {/* Aktionen immer voll sichtbar – Hover-only funktioniert auf Touch nicht zuverlässig. */}
            <div className="flex shrink-0 items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddSubcategory(category.id);
                }}
                className="h-9 w-9 p-0"
                title="Unterkategorie erstellen"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(category);
                }}
                className="h-9 w-9 p-0"
                title="Bearbeiten"
              >
                <Edit3 className="h-4 w-4" />
              </Button>
              {!category.is_default && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(category);
                  }}
                  className="h-9 w-9 p-0"
                  title="Löschen"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {hasChildren && isExpanded && <div className="mt-0.5">{renderCategoryTree(category.children!)}</div>}
        </div>
      );
    });
  };

  return (
    <div className="max-h-[28rem] divide-y divide-border/60 overflow-y-auto">
      {categories.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Keine Kategorien gefunden.</p>
      ) : (
        renderCategoryTree(categories)
      )}
    </div>
  );
}
