import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import type { Budget, HierarchicalCategory, RolloverMode, SurplusAction } from "@/types";
import { DEFAULT_WARN_THRESHOLD } from "@/lib/budget-logic";

const ROLLOVER_LABELS: Record<RolloverMode, string> = {
  off: "Aus – jeder Monat startet frisch",
  accumulate: "Ansparen – Rest wandert mit (Limit +x)",
  overspend: "Überzug – Überschreitung abziehen (Start −x)",
  both: "Beides – Rest und Überzug übertragen",
};

const SURPLUS_LABELS: Record<SurplusAction, string> = {
  carry: "Im Tank ansparen",
  sweep_savings: "Aufs Tagesgeld legen (Vorschlag)",
  sweep_invest: "In ETF investieren (Vorschlag)",
};

interface BudgetFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget: Budget | null;
  /** Hauptkategorien (mit children) zur Auswahl. */
  categories: HierarchicalCategory[];
  onSave: (data: Partial<Budget>) => void;
  isLoading?: boolean;
}

export default function BudgetFormDialog({
  open,
  onOpenChange,
  budget,
  categories,
  onSave,
  isLoading,
}: BudgetFormDialogProps) {
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subIds, setSubIds] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState<number>(0);
  const [warnThreshold, setWarnThreshold] = useState<number>(DEFAULT_WARN_THRESHOLD);
  const [rolloverMode, setRolloverMode] = useState<RolloverMode>("off");
  const [cap, setCap] = useState<number>(0);
  const [surplusAction, setSurplusAction] = useState<SurplusAction>("carry");
  const [adaptive, setAdaptive] = useState<boolean>(false);

  // Formular bei jedem Öffnen aus dem (evtl. zu bearbeitenden) Budget befüllen.
  useEffect(() => {
    if (!open) return;
    setName(budget?.name ?? "");
    setCategoryId(budget?.category_id ?? "");
    setSubIds(new Set(budget?.subcategory_ids ?? []));
    setLimit(budget?.limit ?? 0);
    setWarnThreshold(budget?.warn_threshold ?? DEFAULT_WARN_THRESHOLD);
    // Migration: altes boolean `rollover:true` entspricht „Ansparen".
    setRolloverMode(budget?.rolloverConfig?.mode ?? (budget?.rollover ? "accumulate" : "off"));
    setCap(budget?.rolloverConfig?.cap ?? 0);
    setSurplusAction(budget?.rolloverConfig?.surplusAction ?? "carry");
    setAdaptive(budget?.adaptive ?? false);
  }, [open, budget]);

  // „Ansparen"-Optionen (Cap, Überschuss-Verbleib) ergeben nur bei positivem Übertrag Sinn.
  const showSurplusOptions = rolloverMode === "accumulate" || rolloverMode === "both";

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId),
    [categories, categoryId],
  );
  const subcategories = selectedCategory?.children ?? [];

  const handleCategoryChange = (id: string) => {
    setCategoryId(id);
    setSubIds(new Set()); // Auswahl zurücksetzen – Unterkategorien gehören zur neuen Kategorie
    if (!name.trim()) {
      const cat = categories.find((c) => c.id === id);
      if (cat) setName(cat.name);
    }
  };

  const toggleSub = (id: string) => {
    setSubIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const canSave = categoryId && limit > 0 && name.trim().length > 0;

  const handleSubmit = () => {
    if (!canSave) return;
    onSave({
      id: budget?.id,
      name: name.trim(),
      category_id: categoryId,
      subcategory_ids: subIds.size > 0 ? Array.from(subIds) : undefined,
      limit,
      warn_threshold: warnThreshold,
      color: selectedCategory?.color,
      icon: selectedCategory?.icon,
      period: "monthly",
      adaptive,
      rolloverConfig:
        rolloverMode === "off"
          ? undefined
          : {
              mode: rolloverMode,
              cap: showSurplusOptions && cap > 0 ? cap : undefined,
              surplusAction: showSurplusOptions ? surplusAction : undefined,
            },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{budget ? "Budget bearbeiten" : "Budget hinzufügen"}</DialogTitle>
          <DialogDescription>
            Lege ein Monatslimit für eine Kategorie fest. Der Tank füllt sich mit deinen Ausgaben.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="budget-category">Kategorie</Label>
            <Select value={categoryId} onValueChange={handleCategoryChange}>
              <SelectTrigger id="budget-category">
                <SelectValue placeholder="Hauptkategorie wählen" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.icon ? `${cat.icon} ` : ""}
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {subcategories.length > 0 && (
            <div className="space-y-2">
              <Label>Unterkategorien (optional)</Label>
              <p className="text-xs text-muted-foreground">
                Leer lassen = alle Unterkategorien zählen. Auswahl = nur diese.
              </p>
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border p-3">
                {subcategories.map((sub) => (
                  <label key={sub.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={subIds.has(sub.id)}
                      onCheckedChange={() => toggleSub(sub.id)}
                    />
                    <span>
                      {sub.icon ? `${sub.icon} ` : ""}
                      {sub.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="budget-name">Name</Label>
            <Input
              id="budget-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z. B. Lebensmittel"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="budget-limit">{adaptive ? "Basislimit / Fallback (€)" : "Monatslimit (€)"}</Label>
              <Input
                id="budget-limit"
                type="number"
                min={0}
                value={limit || ""}
                onChange={(e) => setLimit(Number(e.target.value))}
                placeholder="z. B. 400"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="budget-warn">Warnschwelle (%)</Label>
              <Input
                id="budget-warn"
                type="number"
                min={1}
                max={100}
                value={warnThreshold || ""}
                onChange={(e) => setWarnThreshold(Number(e.target.value))}
                placeholder="80"
              />
            </div>
          </div>

          {/* Adaptives Limit: speist sich aus echten Ausgaben (Median der letzten Monate). */}
          <label className="flex items-start gap-2 rounded-lg border bg-muted/20 p-3 text-sm">
            <Checkbox
              checked={adaptive}
              onCheckedChange={(v) => setAdaptive(v === true)}
              aria-label="Limit automatisch aus echten Daten"
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">Limit automatisch aus echten Daten</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Adaptiver Tank: das Limit folgt dem Median deiner letzten Monate (ausreißerfest). Dein
                Wert oben gilt als Startwert, bis genug Historie da ist.
              </span>
            </span>
          </label>

          {/* Rollover: Übertrag zwischen Monaten (Ansparen / Überzug / beides). */}
          <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-brand" />
              Übertrag in den nächsten Monat
            </div>
            <Select value={rolloverMode} onValueChange={(v) => setRolloverMode(v as RolloverMode)}>
              <SelectTrigger aria-label="Übertrags-Modus">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ROLLOVER_LABELS) as RolloverMode[]).map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {ROLLOVER_LABELS[mode]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {showSurplusOptions && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <Label htmlFor="budget-cap" className="text-xs">
                    Max. Übertrag (€, 0 = unbegrenzt)
                  </Label>
                  <Input
                    id="budget-cap"
                    type="number"
                    min={0}
                    value={cap || ""}
                    onChange={(e) => setCap(Number(e.target.value))}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="budget-surplus" className="text-xs">
                    Überschuss am Monatsende
                  </Label>
                  <Select value={surplusAction} onValueChange={(v) => setSurplusAction(v as SurplusAction)}>
                    <SelectTrigger id="budget-surplus" aria-label="Verbleib des Überschusses">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(SURPLUS_LABELS) as SurplusAction[]).map((action) => (
                        <SelectItem key={action} value={action}>
                          {SURPLUS_LABELS[action]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={!canSave || isLoading}>
            {budget ? "Speichern" : "Budget anlegen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
