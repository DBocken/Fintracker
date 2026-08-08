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
import { DecimalInput } from "@/components/common/DecimalInput";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useI18n } from "@/i18n/useI18n";
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
  BudgetPeriod,
  BudgetRule,
  HierarchicalCategory,
  RolloverMode,
  SurplusAction,
} from "@/types";
import { DEFAULT_WARN_THRESHOLD } from "@/lib/budget-logic";
import { FeatureGate } from "@/components/FeatureGate";


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
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subIds, setSubIds] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState<number | null>(null);
  const [warnThreshold, setWarnThreshold] = useState<number | null>(DEFAULT_WARN_THRESHOLD);
  const [rolloverMode, setRolloverMode] = useState<RolloverMode>("off");
  const [cap, setCap] = useState<number | null>(null);
  const [surplusAction, setSurplusAction] = useState<SurplusAction>("carry");
  const [sweepTargetAccountId, setSweepTargetAccountId] = useState<string>("");
  const [adaptive, setAdaptive] = useState<boolean>(false);
  const [rules, setRules] = useState<BudgetRule[]>([]);
  const [period, setPeriod] = useState<BudgetPeriod>("monthly");

  // Build dynamic labels from translations
  const periodLabels: Record<BudgetPeriod, string> = {
    weekly: t('budgets.periods.weekly'),
    monthly: t('budgets.periods.monthly'),
    yearly: t('budgets.periods.yearly'),
  };

  const periodLimitWords: Record<BudgetPeriod, string> = {
    weekly: t('budgets.periodLabels.weekly'),
    monthly: t('budgets.periodLabels.monthly'),
    yearly: t('budgets.periodLabels.yearly'),
  };

  const ruleFieldLabels: Record<BudgetRule["field"], string> = {
    payee: t('budgets.ruleFields.payee'),
    description: t('budgets.ruleFields.description'),
    amount: t('budgets.ruleFields.amount'),
    account: t('budgets.ruleFields.account'),
  };

  const ruleOpLabels: Record<BudgetRule["op"], string> = {
    contains: t('budgets.ruleOperators.contains'),
    equals: t('budgets.ruleOperators.equals'),
    gt: t('budgets.ruleOperators.gt'),
    lt: t('budgets.ruleOperators.lt'),
  };

  const rolloverLabels: Record<RolloverMode, string> = {
    off: t('budgets.rolloverModes.off'),
    accumulate: t('budgets.rolloverModes.accumulate'),
    overspend: t('budgets.rolloverModes.overspend'),
    both: t('budgets.rolloverModes.both'),
  };

  const surplusLabels: Record<SurplusAction, string> = {
    carry: t('budgets.surplusActions.carry'),
    sweep_savings: t('budgets.surplusActions.sweep_savings'),
    sweep_invest: t('budgets.surplusActions.sweep_invest'),
  };

  // Formular bei jedem Öffnen aus dem (evtl. zu bearbeitenden) Budget befüllen.
  useEffect(() => {
    if (!open) return;
    setName(budget?.name ?? "");
    setCategoryId(budget?.category_id ?? "");
    setSubIds(new Set(budget?.subcategory_ids ?? []));
    setLimit(budget?.limit ?? null);
    setWarnThreshold(budget?.warn_threshold ?? DEFAULT_WARN_THRESHOLD);
    // Migration: altes boolean `rollover:true` entspricht „Ansparen".
    setRolloverMode(budget?.rolloverConfig?.mode ?? (budget?.rollover ? "accumulate" : "off"));
    setCap(budget?.rolloverConfig?.cap ?? null);
    setSurplusAction(budget?.rolloverConfig?.surplusAction ?? "carry");
    setSweepTargetAccountId(budget?.rolloverConfig?.sweepTargetAccountId ?? "");
    setAdaptive(budget?.adaptive ?? false);
    setRules(budget?.rules ?? []);
    setPeriod(budget?.period ?? "monthly");
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

  const canSave = categoryId && limit !== null && limit > 0 && name.trim().length > 0;

  const handleSubmit = () => {
    if (!canSave) return;
    onSave({
      id: budget?.id,
      name: name.trim(),
      category_id: categoryId,
      subcategory_ids: subIds.size > 0 ? Array.from(subIds) : undefined,
      // `canSave` schliesst `null` bereits aus; TypeScript sieht das ueber die
      // Closure-Grenze nicht, deshalb der explizite Fallback.
      limit: limit ?? 0,
      warn_threshold: warnThreshold ?? DEFAULT_WARN_THRESHOLD,
      color: selectedCategory?.color,
      icon: selectedCategory?.icon,
      period,
      // Übertrag & adaptives Limit sind monatsbasiert – bei anderen Perioden nicht mitspeichern.
      adaptive: period === "monthly" ? adaptive : false,
      rules: rules.filter((r) => r.value.trim().length > 0).length
        ? rules.filter((r) => r.value.trim().length > 0)
        : undefined,
      rolloverConfig:
        period !== "monthly" || rolloverMode === "off"
          ? undefined
          : {
              mode: rolloverMode,
              cap: showSurplusOptions && cap !== null && cap > 0 ? cap : undefined,
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
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{budget ? t('budgets.formDialog.titleEdit') : t('budgets.formDialog.titleAdd')}</DialogTitle>
          <DialogDescription>
            {t('budgets.formDialog.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="budget-category">{t('budgets.formDialog.categoryLabel')}</Label>
            <Select value={categoryId} onValueChange={handleCategoryChange}>
              <SelectTrigger id="budget-category" aria-label={t('budgets.formDialog.categoryLabel')}>
                <SelectValue placeholder={t('budgets.formDialog.categoryPlaceholder')} />
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
              <Label>{t('budgets.formDialog.subcategoriesLabel')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('budgets.formDialog.subcategoriesHint')}
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
            <Label htmlFor="budget-name">{t('budgets.formDialog.nameLabel')}</Label>
            <Input
              id="budget-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('budgets.formDialog.namePlaceholder')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="budget-limit">
                {adaptive ? t('budgets.formDialog.adaptiveLimitLabel') : `${periodLimitWords[period]} (€)`}
              </Label>
              <DecimalInput
                id="budget-limit"
                value={limit}
                onChange={setLimit}
                placeholder={t('budgets.formDialog.limitPlaceholder')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="budget-warn">{t('budgets.formDialog.warnThresholdLabel')}</Label>
              <DecimalInput
                id="budget-warn"
                value={warnThreshold}
                onChange={setWarnThreshold}
                placeholder={t('budgets.formDialog.warnThresholdPlaceholder')}
              />
            </div>
          </div>

          {/* Premium-Budget (#133): adaptives Limit, Regeln & Rollover hinter FeatureGate. */}
          <FeatureGate
            feature="budgetPremium"
            fallback={
              <div className="flex items-center gap-2 rounded-lg border border-premium/40 bg-premium/5 p-3 text-xs text-muted-foreground">
                <Sparkles className="h-4 w-4 shrink-0 text-premium" aria-hidden="true" />
                {t('budgets.formDialog.premiumFeatureHint')}
              </div>
            }
          >
          <div className="space-y-4">
          {/* Abrechnungsperiode (#133): monatlich (Default), wöchentlich oder jährlich. */}
          <div className="space-y-1.5">
            <Label htmlFor="budget-period">{t('budgets.formDialog.periodLabel')}</Label>
            <Select value={period} onValueChange={(v) => setPeriod(v as BudgetPeriod)}>
              <SelectTrigger id="budget-period" aria-label={t('budgets.formDialog.periodLabel')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(periodLabels) as BudgetPeriod[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {periodLabels[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {period !== "monthly" ? (
            <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
              {t('budgets.formDialog.nonMonthlyHint')}
            </div>
          ) : (
          <>
          {/* Adaptives Limit: speist sich aus echten Ausgaben (Median der letzten Monate). */}
          <label className="flex items-start gap-2 rounded-lg border bg-muted/20 p-3 text-sm">
            <Checkbox
              checked={adaptive}
              onCheckedChange={(v) => setAdaptive(v === true)}
              aria-label={t('budgets.formDialog.adaptiveCheckbox')}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">{t('budgets.formDialog.adaptiveCheckbox')}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {t('budgets.formDialog.adaptiveDescription')}
              </span>
            </span>
          </label>

          {/* Rollover: Übertrag zwischen Monaten (Ansparen / Überzug / beides). */}
          <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-brand" />
              {t('budgets.formDialog.rolloverTitle')}
            </div>
            <Select value={rolloverMode} onValueChange={(v) => setRolloverMode(v as RolloverMode)}>
              <SelectTrigger aria-label={t('budgets.formDialog.rolloverAriaLabel')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(rolloverLabels) as RolloverMode[]).map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {rolloverLabels[mode]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {showSurplusOptions && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <Label htmlFor="budget-cap" className="text-xs">
                    {t('budgets.formDialog.capLabel')}
                  </Label>
                  <DecimalInput
                    id="budget-cap"
                    value={cap}
                    onChange={setCap}
                    placeholder={t('budgets.formDialog.capPlaceholder')}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="budget-surplus" className="text-xs">
                    {t('budgets.formDialog.surplusLabel')}
                  </Label>
                  <Select value={surplusAction} onValueChange={(v) => setSurplusAction(v as SurplusAction)}>
                    <SelectTrigger id="budget-surplus" aria-label={t('budgets.formDialog.surplusAriaLabel')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(surplusLabels) as SurplusAction[]).map((action) => (
                        <SelectItem key={action} value={action}>
                          {surplusLabels[action]}
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
                  {t('budgets.formDialog.sweepAccountLabel')}
                </Label>
                <Select value={sweepTargetAccountId} onValueChange={setSweepTargetAccountId}>
                  <SelectTrigger id="budget-sweep-account" aria-label={t('budgets.formDialog.sweepAccountAriaLabel')}>
                    <SelectValue placeholder={sweepAccounts.length ? t('budgets.formDialog.sweepAccountPlaceholder') : t('budgets.formDialog.sweepAccountNoneHint')} />
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
                  {t('budgets.formDialog.sweepAccountInfo')}
                </p>
              </div>
            )}
          </div>
          </>
          )}

          {/* Match-Regeln (#133): zählt Buchungen zusätzlich zur Kategorie. */}
          <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
            <div className="text-sm font-medium">{t('budgets.formDialog.rulesLabel')}</div>
            <p className="text-xs text-muted-foreground">
              {t('budgets.formDialog.rulesDescription')}
            </p>
            {rules.map((rule, i) => (
              <div key={i} className="flex flex-wrap items-center gap-1.5">
                <Select
                  value={rule.field}
                  onValueChange={(v) =>
                    setRules((rs) => rs.map((r, j) => (j === i ? { ...r, field: v as BudgetRule["field"] } : r)))
                  }
                >
                  <SelectTrigger className="h-8 w-[7.5rem]" aria-label={t('budgets.formDialog.ruleFieldAriaLabel').replace('{index}', String(i + 1))}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ruleFieldLabels) as BudgetRule["field"][]).map((f) => (
                      <SelectItem key={f} value={f}>
                        {ruleFieldLabels[f]}
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
                  <SelectTrigger className="h-8 w-[6.5rem]" aria-label={t('budgets.formDialog.ruleOperatorAriaLabel').replace('{index}', String(i + 1))}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ruleOpLabels) as BudgetRule["op"][]).map((o) => (
                      <SelectItem key={o} value={o}>
                        {ruleOpLabels[o]}
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
                  placeholder={t('budgets.formDialog.rulePlaceholder')}
                  aria-label={t('budgets.formDialog.ruleValueAriaLabel').replace('{index}', String(i + 1))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  aria-label={t('budgets.formDialog.ruleRemoveAriaLabel').replace('{index}', String(i + 1))}
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
              <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> {t('budgets.formDialog.ruleAddButton')}
            </Button>
          </div>
          </div>
          </FeatureGate>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('budgets.formDialog.cancelButton')}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSave || isLoading}>
            {budget ? t('budgets.formDialog.saveButton') : t('budgets.formDialog.addButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
