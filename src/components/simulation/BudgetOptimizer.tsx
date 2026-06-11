import React, { useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import type { Category } from '@/types';
import { SimulationEngine, BudgetSuggestion } from './SimulationEngine';

interface BudgetOptimizerProps {
  engine: SimulationEngine;
  categories: Category[];
  months: string[]; // labels (kurz)
  riskK: number;
  onApplyOverrides: (overrides: Record<string, { min: number; max: number }>) => void;
}

export function BudgetOptimizer({ engine, categories, months, riskK, onApplyOverrides }: BudgetOptimizerProps) {
  const [mode, setMode] = useState<'survival' | 'goal'>('survival');
  const [protectedIds, setProtectedIds] = useState<Set<string>>(new Set());
  const [goalAmount, setGoalAmount] = useState<number>(10000);
  const [goalMonthIndex, setGoalMonthIndex] = useState<number>(Math.min(7, months.length - 1));
  const [suggestions, setSuggestions] = useState<BudgetSuggestion[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<Record<string, { min: number; max: number }>>({});

  const toggleProtect = (catId: string) => {
    setProtectedIds(prev => {
      const next = new Set(prev);
      next.has(catId) ? next.delete(catId) : next.add(catId);
      return next;
    });
  };

  const computePlan = () => {
    if (mode === 'survival') {
      const { suggestions, overrides, warnings } = engine.generateSurvivalPlan(protectedIds, riskK);
      setSuggestions(suggestions);
      setOverrides(overrides);
      setWarnings(warnings);
    } else {
      const { suggestions, overrides, warnings } = engine.generateGoalPlan(goalAmount, goalMonthIndex, protectedIds, riskK);
      setSuggestions(suggestions);
      setOverrides(overrides);
      setWarnings(warnings);
    }
  };

  const emergencyHint = useMemo(() => {
    // einfache Heuristik: Notrücklage = 3x typische Vertragskosten/Monat
    const contracts = engine.getDetectedContracts();
    const monthly = contracts.reduce((sum, c) => sum + (c.amountTypical ? (c.cycle === 'monthly' ? c.amountTypical : c.cycle === 'quarterly' ? c.amountTypical / 3 : c.cycle === 'yearly' ? c.amountTypical / 12 : c.amountTypical) : 0), 0);
    const reserve = Math.round(monthly * 3);
    return reserve;
  }, [engine]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wie kann ich mein Budget richtig einstellen?</CardTitle>
        <CardDescription>
          Passe variable Budgets an, um entweder nicht ins Minus zu rutschen oder ein Sparziel zu erreichen. Vorschläge sind robust gegenüber dem pessimistischen Szenario.
          <span className="block text-xs text-muted-foreground mt-1">{categories.length} Kategorien erkannt</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTitle>Notrücklage</AlertTitle>
          <AlertDescription>
            Empfehlung: Baue zuerst eine Notrücklage von ca. {emergencyHint.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })} (≈3 Monate Fixkosten).
          </AlertDescription>
        </Alert>

        <Tabs value={mode} onValueChange={(v: string) => setMode(v as 'survival' | 'goal')}>
          <TabsList className="grid grid-cols-2 w-full max-w-md">
            <TabsTrigger value="survival">Saldo überleben</TabsTrigger>
            <TabsTrigger value="goal">Ziel erreichen</TabsTrigger>
          </TabsList>

          <TabsContent value="survival" className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Wenn Monats- oder kumulierter Saldo negativ zu werden droht, werden zuerst niedrige Prioritäten gekürzt, dann mittlere und zuletzt hohe – mit sinnvollen Mindestbudgets.
            </p>
            <div className="flex gap-2">
              <Button onClick={computePlan}>Plan berechnen</Button>
              {Object.keys(overrides).length > 0 && (
                <Button variant="secondary" onClick={() => onApplyOverrides(overrides)}>
                  Plan übernehmen
                </Button>
              )}
            </div>
          </TabsContent>

          <TabsContent value="goal" className="space-y-3">
            <div className="grid sm:grid-cols-3 gap-3 items-end">
              <div>
                <Label>Zielbetrag (€)</Label>
                <Input
                  type="number"
                  value={goalAmount || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGoalAmount(Number(e.target.value))}
                  placeholder="z.B. 10000"
                />
              </div>
              <div>
                <Label>Frist (Monat)</Label>
                <select
                  className="w-full border rounded h-10 px-3"
                  value={goalMonthIndex}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setGoalMonthIndex(Number(e.target.value))}
                >
                  {months.map((m, idx) => (
                    <option key={idx} value={idx}>{m}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Ziele &gt; 12 Monate werden unterstützt, sind aber naturgemäß ungenauer.
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={computePlan} className="flex-1">Plan berechnen</Button>
                {Object.keys(overrides).length > 0 && (
                  <Button variant="secondary" onClick={() => onApplyOverrides(overrides)} className="flex-1">Plan übernehmen</Button>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {warnings.length > 0 && (
          <Alert>
            <AlertTitle>Hinweis</AlertTitle>
            <AlertDescription>
              {warnings.map((w, i) => (
                <div key={i} className="text-sm">{w}</div>
              ))}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Vorschläge</Label>
            <Badge variant="outline">{suggestions.length} Kategorien</Badge>
          </div>
          {suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Vorschläge – klicke auf „Plan berechnen“.</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-3 max-h-80 overflow-y-auto">
              {suggestions.map(s => (
                <div key={s.categoryId} className="rounded-lg border p-3 bg-muted/50">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{s.categoryName}</div>
                    <Badge variant={s.priority >= 4 ? 'outline' : 'secondary'}>
                      Prio {s.priority}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Von {s.from.toLocaleString('de-DE')}€ auf {s.to.toLocaleString('de-DE')}€ · Ersparnis {s.savingsPerMonth.toLocaleString('de-DE')}€/Monat
                  </div>
                  {s.note && <div className="text-xs mt-1">{s.note}</div>}
                  <div className="mt-2 flex items-center justify-between">
                    <Button
                      size="sm"
                      variant={protectedIds.has(s.categoryId) ? 'secondary' : 'outline'}
                      onClick={() => toggleProtect(s.categoryId)}
                    >
                      {protectedIds.has(s.categoryId) ? '✓ Geschützt' : 'Schützen'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}