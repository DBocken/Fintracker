import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
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
  onAddSubcategory 
}: CategoryTreeProps) {
  const renderCategoryTree = (categories: HierarchicalCategory[]) => {
    return categories.map((category, index) => {
      const level = getCategoryLevel(category);
      const hasChildren = category.children && category.children.length > 0;
      const isExpanded = expandedCategories.has(category.id);

      const isVertrag = category.attributes?.ist_vertrag;
      const isEssential = category.attributes?.essenziell;

      return (
        <div key={`${category.id}-${level}-${index}`} className="space-y-2">
          <div
            className={cn(
              "group flex items-center justify-between p-3 rounded-lg border hover:bg-accent dark:hover:bg-accent transition-all",
              level > 0 && "ml-6"
            )}
            style={{ marginLeft: `${level * 24}px` }}
            onClick={() => onEdit(category)}
          >
            <div className="flex items-center gap-2">
              {hasChildren && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleExpand(category.id);
                  }}
                  className="p-1 hover:bg-accent rounded"
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              )}
              {!hasChildren && <div className="w-6" />}
              
              <span className="text-xl">{category.icon}</span>
              <span className="font-medium">{category.name}</span>
              {category.is_default && (
                <Badge variant="outline" className="text-xs">Standard</Badge>
              )}
              {isVertrag && (
                <Badge variant="secondary" className="text-xs">Vertrag</Badge>
              )}
              {isEssential && (
                <Badge variant="secondary" className="text-xs">Essenziell</Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {level === 0 ? 'Hauptkategorie' : level === 1 ? 'Unterkategorie' : 'Unter-Unterkategorie'}
              </span>
            </div>
            
            {/* Aktionen immer voll sichtbar – Hover-only funktioniert auf Touch nicht zuverlässig. */}
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddSubcategory(category.id);
                }}
                className="h-7 px-2"
                title="Unterkategorie erstellen"
              >
                <Plus className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(category);
                }}
                className="h-7 px-2"
              >
                <Edit3 className="h-3 w-3" />
              </Button>
              {!category.is_default && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(category);
                  }}
                  className="h-7 px-2"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
          
          <div className="flex flex-wrap gap-1 ml-8" style={{ marginLeft: `${(level + 1) * 24}px` }}>
            {category.filters.map((filter, filterIndex) => (
              <Badge key={`${category.id}-${filter}-${filterIndex}`} variant="secondary" className="text-xs">
                {filter}
              </Badge>
            ))}
          </div>

          {hasChildren && isExpanded && (
            <div className="mt-2">
              {renderCategoryTree(category.children!)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl">Hierarchische Kategorien</CardTitle>
        <CardDescription>
          {categories.length} Hauptkategorie(n) mit Unterkategorien
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {renderCategoryTree(categories)}
        </div>
      </CardContent>
    </Card>
  );
}