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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import type { Budget, HierarchicalCategory } from "@/types";
import { DEFAULT_WARN_THRESHOLD } from "@/lib/budget-logic";

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

  // Formular bei jedem Öffnen aus dem (evtl. zu bearbeitenden) Budget befüllen.
  useEffect(() => {
    if (!open) return;
    setName(budget?.name ?? "");
    setCategoryId(budget?.category_id ?? "");
    setSubIds(new Set(budget?.subcategory_ids ?? []));
    setLimit(budget?.limit ?? 0);
    setWarnThreshold(budget?.warn_threshold ?? DEFAULT_WARN_THRESHOLD);
  }, [open, budget]);

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
              <Label htmlFor="budget-limit">Monatslimit (€)</Label>
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

          {/* Premium-Ausblick: Regeln, Rollover & Perioden kommen mit Budget-Premium. */}
          <div className="rounded-lg border border-dashed bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-brand" />
              Erweiterte Regeln
              <Badge variant="outline" className="ml-auto text-[10px]">
                Premium
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Eigene Match-Regeln (Stichwort, Empfänger, Betrag), Übertrag ins nächste Monat und
              wöchentliche/jährliche Perioden folgen mit Budget-Premium.
            </p>
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
