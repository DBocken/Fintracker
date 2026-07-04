import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useI18n } from '@/i18n/useI18n';

interface DeleteConfirmationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  transactionId?: string | null;
  selectedCount: number;
  onConfirm: () => void;
}

export function DeleteConfirmationDialog({
  isOpen,
  onOpenChange,
  transactionId,
  selectedCount,
  onConfirm
}: DeleteConfirmationDialogProps) {
  const { t } = useI18n();

  const message = transactionId
    ? t('dashboard.deleteOneConfirmMsg').replace('{id}', transactionId)
    : t('dashboard.deleteMultipleConfirmMsg').replace('{count}', String(selectedCount));

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="card-premium">
        <AlertDialogHeader>
          <AlertDialogTitle>{t('dashboard.deleteConfirmTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {message}
            {'\n'}{t('dashboard.cannotUndo')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-warning hover:bg-warning">
            {t('dashboard.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}