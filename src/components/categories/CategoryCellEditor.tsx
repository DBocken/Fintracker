import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { CategoryTwoStepSelect } from '@/components/categories/CategoryTwoStepSelect';
import { useI18n } from '@/i18n/useI18n';
import type { Category } from '@/types';

interface CategoryCellEditorProps {
  categories: Category[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function CategoryCellEditor({ categories, value, onChange, disabled, className }: CategoryCellEditorProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  const current = categories.find((c) => c.id === value);

  const handleOpenChange = (next: boolean) => {
    if (next) setDraft(value);
    setOpen(next);
  };

  const handleApply = () => {
    onChange(draft);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        className={`max-w-full justify-start truncate ${className || ''}`.trim()}
        onClick={() => handleOpenChange(true)}
      >
        {current ? (
          <span className="truncate">{current.icon ? `${current.icon} ` : ''}{current.name}</span>
        ) : (
          <span className="text-muted-foreground">{t('categories.selectLabel')}</span>
        )}
      </Button>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('categories.dialogTitle')}</DialogTitle>
        </DialogHeader>
        <CategoryTwoStepSelect categories={categories} value={draft} onChange={setDraft} />
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">{t('forms.cancelButton')}</Button>
          </DialogClose>
          <Button type="button" onClick={handleApply}>{t('common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
