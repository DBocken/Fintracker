import { useMemo, useState } from 'react';
import { Target, Shield, TrendingDown, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { ForecastInput } from '@/lib/forecast-types';

const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

const CONTRACT_DOMAINS: { domain: string; keywords: string[] }[] = [
  { domain: 'Streaming', keywords: ['streaming', 'netflix', 'spotify', 'prime', 'disney', 'dazn', 'sky', 'audible', 'youtube', 'wow', 'paramount', 'apple tv', 'crunchyroll', 'deezer'] },
  { domain: 'Fitness', keywords: ['fitness', 'fitnessstudio', 'gym', 'mcfit', 'urban sports', 'clever fit', 'sportstudio', 'mitgliedschaft'] },
  { domain: 'Versicherung', keywords: ['versicherung', 'haftpflicht', 'hausrat', 'krankenkasse', 'kfz', 'rechtsschutz', 'lebensversicherung'] },
  { domain: 'Telekommunikation', keywords: ['mobilfunk', 'internet', 'telekom', 'vodafone', 'o2', 'handy', 'dsl', 'tarif'] },
  { domain: 'Energie', keywords: ['strom', 'gas', 'energie', 'stadtwerke'] },
];

const BUNDLE_DOMAINS = new Set(['Streaming', 'Fitness']);

function matchDomain(name: string): string | null {
  const n = name.toLowerCase();
  for (const d of CONTRACT_DOMAINS) {
    if (d.keywords.some((k) => n.includes(k))) return d.domain;
  }
  return null;
}

interface ContractHint {
  domain: string;
  kind: 'bundle' | 'review';
  title: string;
  reason: string;
  monthlySavings: number;
}

function deriveContractHints(input: ForecastInput | null): ContractHint[] {
  const flows = (input?.recurringFlows ?? []).filter((f) => f.amount < 0);
  const byDomain = new Map<string, typeof flows>();
  for (const f of flows) {
    const domain = matchDomain(f.name);
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
        title: `${sorted.length} ${domain}-Abos`,
        reason: `${sorted.map((f) => `${f.name} (${eur.format(Math.abs(f.amount))}/Mo.)`).join(', ')} – zusammen ${eur.format(total)}/Mo. Auf einen reduzieren spart bis zu ${eur.format(savings)}/Mo.`,
        monthlySavings: savings,
      });
    } else if (!BUNDLE_DOMAINS.has(domain) && sorted.length > 0) {
      const top = sorted[0];
      hints.push({
        domain,
        kind: 'review',
        title: `${top.name} prüfen`,
        reason: `${eur.format(Math.abs(top.amount))}/Mo. (${eur.format(Math.abs(top.amount) * 12)}/Jahr) – ein Anbietervergleich kann die Fixbelastung dauerhaft senken.`,
        monthlySavings: 0,
      });
    }
  }
  return hints.sort((a, b) => b.monthlySavings - a.monthlySavings);
}

interface BudgetSuggestion {
  category: string;
  currentAmount: number;
  suggestedCut: number;
  newBudget: number;
  flexibility: number;
}

function computeGoalPlan(input: ForecastInput | null, goalAmount: number, goalMonths: number): BudgetSuggestion[] {
  const variables = (input?.variableExpenses ?? []).filter((e) => e.monthlyAmount > 0);
  if (!variables.length || goalAmount <= 0 || goalMonths <= 0) return [];

  const monthlyNeeded = goalAmount / goalMonths;
  const enriched = variables.map((e) => ({
    ...e,
    flexibility: e.volatility ?? 0.3,
    maxCut: Math.round(e.monthlyAmount * (e.volatility ?? 0.3)),
  }));
  const totalWeight = enriched.reduce((s, e) => s + e.flexibility, 0) || 1;
  const maxSavings = enriched.reduce((s, e) => s + e.maxCut, 0);
  const scale = Math.min(1, monthlyNeeded / Math.max(maxSavings, 1));

  return enriched
    .map((e) => {
      const share = (monthlyNeeded * e.flexibility) / totalWeight;
      const cut = Math.round(Math.min(share * (scale <= 1 ? 1 : scale), e.maxCut));
      return {
        category: e.category,
        currentAmount: e.monthlyAmount,
        suggestedCut: cut,
        newBudget: Math.max(0, e.monthlyAmount - cut),
        flexibility: e.flexibility,
      };
    })
    .filter((s) => s.suggestedCut > 0)
    .sort((a, b) => b.suggestedCut - a.suggestedCut);
}

interface Props {
  input: ForecastInput | null;
}

export default function BudgetOptimizerPanel({ input }: Props) {
  const [mode, setMode] = useState<'goal' | 'contracts'>('goal');
  const [goalAmount, setGoalAmount] = useState(5000);
  const [goalMonths, setGoalMonths] = useState(12);
  const [showAll, setShowAll] = useState(false);

  const contractHints = useMemo(() => deriveContractHints(input), [input]);
  const suggestions = useMemo(
    () => computeGoalPlan(input, goalAmount, goalMonths),
    [input, goalAmount, goalMonths],
  );

  const totalVariable = (input?.variableExpenses ?? []).reduce((s, e) => s + e.monthlyAmount, 0);
  const totalFixed = (input?.recurringFlows ?? [])
    .filter((f) => f.amount < 0)
    .reduce((s, f) => s + Math.abs(f.amount), 0);
  const emergencyTarget = Math.round((totalFixed + totalVariable) * 3);

  const monthlyNeeded = goalAmount / Math.max(1, goalMonths);
  const maxPossible = (input?.variableExpenses ?? []).reduce(
    (s, e) => s + e.monthlyAmount * (e.volatility ?? 0.3),
    0,
  );
  const achievable = monthlyNeeded <= maxPossible;
  const totalCut = suggestions.reduce((s, s2) => s + s2.suggestedCut, 0);

  const visibleSuggestions = showAll ? suggestions : suggestions.slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-brand" />
              Budget optimieren
            </CardTitle>
            <CardDescription className="mt-1">
              Wie du schneller sparst oder Luft im Budget findest.
            </CardDescription>
          </div>
          {emergencyTarget > 0 && (
            <Badge variant="outline" className="shrink-0 text-xs">
              Notrücklage: {eur.format(emergencyTarget)}
            </Badge>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant={mode === 'goal' ? 'default' : 'outline'}
            onClick={() => setMode('goal')}
          >
            <Target className="mr-1.5 h-3.5 w-3.5" /> Sparziel
          </Button>
          <Button
            size="sm"
            variant={mode === 'contracts' ? 'default' : 'outline'}
            onClick={() => setMode('contracts')}
          >
            <TrendingDown className="mr-1.5 h-3.5 w-3.5" /> Verträge ({contractHints.length})
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {mode === 'goal' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="goal-amount">Sparziel (€)</Label>
                <Input
                  id="goal-amount"
                  type="number"
                  min={0}
                  value={goalAmount || ''}
                  onChange={(e) => setGoalAmount(Number(e.target.value))}
                  placeholder="z.B. 5000"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="goal-months">In wie vielen Monaten?</Label>
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

            {goalAmount > 0 && goalMonths > 0 && (
              <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
                <span className="font-medium">{eur.format(monthlyNeeded)}/Monat</span>
                <span className="ml-2 text-muted-foreground">
                  nötig ·{' '}
                  {achievable
                    ? `möglich durch ${eur.format(totalCut)}/Mo. Einsparung`
                    : `maximale Einsparung laut Daten: ${eur.format(Math.round(maxPossible))}/Mo.`}
                </span>
              </div>
            )}

            {!achievable && goalAmount > 0 && (
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertTitle>Ziel erfordert mehr als variable Ausgaben hergeben</AlertTitle>
                <AlertDescription>
                  Mit deinen variablen Ausgaben lassen sich realistisch ca.{' '}
                  {eur.format(Math.round(maxPossible))}/Mo. einsparen – das Ziel erfordert{' '}
                  {eur.format(Math.round(monthlyNeeded))}/Mo. Entweder Zeitraum verlängern oder
                  Fixkosten (Verträge) prüfen.
                </AlertDescription>
              </Alert>
            )}

            {suggestions.length > 0 ? (
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Wo kürzen? (nach Sparpotenzial)
                </div>
                <div className="space-y-2">
                  {visibleSuggestions.map((s) => (
                    <div key={s.category} className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{s.category}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {eur.format(s.currentAmount)}/Mo.
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-brand/60 transition-all"
                            style={{ width: `${Math.round((s.newBudget / s.currentAmount) * 100)}%` }}
                          />
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                          −{eur.format(s.suggestedCut)}/Mo.
                        </div>
                        <div className="text-xs text-muted-foreground">→ {eur.format(s.newBudget)}</div>
                      </div>
                    </div>
                  ))}
                </div>
                {suggestions.length > 5 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => setShowAll((v) => !v)}
                  >
                    {showAll ? (
                      <>
                        <ChevronDown className="mr-1.5 h-3.5 w-3.5" /> Weniger anzeigen
                      </>
                    ) : (
                      <>
                        <ChevronRight className="mr-1.5 h-3.5 w-3.5" /> Alle {suggestions.length} Kategorien zeigen
                      </>
                    )}
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">
                  Kategorien mit hoher historischer Schwankung haben mehr Sparpotenzial.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Noch keine variablen Ausgaben erkannt. Importiere mehr Transaktionen für
                Einspar-Vorschläge.
              </p>
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
              contractHints.map((hint, i) => (
                <div key={i} className="rounded-xl border p-4">
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
                          bis {eur.format(hint.monthlySavings)}/Mo.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}

            {emergencyTarget > 0 && (
              <div className="rounded-xl border border-dashed p-4">
                <div className="flex items-center gap-2 font-medium">
                  <Shield className="h-4 w-4 text-brand" />
                  Notrücklage
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Empfehlung: ca. {eur.format(emergencyTarget)} (3 Monate Fixkosten + variable Ausgaben)
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
