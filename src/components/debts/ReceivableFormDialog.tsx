import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/features/shared/presentation/DecimalInput";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Receivable, ReceivableType } from "@/types";
import { getReceivableTypeLabels } from "@/services/receivable-service";
import { useI18n } from "@/i18n/useI18n";

interface ReceivableFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receivable: Partial<Receivable> | null;
  onSave: (data: Partial<Receivable>) => void;
  isLoading?: boolean;
}

const emptyForm = {
  name: "",
  debtor: "",
  type: "private_loan" as ReceivableType,
  amount: null as number | null,
  due_date: "",
  is_cash: false,
  notes: "",
};

export function ReceivableFormDialog({
  open,
  onOpenChange,
  receivable,
  onSave,
  isLoading,
}: ReceivableFormDialogProps) {
  const { t } = useI18n();
  const receivableTypeLabels = getReceivableTypeLabels();
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (receivable) {
      setForm({
        name: receivable.name ?? "",
        debtor: receivable.debtor ?? "",
        type: receivable.type ?? "private_loan",
        amount: receivable.amount ?? null,
        due_date: receivable.due_date ?? "",
        is_cash: receivable.is_cash ?? false,
        notes: receivable.notes ?? "",
      });
    } else {
      setForm(emptyForm);
    }
  }, [receivable, open]);

  const handleSubmit = () => {
    onSave({
      name: form.name.trim() || t('debtService.defaultReceivableName'),
      debtor: form.debtor.trim() || null,
      type: form.type,
      amount: form.amount ?? 0,
      due_date: form.due_date || null,
      is_cash: form.is_cash,
      notes: form.notes.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{receivable?.id ? t('debts.receivableForm.editTitle') : t('debts.receivableForm.newTitle')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rec-name">{t('debts.receivableForm.nameLabel')}</Label>
            <Input
              id="rec-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t('debts.receivableForm.namePlaceholder')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rec-debtor">{t('debts.receivableForm.debtorLabel')}</Label>
            <Input
              id="rec-debtor"
              value={form.debtor}
              onChange={(e) => setForm((f) => ({ ...f, debtor: e.target.value }))}
              placeholder={t('debts.receivableForm.debtorPlaceholder')}
            />
            <p className="text-xs text-muted-foreground">
              {t('debts.receivableForm.debtorHint')}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>{t('debts.receivableForm.typeLabel')}</Label>
            <Select
              value={form.type}
              onValueChange={(v) => setForm((f) => ({ ...f, type: v as ReceivableType }))}
            >
              <SelectTrigger aria-label={t('debts.receivableForm.typeLabel')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(receivableTypeLabels) as ReceivableType[]).map((receivableType) => (
                  <SelectItem key={receivableType} value={receivableType}>
                    {receivableTypeLabels[receivableType]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rec-amount">{t('debts.receivableForm.amountLabel')}</Label>
              <DecimalInput
                id="rec-amount"
                value={form.amount}
                onChange={(value) => setForm((f) => ({ ...f, amount: value }))}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rec-due">{t('debts.receivableForm.dueLabel')}</Label>
              <Input
                id="rec-due"
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rec-notes">{t('debts.receivableForm.notesLabel')}</Label>
            <Input
              id="rec-notes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder={t('debts.receivableForm.notesPlaceholder')}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="rec-cash">{t('debts.receivableForm.cashLabel')}</Label>
              <p className="text-xs text-muted-foreground">{t('debts.receivableForm.cashHint')}</p>
            </div>
            <Switch
              id="rec-cash"
              checked={form.is_cash}
              onCheckedChange={(c) => setForm((f) => ({ ...f, is_cash: c }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {receivable?.id ? t('common.save') : t('debts.receivableForm.addButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
