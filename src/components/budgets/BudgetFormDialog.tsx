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
import { Trash2, Plus } from "lucide-react";
import type {
  Account,
  Budget,
  BudgetRule,
  HierarchicalCategory,
  RolloverMode,
  SurplusAction,
} from "@/types";
import { DEFAULT_WARN_THRESHOLD } from "@/lib/budget-logic";
import { FeatureGate } from "@/components/FeatureGate";

const RULE_FIELD_LABELS: Record<BudgetRule["field"], string> = {
  payee: "Empfänger",
  description: "Verwendungszweck",
  amount: "Betrag",
  account: "Konto",
};

const RULE_OP_LABELS: Record<BudgetRule["op"], string> = {
  contains: "enthält",
  equals: "ist gleich",
  gt: "größer als",
  lt: "kleiner als",
};

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
  /** Konten für die Sweep-Zielauswahl (Tagesgeld). */
  accounts?: Account[];
  onSave: (data: Partial<Budget>) => void;
  isLoading?: boolean;
}

export default function BudgetFormDialog({
  open,
  onOpenChange,
  budget,
  categories,
  accounts = [],
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
  const [sweepTargetAccountId, setSweepTargetAccountId] = useState<string>("");
  const [adaptive, setAdaptive] = useState<boolean>(false);
  const [rules, setRules] = useState<BudgetRule[]>([]);

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
    setSweepTargetAccountId(budget?.rolloverConfig?.sweepTargetAccountId ?? "");
    setAdaptive(budget?.adaptive ?? false);
    setRules(budget?.rules ?? []);
  }, [open, budget]);

  // „Ansparen"-Optionen (Cap, Überschuss-Verbleib) ergeben nur bei positivem Übertrag Sinn.
  const showSurplusOptions = rolloverMode === "accumulate" || rolloverMode === "both";
  // Zielkonto nur bei „aufs Tagesgeld" relevant; Konten mit IBAN bevorzugt.
  const sweepAccounts = accounts.filter((a) => a.iban);

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
      rules: rules.filter((r) => r.value.trim().length > 0).length
        ? rules.filter((r) => r.value.trim().length > 0)
        : undefined,
      rolloverConfig:
        rolloverMode === "off"
          ? undefined
          : {
              mode: rolloverMode,
              cap: showSurplusOptions && cap > 0 ? cap : undefined,
              surplusAction: showSurplusOptions ? surplusAction : undefined,
              sweepTargetAccountId:
                showSurplusOptions && surplusAction === "sweep_savings" && sweepTargetAccountId
                  ? sweepTargetAccountId
                  : undefined,
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

          {/* Premium-Budget (#133): adaptives Limit, Regeln & Rollover hinter FeatureGate. */}
          <FeatureGate
            feature="budgetPremium"
            fallback={
              <div className="flex items-center gap-2 rounded-lg border border-premium/40 bg-premium/5 p-3 text-xs text-muted-foreground">
                <Sparkles className="h-4 w-4 shrink-0 text-premium" aria-hidden="true" />
                Adaptives Limit, eigene Match-Regeln und Übertrag zwischen Perioden sind Premium.
              </div>
            }
          >
          <div className="space-y-4">
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

            {showSurplusOptions && surplusAction === "sweep_savings" && (
              <div className="space-y-1.5 pt-1">
                <Label htmlFor="budget-sweep-account" className="text-xs">
                  Tagesgeld-Zielkonto (für GiroCode)
                </Label>
                <Select value={sweepTargetAccountId} onValueChange={setSweepTargetAccountId}>
                  <SelectTrigger id="budget-sweep-account" aria-label="Tagesgeld-Zielkonto">
                    <SelectValue placeholder={sweepAccounts.length ? "Konto wählen" : "Kein Konto mit IBAN"} />
                  </SelectTrigger>
                  <SelectContent>
                    {sweepAccounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.icon ? `${acc.icon} ` : ""}
                        {acc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Wir erzeugen einen scanbaren GiroCode – keine automatische Überweisung.
                </p>
              </div>
            )}
          </div>

          {/* Match-Regeln (#133): zählt Buchungen zusätzlich zur Kategorie. */}
          <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
            <div className="text-sm font-medium">Eigene Match-Regeln (optional)</div>
            <p className="text-xs text-muted-foreground">
              Ordnet Buchungen zusätzlich zur Kategorie zu, wenn eine Regel passt (z. B. Empfänger enthält „Aldi").
            </p>
            {rules.map((rule, i) => (
              <div key={i} className="flex flex-wrap items-center gap-1.5">
                <Select
                  value={rule.field}
                  onValueChange={(v) =>
                    setRules((rs) => rs.map((r, j) => (j === i ? { ...r, field: v as BudgetRule["field"] } : r)))
                  }
                >
                  <SelectTrigger className="h-8 w-[7.5rem]" aria-label={`Regel ${i + 1} Feld`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(RULE_FIELD_LABELS) as BudgetRule["field"][]).map((f) => (
                      <SelectItem key={f} value={f}>
                        {RULE_FIELD_LABELS[f]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={rule.op}
                  onValueChange={(v) =>
                    setRules((rs) => rs.map((r, j) => (j === i ? { ...r, op: v as BudgetRule["op"] } : r)))
                  }
                >
                  <SelectTrigger className="h-8 w-[6.5rem]" aria-label={`Regel ${i + 1} Operator`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(RULE_OP_LABELS) as BudgetRule["op"][]).map((o) => (
                      <SelectItem key={o} value={o}>
                        {RULE_OP_LABELS[o]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="h-8 min-w-0 flex-1"
                  value={rule.value}
                  onChange={(e) =>
                    setRules((rs) => rs.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))
                  }
                  placeholder="Wert"
                  aria-label={`Regel ${i + 1} Wert`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  aria-label={`Regel ${i + 1} entfernen`}
                  onClick={() => setRules((rs) => rs.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRules((rs) => [...rs, { field: "payee", op: "contains", value: "" }])}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Regel hinzufügen
            </Button>
          </div>
          </div>
          </FeatureGate>
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
