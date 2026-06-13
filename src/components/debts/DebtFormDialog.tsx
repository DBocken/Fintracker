import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import type { Debt, DebtPriority, DebtType } from "@/types";
import {
  DEBT_PRIORITY_LABELS,
  DEBT_TYPE_LABELS,
  EXISTENTIAL_PRIORITY_EXPLANATION,
  suggestDebtPriority,
} from "@/services/debt-service";

interface DebtFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debt: Partial<Debt> | null;
  onSave: (data: Partial<Debt>) => void;
  isLoading?: boolean;
}

const emptyForm = {
  name: "",
  type: "credit_card" as DebtType,
  balance: "",
  interest_rate: "",
  min_payment: "",
  due_day: "",
  provider: "",
  is_bnpl: false,
  priority: "normal" as DebtPriority,
};

export function DebtFormDialog({ open, onOpenChange, debt, onSave, isLoading }: DebtFormDialogProps) {
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (debt) {
      setForm({
        name: debt.name ?? "",
        type: debt.type ?? "credit_card",
        balance: String(debt.balance ?? ""),
        interest_rate: String(debt.interest_rate ?? ""),
        min_payment: String(debt.min_payment ?? ""),
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
      name: form.name.trim() || "Neue Schuld",
      type: form.type,
      balance: parseFloat(form.balance) || 0,
      interest_rate: parseFloat(form.interest_rate) || 0,
      min_payment: parseFloat(form.min_payment) || 0,
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
          <DialogTitle>{debt?.id ? "Schuld bearbeiten" : "Neue Schuld"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="debt-name">Bezeichnung</Label>
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
              placeholder="z. B. Visa Kreditkarte"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Art</Label>
            <Select
              value={form.type}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, type: v as DebtType, is_bnpl: v === "bnpl" ? true : f.is_bnpl }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(DEBT_TYPE_LABELS) as DebtType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {DEBT_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="debt-balance">Restschuld (€)</Label>
              <Input
                id="debt-balance"
                type="number"
                inputMode="decimal"
                value={form.balance}
                onChange={(e) => setForm((f) => ({ ...f, balance: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="debt-rate">Zins (% p.a.)</Label>
              <Input
                id="debt-rate"
                type="number"
                inputMode="decimal"
                value={form.interest_rate}
                onChange={(e) => setForm((f) => ({ ...f, interest_rate: e.target.value }))}
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="debt-min">Mindestrate (€)</Label>
              <Input
                id="debt-min"
                type="number"
                inputMode="decimal"
                value={form.min_payment}
                onChange={(e) => setForm((f) => ({ ...f, min_payment: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="debt-due">Fällig am (Tag)</Label>
              <Input
                id="debt-due"
                type="number"
                inputMode="numeric"
                value={form.due_day}
                onChange={(e) => setForm((f) => ({ ...f, due_day: e.target.value }))}
                placeholder="z. B. 15"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Priorität</Label>
            <Select
              value={form.priority}
              onValueChange={(v) => setForm((f) => ({ ...f, priority: v as DebtPriority }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(DEBT_PRIORITY_LABELS) as DebtPriority[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {p === "existenzsichernd" ? "🏠 " : ""}
                    {DEBT_PRIORITY_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{EXISTENTIAL_PRIORITY_EXPLANATION}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="debt-provider">Anbieter (optional)</Label>
            <Input
              id="debt-provider"
              value={form.provider}
              onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
              placeholder="z. B. Klarna, PayPal"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="debt-bnpl">BNPL (Jetzt kaufen, später zahlen)</Label>
              <p className="text-xs text-muted-foreground">Klarna, PayPal Später, RatePay …</p>
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
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {debt?.id ? "Speichern" : "Hinzufügen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
