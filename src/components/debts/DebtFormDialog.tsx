import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/common/DecimalInput";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { TypedSelect } from "@/components/common/TypedSelect";
import type { Debt, DebtPriority, DebtType } from "@/types";
import {
  getDebtPriorityLabels,
  getDebtTypeLabels,
  getExistentialPriorityExplanation,
  suggestDebtPriority,
} from "@/services/debt-service";
import { recordToOptions, typedKeys } from "@/lib/typed-record";
import { useI18n } from "@/i18n/useI18n";

interface DebtFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debt: Partial<Debt> | null;
  onSave: (data: Partial<Debt>) => void;
  isLoading?: boolean;
}

/** Form-Zustand von `DebtFormDialog` — als eigener Typ statt Feld-für-Feld-Casts
 * im Objektliteral: `emptyForm` prüft sich damit als Ganzes gegen den Typ,
 * statt fünf einzelne `as DebtType`/`as number | null`-Behauptungen zu brauchen. */
interface DebtFormState {
  name: string;
  type: DebtType;
  balance: number | null;
  interest_rate: number | null;
  min_payment: number | null;
  due_day: string;
  provider: string;
  is_bnpl: boolean;
  priority: DebtPriority;
}

const emptyForm: DebtFormState = {
  name: "",
  type: "credit_card",
  balance: null,
  interest_rate: null,
  min_payment: null,
  due_day: "",
  provider: "",
  is_bnpl: false,
  priority: "normal",
};

export function DebtFormDialog({ open, onOpenChange, debt, onSave, isLoading }: DebtFormDialogProps) {
  const { t } = useI18n();
  const debtTypeLabels = getDebtTypeLabels();
  const debtPriorityLabels = getDebtPriorityLabels();
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (debt) {
      setForm({
        name: debt.name ?? "",
        type: debt.type ?? "credit_card",
        balance: debt.balance ?? null,
        interest_rate: debt.interest_rate ?? null,
        min_payment: debt.min_payment ?? null,
        due_day: debt.due_day != null ? String(debt.due_day) : "",
        provider: debt.provider ?? "",
        is_bnpl: debt.is_bnpl ?? false,
        priority: debt.priority ?? "normal",
      });
    } else {
      setForm(emptyForm);
    }
  }, [debt, open]);

  const handleSubmit = () => {
    onSave({
      name: form.name.trim() || t('debtService.defaultDebtName'),
      type: form.type,
      balance: form.balance ?? 0,
      interest_rate: form.interest_rate ?? 0,
      min_payment: form.min_payment ?? 0,
      due_day: form.due_day ? Math.min(31, Math.max(1, parseInt(form.due_day, 10))) : null,
      provider: form.provider.trim() || null,
      is_bnpl: form.is_bnpl || form.type === "bnpl",
      priority: form.priority,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{debt?.id ? t('debts.debtForm.editTitle') : t('debts.debtForm.newTitle')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="debt-name">{t('debts.debtForm.nameLabel')}</Label>
            <Input
              id="debt-name"
              value={form.name}
              onChange={(e) => {
                const name = e.target.value;
                setForm((f) => ({
                  ...f,
                  name,
                  // Vermieter/Energie/Unterhalt automatisch vorschlagen (#51) — nur solange „normal" steht.
                  priority:
                    f.priority === "normal" && suggestDebtPriority(name) === "existenzsichernd"
                      ? "existenzsichernd"
                      : f.priority,
                }));
              }}
              placeholder={t('debts.debtForm.namePlaceholder')}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t('debts.debtForm.typeLabel')}</Label>
            <TypedSelect
              value={form.type}
              onValueChange={(type) =>
                setForm((f) => ({ ...f, type, is_bnpl: type === "bnpl" ? true : f.is_bnpl }))
              }
              options={recordToOptions(debtTypeLabels)}
              aria-label={t('debts.debtForm.typeLabel')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="debt-balance">{t('debts.debtForm.balanceLabel')}</Label>
              <DecimalInput
                id="debt-balance"
                value={form.balance}
                onChange={(value) => setForm((f) => ({ ...f, balance: value }))}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="debt-rate">{t('debts.debtForm.interestLabel')}</Label>
              <DecimalInput
                id="debt-rate"
                value={form.interest_rate}
                onChange={(value) => setForm((f) => ({ ...f, interest_rate: value }))}
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="debt-min">{t('debts.debtForm.minPaymentLabel')}</Label>
              <DecimalInput
                id="debt-min"
                value={form.min_payment}
                onChange={(value) => setForm((f) => ({ ...f, min_payment: value }))}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="debt-due">{t('debts.debtForm.dueLabel')}</Label>
              <Input
                id="debt-due"
                type="number"
                inputMode="numeric"
                value={form.due_day}
                onChange={(e) => setForm((f) => ({ ...f, due_day: e.target.value }))}
                placeholder={t('debts.debtForm.duePlaceholder')}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t('debts.debtForm.priorityLabel')}</Label>
            <TypedSelect
              value={form.priority}
              onValueChange={(priority) => setForm((f) => ({ ...f, priority }))}
              options={typedKeys(debtPriorityLabels).map((p) => ({
                value: p,
                label: `${p === "existenzsichernd" ? "🏠 " : ""}${debtPriorityLabels[p]}`,
              }))}
              aria-label={t('debts.debtForm.priorityLabel')}
            />
            <p className="text-xs text-muted-foreground">{getExistentialPriorityExplanation()}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="debt-provider">{t('debts.debtForm.providerLabel')}</Label>
            <Input
              id="debt-provider"
              value={form.provider}
              onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
              placeholder={t('debts.debtForm.providerPlaceholder')}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="debt-bnpl">{t('debts.debtForm.bnplLabel')}</Label>
              <p className="text-xs text-muted-foreground">{t('debts.debtForm.bnplHint')}</p>
            </div>
            <Switch
              id="debt-bnpl"
              checked={form.is_bnpl}
              onCheckedChange={(c) => setForm((f) => ({ ...f, is_bnpl: c }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {debt?.id ? t('common.save') : t('debts.debtForm.addButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
