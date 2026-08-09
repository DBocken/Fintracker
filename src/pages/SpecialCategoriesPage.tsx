"use client";

import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useI18n } from '@/i18n/useI18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSpecialCategoriesOverview } from '@/features/special-categories/application/use-special-categories-overview';
import { SpecialCategoriesDesktopView } from '@/features/special-categories/presentation/desktop/SpecialCategoriesDesktopView';
import { SpecialCategoriesMobileStory } from '@/features/special-categories/presentation/mobile/SpecialCategoriesMobileStory';
import FinanceErrorState from '@/features/shared/presentation/FinanceErrorState';

const NO_PARENT = '__none__';

/**
 * Anlass-Übersicht (Sonderkategorien). Premium-Feature: das Gating liegt an der
 * Route (`RouteGuard path="/occasions"` → FeatureGate), damit Free/Anonymous den
 * begehrlichen Locked-Preview sehen (Defense-in-Depth-Invariante, [SECURITY]).
 */
export default function SpecialCategoriesPage() {
  const { t } = useI18n();
  const model = useSpecialCategoriesOverview();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState<string>(NO_PARENT);

  const openCreate = () => {
    setName('');
    setParentId(NO_PARENT);
    setDialogOpen(true);
  };

  const submit = async () => {
    try {
      await model.actions.save({ name, parent_id: parentId === NO_PARENT ? null : parentId });
      setDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('specialCategories.service.nameRequired'));
    }
  };

  const handleDelete = async (id: string) => {
    if (typeof window !== 'undefined' && !window.confirm(t('specialCategories.deleteConfirm'))) return;
    try {
      await model.actions.remove(id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('specialCategories.service.notFound'));
    }
  };

  const handleAssign = async (specialCategoryId: string, transactionId: string) => {
    try {
      await model.actions.assign({ specialCategoryId, transactionId });
      toast.success(t('specialCategories.assigned'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('specialCategories.service.notFound'));
    }
  };

  // Das ViewModel fuehrte `isError` und `refetch` bereits, gelesen hat es
  // niemand: Nach einem Lesefehler sah die Flaeche aus, als haette der Nutzer
  // nie einen Anlass angelegt. Ein Anlass buendelt Ausgaben ueber
  // Kategoriegrenzen hinweg — sein Verschwinden ist keine Kleinigkeit
  // ([REGRESSION] `SpecialCategoriesPage.error-state.test.tsx`, WP-12.1).
  if (model.isError) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <FinanceErrorState variant="data" onRetry={() => model.refetch?.()} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <SpecialCategoriesDesktopView
        className="hidden lg:block"
        model={model}
        onCreate={openCreate}
        onDelete={handleDelete}
        onAssign={handleAssign}
      />
      <SpecialCategoriesMobileStory
        className="lg:hidden"
        model={model}
        onCreate={openCreate}
        onDelete={handleDelete}
        onAssign={handleAssign}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('specialCategories.create')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="special-category-name">{t('specialCategories.namePlaceholder')}</Label>
              <Input
                id="special-category-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('specialCategories.namePlaceholder')}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="special-category-parent">{t('specialCategories.parentLabel')}</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger id="special-category-parent" aria-label={t('specialCategories.parentLabel')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PARENT}>{t('specialCategories.parentNone')}</SelectItem>
                  {model.flat.map((node) => (
                    <SelectItem key={node.id} value={node.id}>
                      {node.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              {t('specialCategories.cancel')}
            </Button>
            <Button onClick={submit} disabled={!name.trim() || model.actions.saving}>
              {t('specialCategories.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
