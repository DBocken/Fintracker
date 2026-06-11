import { Tag, Check, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Category } from '@/types';
import { CategoryTwoStepSelect } from '@/components/categories/CategoryTwoStepSelect';

interface BulkActionsProps {
  selectedCount: number;
  bulkCategory: string;
  onBulkCategoryChange: (value: string) => void;
  onApplyBulk: () => void;
  onClearSelection: () => void;
  onBulkDelete: () => void;
  categories: Category[];
}

export function BulkActions({ 
  selectedCount, 
  bulkCategory, 
  onBulkCategoryChange, 
  onApplyBulk, 
  onClearSelection, 
  onBulkDelete, 
  categories 
}: BulkActionsProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-2 mb-4 p-4 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg border border-border/30 flex-wrap">
      <div className="flex items-center gap-2">
        <Tag className="h-4 w-4 text-primary" />
        <span className="font-medium text-foreground">{selectedCount} ausgewählt</span>
      </div>
      
      <CategoryTwoStepSelect
        categories={categories}
        value={bulkCategory}
        onChange={onBulkCategoryChange}
      />
      
      <Button onClick={onApplyBulk} disabled={!bulkCategory} size="sm" className="btn-premium">
        <Check className="h-4 w-4 mr-1" /> Zuweisen
      </Button>
      
      <Button variant="outline" onClick={onClearSelection} size="sm" className="btn-secondary-premium">
        <X className="h-4 w-4 mr-1" /> Abwählen
      </Button>
      
      <Button variant="destructive" onClick={onBulkDelete} size="sm" className="bg-red-600 hover:bg-red-700">
        <Trash2 className="h-4 w-4 mr-1" /> Löschen
      </Button>
    </div>
  );
}