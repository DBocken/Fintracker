import { useMemo, useState } from 'react';
import { Target, Shield, TrendingDown, ChevronDown, ChevronRight, LifeBuoy, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { DecimalInput } from '@/components/common/DecimalInput';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useI18n } from '@/i18n/useI18n';
import type { ForecastInput } from '@/lib/forecast-types';
import type { Prioritaet } from '@/types';
import {
  computePriorityCutPlan,
  type PriorityCutItem,
  type PriorityCutPlan,
} from '@/lib/budget-priority-plan';
import { matchContractDomain, classifyContractPriority } from '@/lib/contract-priority';
import type { BufferShortfall } from '@/lib/liquidity-shortfall';
import { useMoneyFormat } from '@/hooks/useMoneyFormat';

// Note: PRIORITY_LABEL moved to i18n, but keeping fallback for backward compatibility
const getPriorityLabel = (t: (key: string, fallback?: string) => string, priority: Prioritaet): string => {
  const labels: Record<Prioritaet, string> = {
    nice: t("budgetOptimizer.priorityNiceToHave"),
    normal: t("budgetOptimizer.priorityNormal"),
    essential: t("budgetOptimizer.priorityEssential"),
  };
  return labels[priority];
};

const PRIORITY_CLASS: Record<Prioritaet, string> = {
  nice: 'bg-muted text-muted-foreground',
  normal: 'bg-brand/15 text-brand',
  essential: 'bg-positive/15 text-positive',
};

const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

const BUNDLE_DOMAINS = new Set(['Streaming', 'Fitness']);

interface ContractHint {
  domain: string;
  kind: 'bundle' | 'review';
  title: string;
  reason: string;
  monthlySavings: number;
}

/**
 * Vertrags-Hinweise aus den wiederkehrenden Abflüssen.
 *
 * `t` und `mask` kommen als Parameter herein und nicht aus Hooks: Die Funktion
 * liegt im Modulraum. `t` ist dabei kein Beiwerk — die Textbausteine hier
 * standen bis WP-9.5 **hartcodiert auf Deutsch** im Quelltext. Der
 * i18n-Wächter prüft den Diff, und diese Zeilen hatte lange niemand angefasst;
 * sichtbar wurde der Verstoß erst, als der Sanfte Modus die Datei berührte.
 */
function deriveContractHints(
  input: ForecastInput | null,
  t: (key: string) => string,
  mask: (formatted: string) => string,
): ContractHint[] {
  const flows = (input?.recurringFlows ?? []).filter((f) => f.amount < 0);
  const byDomain = new Map<string, typeof flows>();
  for (const f of flows) {
    const domain = matchContractDomain(f.name);
    if (!domain) continue;
    const arr = byDomain.get(domain) ?? [];
    arr.push(f);
    byDomain.set(domain, arr);
  }

  const hints: ContractHint[] = [];
  for (const [domain, items] of byDomain) {
    const sorted = [...items].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
    const total = sorted.reduce((s, f) => s + Math.abs(f.amount), 0);
    if (BUNDLE_DOMAINS.has(domain) && sorted.length >= 2) {
      const cheapest = Math.abs(sorted[sorted.length - 1].amount);
      const savings = Math.round(total - cheapest);
      hints.push({
        domain,
        kind: 'bundle',
        title: t('budgetOptimizer.contractBundleTitle')
          .replace('{count}', String(sorted.length))
          .replace('{domain}', domain),
        reason: t('budgetOptimizer.contractBundleReason')
          .replace(
            '{items}',
            sorted
              .map((f) =>
                t('budgetOptimizer.contractBundleItem')
                  .replace('{name}', f.name)
                  .replace('{amount}', mask(eur.format(Math.abs(f.amount)))),
              )
              .join(', '),
          )
          .replace('{total}', mask(eur.format(total)))
          .replace('{savings}', mask(eur.format(savings))),
        monthlySavings: savings,
      });
    } else if (!BUNDLE_DOMAINS.has(domain) && sorted.length > 0) {
      const top = sorted[0];
      hints.push({
        domain,
        kind: 'review',
        title: t('budgetOptimizer.contractReviewTitle').replace('{name}', top.name),
        reason: t('budgetOptimizer.contractReviewReason')
          .replace('{monthly}', mask(eur.format(Math.abs(top.amount))))
          .replace('{yearly}', mask(eur.format(Math.abs(top.amount) * 12))),
        monthlySavings: 0,
      });
    }
  }
  return hints.sort((a, b) => b.monthlySavings - a.monthlySavings);
}

interface Props {
  input: ForecastInput | null;
  /** Priorität je Kategoriename (aus den Kategorie-Attributen). Optional. */
  priorityByCategory?: Map<string, Prioritaet>;
  /** Liquiditäts-Fehlbetrag aus dem Forecast — treibt den „Liquidität sichern"-Modus. */
  bufferShortfall?: BufferShortfall;
}

export default function BudgetOptimizerPanel({ input, priorityByCategory, bufferShortfall }: Props) {
  const money = useMoneyFormat();
  const { t } = useI18n();
  const [mode, setMode] = useState<'goal' | 'buffer' | 'contracts'>('goal');
  const [goalAmount, setGoalAmount] = useState<number | null>(5000);
  const [goalMonths, setGoalMonths] = useState(12);
  const [showAll, setShowAll] = useState(false);

  const contractHints = useMemo(
    () => deriveContractHints(input, t, money.mask),
    [input, t, money],
  );

  // Spar-Wasserfall-Posten: variable Ausgaben (anteilig kürzbar, Volatilität ×
  // Betrag) plus klar kündbare Abos (Streaming/Fitness, voller Betrag kürzbar,
  // niedrige Priorität → zuerst weg). Komplexe Verträge bleiben außen vor.
  const cutItems = useMemo<PriorityCutItem[]>(() => {
    const variable: PriorityCutItem[] = (input?.variableExpenses ?? [])
      .filter((e) => e.monthlyAmount > 0)
      .map((e) => ({
        category: e.category,
        monthlyAmount: e.monthlyAmount,
        maxCut: Math.round(e.monthlyAmount * (e.volatility ?? 0.3)),
        prioritaet: priorityByCategory?.get(e.category) ?? null,
        kind: 'variable',
      }));

    const contracts: PriorityCutItem[] = (input?.recurringFlows ?? [])
      .filter((f) => f.amount < 0)
      .map((f): PriorityCutItem | null => {
        const prioritaet = classifyContractPriority(f.name);
        if (!prioritaet) return null;
        const monthly = Math.abs(f.amount);
        return { category: f.name, monthlyAmount: monthly, maxCut: monthly, prioritaet, kind: 'contract' };
      })
      .filter((x): x is PriorityCutItem => x !== null);

    return [...variable, ...contracts];
  }, [input, priorityByCategory]);

  const goalMonthly = (goalAmount ?? 0) / Math.max(1, goalMonths);
  // Zielbetrag des Wasserfalls: im Spar-Modus das Sparziel, im Liquiditäts-Modus
  // der aus dem Forecast abgeleitete monatliche Fehlbetrag bis zum Tiefpunkt.
  const targetMonthly = mode === 'buffer' ? bufferShortfall?.monthlyNeeded ?? 0 : goalMonthly;
  const plan = useMemo(
    () => computePriorityCutPlan(cutItems, targetMonthly),
    [cutItems, targetMonthly],
  );
  // Volles Sparpotenzial (ohne Ziel) – für die Machbarkeits-Aussage.
  const maxPossible = useMemo(() => computePriorityCutPlan(cutItems, 0).totalCut, [cutItems]);

  const totalVariable = (input?.variableExpenses ?? []).reduce((s, e) => s + e.monthlyAmount, 0);
  const totalFixed = (input?.recurringFlows ?? [])
    .filter((f) => f.amount < 0)
    .reduce((s, f) => s + Math.abs(f.amount), 0);
  const emergencyTarget = Math.round((totalFixed + totalVariable) * 3);

  const achievable = plan.targetReached;
  const totalCut = plan.totalCut;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-brand" />
              {t("budgetOptimizer.title")}
            </CardTitle>
            <CardDescription className="mt-1">
              {t("budgetOptimizer.subtitle")}
            </CardDescription>
          </div>
          {emergencyTarget > 0 && (
            <Badge variant="outline" className="shrink-0 text-xs">
              {t("budgetOptimizer.emergencyReserve")} {money.mask(eur.format(emergencyTarget))}
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={mode === 'goal' ? 'default' : 'outline'}
            onClick={() => setMode('goal')}
          >
            <Target className="mr-1.5 h-3.5 w-3.5" /> Sparziel
          </Button>
          {bufferShortfall && (
            <Button
              size="sm"
              variant={mode === 'buffer' ? 'default' : 'outline'}
              onClick={() => setMode('buffer')}
            >
              <LifeBuoy className="mr-1.5 h-3.5 w-3.5" /> {t('budgetOptimizer.modeBuffer')}
              {bufferShortfall.breaches && (
                <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-warning" aria-hidden="true" />
              )}
            </Button>
          )}
          <Button
            size="sm"
            variant={mode === 'contracts' ? 'default' : 'outline'}
            onClick={() => setMode('contracts')}
          >
            <TrendingDown className="mr-1.5 h-3.5 w-3.5" />{' '}
            {t('budgetOptimizer.modeContracts').replace('{count}', String(contractHints.length))}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {mode === 'goal' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="goal-amount">{t('budgetOptimizer.goalAmountLabel')}</Label>
                <DecimalInput
                  id="goal-amount"
                  value={goalAmount}
                  onChange={setGoalAmount}
                  placeholder={t('budgetOptimizer.goalAmountPlaceholder')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="goal-months">{t('budgetOptimizer.goalMonthsLabel')}</Label>
                <Input
                  id="goal-months"
                  type="number"
                  min={1}
                  max={60}
                  value={goalMonths || ''}
                  onChange={(e) => setGoalMonths(Number(e.target.value))}
                  placeholder="z.B. 12"
                />
              </div>
            </div>

            {(goalAmount ?? 0) > 0 && goalMonths > 0 && (
              <div className="rounded-lg bg-muted/30 px-4 py-3 text-sm">
                <span className="font-medium">{money.mask(eur.format(goalMonthly))}/Monat</span>
                <span className="ml-2 text-muted-foreground">
                  {t('budgetOptimizer.perMonthNeeded')} ·{' '}
                  {achievable
                    ? t('budgetOptimizer.achievableBy').replace('{amount}', money.mask(eur.format(totalCut)))
                    : t('budgetOptimizer.maxByData').replace(
                        '{amount}',
                        money.mask(eur.format(Math.round(maxPossible))),
                      )}
                </span>
              </div>
            )}

            {!achievable && (goalAmount ?? 0) > 0 && (
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertTitle>{t('budgetOptimizer.goalExceedsVariableTitle')}</AlertTitle>
                <AlertDescription>
                  {t('budgetOptimizer.goalExceedsVariableBody')
                    .replace('{possible}', money.mask(eur.format(Math.round(maxPossible))))
                    .replace('{needed}', money.mask(eur.format(Math.round(goalMonthly))))}
                </AlertDescription>
              </Alert>
            )}

            <WaterfallResult
              plan={plan}
              showAll={showAll}
              onToggleShowAll={() => setShowAll((v) => !v)}
            />
          </>
        )}

        {mode === 'buffer' && bufferShortfall && (
          <>
            {!bufferShortfall.breaches ? (
              <div className="flex items-start gap-2 rounded-lg bg-positive/10 px-4 py-3 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-positive" aria-hidden="true" />
                <span>
                  {t('budgetOptimizer.bufferHoldsDescription')}
                </span>
              </div>
            ) : (
              <>
                <div className="rounded-lg bg-muted/30 px-4 py-3 text-sm">
                  <span className="font-medium">~{money.mask(eur.format(bufferShortfall.monthlyNeeded))}/Monat</span>
                  <span className="ml-2 text-muted-foreground">
                    freimachen, um über dem Puffer zu bleiben (Fehlbetrag{' '}
                    {money.mask(eur.format(bufferShortfall.deficit))} bis zum Tiefpunkt in{' '}
                    {bufferShortfall.monthsUntilTrough}{' '}
                    {bufferShortfall.monthsUntilTrough === 1 ? 'Monat' : 'Monaten'})
                  </span>
                </div>
                {!achievable && (
                  <Alert>
                    <Shield className="h-4 w-4" />
                    <AlertTitle>{t('budgetOptimizer.savingNotEnoughTitle')}</AlertTitle>
                    <AlertDescription>
                      Mit Kürzungen lassen sich realistisch ca. {money.mask(eur.format(Math.round(maxPossible)))}/Mo.
                      freimachen – nötig sind {money.mask(eur.format(bufferShortfall.monthlyNeeded))}/Mo. Prüfe
                      zusätzlich Verträge oder ein extra Einkommen.
                    </AlertDescription>
                  </Alert>
                )}
                <WaterfallResult
                  plan={plan}
                  showAll={showAll}
                  onToggleShowAll={() => setShowAll((v) => !v)}
                />
              </>
            )}
          </>
        )}

        {mode === 'contracts' && (
          <div className="space-y-3">
            {contractHints.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine offensichtlichen Vertrags-Hebel in deinen Fixkosten erkannt. Verträge haben feste
                Preise – sie lassen sich nur kündigen, wechseln oder bündeln.
              </p>
            ) : (
              <div className="divide-y divide-border/60">
                {contractHints.map((hint, i) => (
                <div key={i} className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{hint.title}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{hint.reason}</div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant={hint.kind === 'bundle' ? 'secondary' : 'outline'}>
                        {hint.kind === 'bundle' ? 'Bündeln' : 'Prüfen'}
                      </Badge>
                      {hint.monthlySavings > 0 && (
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          bis {money.mask(eur.format(hint.monthlySavings))}/Mo.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                ))}
              </div>
            )}

            {emergencyTarget > 0 && (
              <div className="rounded-xl bg-muted/30 p-4">
                <div className="flex items-center gap-2 font-medium">
                  <Shield className="h-4 w-4 text-brand" />
                  {t('budgetOptimizer.emergencyReserveLabel')}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Empfehlung: ca. {money.mask(eur.format(emergencyTarget))} (3 Monate Fixkosten + variable Ausgaben)
                  als Reserve halten, bevor du Schulden tilgst oder investierst.
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Geteilte Ergebnisliste des Spar-Wasserfalls (Spar- und Liquiditäts-Modus):
 * Posten nach Priorität sortiert (niedrig zuerst), mit „kürzen"/„kündigen"-
 * Beschriftung und Hinweis auf geschützte essenzielle Kategorien.
 */
function WaterfallResult({
  plan,
  showAll,
  onToggleShowAll,
}: {
  plan: PriorityCutPlan;
  showAll: boolean;
  onToggleShowAll: () => void;
}) {
  const money = useMoneyFormat();
  const { t } = useI18n();
  const suggestions = plan.suggestions;
  if (suggestions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('budgetOptimizer.noCutsDetected')}
      </p>
    );
  }
  const visible = showAll ? suggestions : suggestions.slice(0, 5);
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t('budgetOptimizer.whereToSaveFirst')}
      </div>
      <div className="divide-y divide-border/60">
        {visible.map((s) => (
          <div key={s.category} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-medium">{s.category}</span>
                <span
                  className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${PRIORITY_CLASS[s.prioritaet]}`}
                >
                  {getPriorityLabel(t, s.prioritaet)}
                </span>
                {s.kind === 'contract' && (
                  <span className="shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {t('budgetOptimizer.contractBadge')}
                  </span>
                )}
                <span className="shrink-0 text-xs text-muted-foreground">
                  {money.mask(eur.format(s.monthlyAmount))}/Mo.
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-brand/60 transition-all"
                  style={{ width: `${Math.round((s.newBudget / s.monthlyAmount) * 100)}%` }}
                />
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                −{money.mask(eur.format(s.suggestedCut))}/Mo.
              </div>
              <div className="text-xs text-muted-foreground">
                {s.kind === 'contract' && s.newBudget === 0 ? 'kündigen' : `→ ${money.mask(eur.format(s.newBudget))}`}
              </div>
            </div>
          </div>
        ))}
      </div>
      {suggestions.length > 5 && (
        <Button variant="ghost" size="sm" className="w-full" onClick={onToggleShowAll}>
          {showAll ? (
            <>
              <ChevronDown className="mr-1.5 h-3.5 w-3.5" /> Weniger anzeigen
            </>
          ) : (
            <>
              <ChevronRight className="mr-1.5 h-3.5 w-3.5" /> Alle {suggestions.length} Posten zeigen
            </>
          )}
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        Zuerst wird Nice-to-have gekürzt, dann Normales – inkl. kündbarer Abos (Streaming/Fitness);
        pro Kategorie nur im realistischen Rahmen. Die Priorität legst du je Kategorie in den
        Einstellungen fest.
      </p>
      {plan.protectedCategories.length > 0 && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-positive" aria-hidden="true" />
          <span>
            Essenziell geschützt (nicht gekürzt): {plan.protectedCategories.slice(0, 6).join(', ')}
            {plan.protectedCategories.length > 6 ? ' …' : ''}
          </span>
        </p>
      )}
    </div>
  );
}
