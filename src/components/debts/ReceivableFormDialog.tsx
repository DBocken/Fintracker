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
import type { Receivable, ReceivableType } from "@/types";
import { RECEIVABLE_TYPE_LABELS } from "@/services/receivable-service";

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
  amount: "",
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
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (receivable) {
      setForm({
        name: receivable.name ?? "",
        debtor: receivable.debtor ?? "",
        type: receivable.type ?? "private_loan",
        amount: String(receivable.amount ?? ""),
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
      name: form.name.trim() || "Neue Forderung",
      debtor: form.debtor.trim() || null,
      type: form.type,
      amount: parseFloat(form.amount) || 0,
      due_date: form.due_date || null,
      is_cash: form.is_cash,
      notes: form.notes.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{receivable?.id ? "Forderung bearbeiten" : "Neue Forderung"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rec-name">Bezeichnung</Label>
            <Input
              id="rec-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="z. B. Konzertticket für Max"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rec-debtor">Schuldner (wer schuldet dir?)</Label>
            <Input
              id="rec-debtor"
              value={form.debtor}
              onChange={(e) => setForm((f) => ({ ...f, debtor: e.target.value }))}
              placeholder="z. B. Max Mustermann"
            />
            <p className="text-xs text-muted-foreground">
              Hilft uns, eingehende Rückzahlungen automatisch dieser Forderung zuzuordnen.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Art</Label>
            <Select
              value={form.type}
              onValueChange={(v) => setForm((f) => ({ ...f, type: v as ReceivableType }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(RECEIVABLE_TYPE_LABELS) as ReceivableType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {RECEIVABLE_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rec-amount">Offener Betrag (€)</Label>
              <Input
                id="rec-amount"
                type="number"
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rec-due">Fällig bis (optional)</Label>
              <Input
                id="rec-due"
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rec-notes">Notiz (optional)</Label>
            <Input
              id="rec-notes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="z. B. Rückzahlung in Raten vereinbart"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="rec-cash">Bar verliehen</Label>
              <p className="text-xs text-muted-foreground">Ohne Bankbeleg, in bar übergeben.</p>
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
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {receivable?.id ? "Speichern" : "Hinzufügen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
