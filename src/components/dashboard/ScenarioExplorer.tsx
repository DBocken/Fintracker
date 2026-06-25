import { useMemo, useState } from 'react';
import { SlidersHorizontal, RotateCcw, ChevronDown, TrendingDown, CalendarClock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ForecastInput, RecurringCadence } from '@/lib/forecast-types';
import type {
  ForecastScenario,
  ScenarioComparison,
  ScenarioModifier,
} from '@/lib/forecast-scenario-types';

const eur = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

function monthlyFactor(cadence: RecurringCadence, intervalDays?: number): number {
  switch (cadence) {
    case 'weekly': return 52 / 12;
    case 'biweekly': return 26 / 12;
    case 'quarterly': return 1 / 3;
    case 'semiannual': return 1 / 6;
    case 'annual': return 1 / 12;
    case 'custom': return 30 / Math.max(1, intervalDays ?? 30);
    default: return 1;
  }
}

/** Erkanntes monatliches Nettoeinkommen aus den aktiven Flows. */
function detectMonthlyIncome(input: ForecastInput | null): number {
  if (!input?.recurringFlows) return 0;
  return input.recurringFlows
    .filter((f) => f.amount > 0)
    .reduce((sum, f) => sum + f.amount * monthlyFactor(f.cadence, f.intervalDays), 0);
}

/**
 * Personalisiert ein Preset mit echten Nutzerwerten. So sieht der Nutzer beim
 * Wechsel des Beispiels sofort *seine* Zahlen statt generischer Platzhalter –
 * z. B. das erkannte Gehalt als Default für das „neue Gehalt" beim Jobwechsel.
 */
function personalizePreset(preset: ForecastScenario, input: ForecastInput | null): ForecastScenario {
  const income = Math.round(detectMonthlyIncome(input));
  if (income <= 0) return structuredClone(preset);

  return {
    ...preset,
    modifiers: preset.modifiers.map((m) => {
      // Neues Gehalt (recurring, positiver Betrag) → erkanntes Einkommen vorbelegen.
      if (m.type === 'recurring' && (m.amount ?? 0) > 0) {
        return { ...m, amount: income };
      }
      return { ...m };
    }),
  };
}

const CADENCE_LABELS: Record<string, string> = {
  monthly: 'monatlich',
  quarterly: 'vierteljährlich',
  annual: 'jährlich',
  weekly: 'wöchentlich',
  biweekly: '14-tägig',
  semiannual: 'halbjährlich',
  custom: 'individuell',
};

function modifierTitle(m: ScenarioModifier): string {
  if (m.label) return m.label;
  switch (m.type) {
    case 'income': return 'Einnahmen';
    case 'expenses': return 'Fixkosten';
    case 'variable': return 'Grundverbrauch';
    case 'interest': return 'Zinssatz';
    case 'oneTime': return 'Einmalbetrag';
    case 'recurring': return 'Wiederkehrend';
  }
}

interface Props {
  presets: ForecastScenario[];
  input: ForecastInput | null;
  /** Liefert für ein editiertes Szenario den Live-Vergleich (oder null bei Basis). */
  comparison: ScenarioComparison | null;
  /** Wird bei jeder Änderung aufgerufen – das editierte Szenario fließt live in die Prognose. */
  onApply: (scenario: ForecastScenario | null) => void;
  /** Aktuell angewandtes Szenario (zur Markierung der ausgewählten Kachel). */
  activeId: string | null;
}

/**
 * Szenario-Explorer: Der Nutzer wählt aus einer Liste typischer Beispiele,
 * klappt die Details auf und passt jeden Parameter an seine persönliche Lage an.
 * Jede Änderung fließt sofort in die Prognose – „Live-Vorschau ohne Speichern".
 */
export default function ScenarioExplorer({ presets, input, comparison, onApply, activeId }: Props) {
  // Editierbarer Arbeitsstand des gewählten Presets (personalisiert vorbelegt).
  const [working, setWorking] = useState<ForecastScenario | null>(null);

  // Basis-Preset des aktuellen Arbeitsstands (für Reset/Diff-Erkennung).
  const basePreset = useMemo(
    () => (working ? presets.find((p) => p.id === working.id) ?? null : null),
    [working, presets],
  );
  const personalizedBase = useMemo(
    () => (basePreset ? personalizePreset(basePreset, input) : null),
    [basePreset, input],
  );
  const isEdited = useMemo(
    () =>
      !!working &&
      !!personalizedBase &&
      JSON.stringify(working.modifiers) !== JSON.stringify(personalizedBase.modifiers),
    [working, personalizedBase],
  );

  const selectPreset = (preset: ForecastScenario | null) => {
    if (!preset) {
      setWorking(null);
      onApply(null);
      return;
    }
    const personalized = personalizePreset(preset, input);
    setWorking(personalized);
    onApply(personalized);
  };

  const patchModifier = (modId: string, patch: Partial<ScenarioModifier>) => {
    setWorking((prev) => {
      if (!prev) return prev;
      const next: ForecastScenario = {
        ...prev,
        modifiers: prev.modifiers.map((m) => (m.id === modId ? { ...m, ...patch } : m)),
      };
      onApply(next);
      return next;
    });
  };

  const resetToPreset = () => {
    if (personalizedBase) {
      setWorking(personalizedBase);
      onApply(personalizedBase);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <SlidersHorizontal className="h-4 w-4 text-brand" />
          Szenarien erkunden &amp; anpassen
        </CardTitle>
        <CardDescription>
          Wähle ein Beispiel, öffne die Details und passe jeden Wert an deine Lage an. Die Vorschau
          aktualisiert sich sofort.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Preset-Liste */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={working === null && activeId === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => selectPreset(null)}
          >
            Basis (ohne Szenario)
          </Button>
          {presets.map((preset) => (
            <Button
              key={preset.id}
              variant={working?.id === preset.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => selectPreset(preset)}
              title={preset.description}
            >
              {preset.name}
            </Button>
          ))}
        </div>

        {/* Details: editierbare Parameter des gewählten Presets */}
        {working && (
          <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{working.name}</span>
                  {isEdited && (
                    <Badge variant="secondary" className="text-[10px]">
                      angepasst
                    </Badge>
                  )}
                </div>
                {basePreset?.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{basePreset.description}</p>
                )}
              </div>
              {isEdited && (
                <Button variant="ghost" size="sm" onClick={resetToPreset}>
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Zurücksetzen
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {working.modifiers.map((mod) => (
                <ModifierEditor
                  key={mod.id}
                  modifier={mod}
                  onChange={(patch) => patchModifier(mod.id, patch)}
                />
              ))}
            </div>

            {/* Live-Wirkung */}
            {comparison && (
              <div className="grid grid-cols-2 gap-2 border-t pt-3 sm:grid-cols-3">
                <ImpactStat
                  icon={<TrendingDown className="h-3.5 w-3.5" />}
                  label="Tiefststand"
                  baseline={comparison.lowestBalance.baseline}
                  scenario={comparison.lowestBalance.scenario}
                  higherIsBetter
                />
                <ImpactStat
                  icon={<CalendarClock className="h-3.5 w-3.5" />}
                  label="Tage unter Puffer"
                  baseline={comparison.daysBelowSafetyBuffer.baseline}
                  scenario={comparison.daysBelowSafetyBuffer.scenario}
                  higherIsBetter={false}
                  unit=" T"
                />
                <ImpactStat
                  icon={<TrendingDown className="h-3.5 w-3.5" />}
                  label="Endvermögen"
                  baseline={comparison.endingNetWorth.baseline}
                  scenario={comparison.endingNetWorth.scenario}
                  higherIsBetter
                />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Ein editierbarer Parameter-Block für einen einzelnen Modifikator. */
function ModifierEditor({
  modifier: m,
  onChange,
}: {
  modifier: ScenarioModifier;
  onChange: (patch: Partial<ScenarioModifier>) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-lg border bg-background">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="text-sm font-medium">{modifierTitle(m)}</span>
        <span className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{summarizeModifier(m)}</span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open && (
        <div className="grid gap-3 border-t p-3 sm:grid-cols-2">
          {(m.type === 'income' || m.type === 'expenses' || m.type === 'variable') && (
            <>
              <Field label="Änderung in %">
                <Input
                  type="number"
                  inputMode="decimal"
                  value={m.percentChange ?? 0}
                  onChange={(e) => onChange({ percentChange: Number(e.target.value) })}
                />
              </Field>
              {m.type !== 'variable' && (
                <Field label="Wirksam ab">
                  <Input
                    type="date"
                    value={m.fromDate ?? ''}
                    onChange={(e) => onChange({ fromDate: e.target.value || undefined })}
                  />
                </Field>
              )}
            </>
          )}

          {m.type === 'interest' && (
            <Field label="Δ Prozentpunkte">
              <Input
                type="number"
                inputMode="decimal"
                value={m.amount ?? 0}
                onChange={(e) => onChange({ amount: Number(e.target.value) })}
              />
            </Field>
          )}

          {m.type === 'oneTime' && (
            <>
              <Field label="Betrag (− Ausgabe, + Einnahme)">
                <Input
                  type="number"
                  inputMode="decimal"
                  value={m.amount ?? 0}
                  onChange={(e) => onChange({ amount: Number(e.target.value) })}
                />
              </Field>
              <Field label="Datum">
                <Input
                  type="date"
                  value={m.date ?? ''}
                  onChange={(e) => onChange({ date: e.target.value })}
                />
              </Field>
            </>
          )}

          {m.type === 'recurring' && (
            <>
              <Field label="Betrag (− Ausgabe, + Einnahme)">
                <Input
                  type="number"
                  inputMode="decimal"
                  value={m.amount ?? 0}
                  onChange={(e) => onChange({ amount: Number(e.target.value) })}
                />
              </Field>
              <Field label="Rhythmus">
                <Select
                  value={m.cadence ?? 'monthly'}
                  onValueChange={(v) => onChange({ cadence: v as RecurringCadence })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monatlich</SelectItem>
                    <SelectItem value="quarterly">Vierteljährlich</SelectItem>
                    <SelectItem value="annual">Jährlich</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Beginnt am">
                <Input
                  type="date"
                  value={m.anchorDate ?? ''}
                  onChange={(e) => onChange({ anchorDate: e.target.value })}
                />
              </Field>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function summarizeModifier(m: ScenarioModifier): string {
  switch (m.type) {
    case 'income':
    case 'expenses':
    case 'variable': {
      const pct = m.percentChange ?? 0;
      const from = m.fromDate ? ` ab ${m.fromDate}` : '';
      return `${pct >= 0 ? '+' : ''}${pct} %${from}`;
    }
    case 'interest':
      return `${(m.amount ?? 0) >= 0 ? '+' : ''}${m.amount ?? 0} %-Pkt.`;
    case 'oneTime':
      return `${eur.format(m.amount ?? 0)}${m.date ? ` · ${m.date}` : ''}`;
    case 'recurring':
      return `${eur.format(m.amount ?? 0)} ${CADENCE_LABELS[m.cadence ?? 'monthly']}`;
  }
}

function ImpactStat({
  icon,
  label,
  baseline,
  scenario,
  higherIsBetter,
  unit = '',
}: {
  icon: React.ReactNode;
  label: string;
  baseline: number;
  scenario: number;
  higherIsBetter: boolean;
  unit?: string;
}) {
  const delta = scenario - baseline;
  const improved = higherIsBetter ? delta > 0 : delta < 0;
  const worsened = higherIsBetter ? delta < 0 : delta > 0;
  const tone = improved
    ? 'text-emerald-600 dark:text-emerald-400'
    : worsened
      ? 'text-destructive'
      : 'text-muted-foreground';
  const fmt = (v: number) => (unit ? `${Math.round(v)}${unit}` : eur.format(v));

  return (
    <div className="rounded-lg border bg-background p-2.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 text-sm font-semibold tabular-nums">{fmt(scenario)}</div>
      <div className={`text-xs tabular-nums ${tone}`}>
        {delta > 0 ? '+' : ''}
        {fmt(delta)}
      </div>
    </div>
  );
}
