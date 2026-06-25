import { useMemo, useState } from 'react';
import {
  SlidersHorizontal,
  RotateCcw,
  TrendingDown,
  CalendarClock,
  Plus,
  Trash2,
  Save,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ForecastInput, RecurringCadence } from '@/lib/forecast-types';
import type { ForecastScenario, ScenarioComparison } from '@/lib/forecast-scenario-types';
import { resolveFlowSelector } from '@/lib/forecast-scenario';

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

// -----------------------------------------------------------------------------
// Parameter-Formular: IMMER die volle Palette, damit der Nutzer sieht, was ein
// Szenario ändern kann – und jeden Parameter selbst setzen darf.
// -----------------------------------------------------------------------------

interface OneTimeEntry {
  localId: string;
  amount: number;
  date: string;
  label: string;
}
interface RecurringEntry {
  localId: string;
  amount: number;
  cadence: RecurringCadence;
  anchorDate: string;
  label: string;
}
/**
 * Ein konkreter erkannter Eintrag (Gehalt, Unterhalt, Miete …) als an-/
 * abschaltbarer Szenario-Hebel. `factorPct` 100 = unverändert, 0 = entfällt,
 * 70 = auf 70 % (z. B. Krankengeld). So trifft ein Szenario echte Posten statt
 * pauschaler Prozentsätze.
 */
interface FlowEntry {
  id: string;
  name: string;
  /** Auf den Monat normierter, signierter Betrag (nur Anzeige). */
  monthlyAmount: number;
  isIncome: boolean;
  factorPct: number;
  fromDate: string;
}
interface ParamForm {
  income: { pct: number; fromDate: string };
  expenses: { pct: number; fromDate: string };
  variable: { pct: number };
  interest: { delta: number };
  flows: FlowEntry[];
  oneTime: OneTimeEntry[];
  recurring: RecurringEntry[];
}

function emptyForm(): ParamForm {
  return {
    income: { pct: 0, fromDate: '' },
    expenses: { pct: 0, fromDate: '' },
    variable: { pct: 0 },
    interest: { delta: 0 },
    flows: [],
    oneTime: [],
    recurring: [],
  };
}

/**
 * Baut die an-/abschaltbaren Einträge aus den echten erkannten Flows: Einnahmen
 * zuerst, danach Ausgaben, je absteigend nach Betrag. Anfangs steht jeder
 * Eintrag auf 100 % (unverändert).
 */
function baseFlowEntries(input: ForecastInput | null): FlowEntry[] {
  if (!input?.recurringFlows) return [];
  return input.recurringFlows
    .map((f) => ({
      id: f.id,
      name: f.name,
      monthlyAmount: Math.round(f.amount * monthlyFactor(f.cadence, f.intervalDays)),
      isIncome: f.amount > 0,
      factorPct: 100,
      fromDate: '',
    }))
    .sort(
      (a, b) =>
        Number(b.isIncome) - Number(a.isIncome) ||
        Math.abs(b.monthlyAmount) - Math.abs(a.monthlyAmount),
    );
}

/** Neutrales Formular inkl. der realen Einträge (alle auf 100 %). */
function neutralForm(input: ForecastInput | null): ParamForm {
  return { ...emptyForm(), flows: baseFlowEntries(input) };
}

let entryCounter = 0;
function nextLocalId(): string {
  entryCounter += 1;
  return `entry-${Date.now()}-${entryCounter}`;
}

/**
 * Baut aus einem Preset/Szenario das volle Parameter-Formular. `flow`-
 * Modifikatoren werden gegen die echten Flows aufgelöst, damit der Nutzer
 * sieht, WELCHER konkrete Eintrag betroffen ist (z. B. „Jobverlust" → das
 * Hauptgehalt steht auf 0 %).
 */
function scenarioToForm(scenario: ForecastScenario, input: ForecastInput | null): ParamForm {
  const form = neutralForm(input);
  const realFlows = input?.recurringFlows ?? [];
  for (const m of scenario.modifiers) {
    switch (m.type) {
      case 'income':
        form.income = { pct: m.percentChange ?? 0, fromDate: m.fromDate ?? '' };
        break;
      case 'expenses':
        form.expenses = { pct: m.percentChange ?? 0, fromDate: m.fromDate ?? '' };
        break;
      case 'variable':
        form.variable = { pct: m.percentChange ?? 0 };
        break;
      case 'interest':
        form.interest = { delta: m.amount ?? 0 };
        break;
      case 'flow': {
        if (!m.flowSelector) break;
        const targetIds = resolveFlowSelector(m.flowSelector, realFlows);
        const factorPct = Math.round((m.factor ?? 0) * 100);
        form.flows = form.flows.map((fl) =>
          targetIds.has(fl.id) ? { ...fl, factorPct, fromDate: m.fromDate ?? '' } : fl,
        );
        break;
      }
      case 'oneTime':
        form.oneTime.push({
          localId: m.id || nextLocalId(),
          amount: m.amount ?? 0,
          date: m.date ?? '',
          label: m.label ?? '',
        });
        break;
      case 'recurring':
        form.recurring.push({
          localId: m.id || nextLocalId(),
          amount: m.amount ?? 0,
          cadence: m.cadence ?? 'monthly',
          anchorDate: m.anchorDate ?? '',
          label: m.label ?? '',
        });
        break;
    }
  }
  return form;
}

/**
 * Personalisiert ein Formular mit echten Nutzerwerten: ein neues, positives
 * wiederkehrendes Gehalt wird mit dem erkannten Einkommen vorbelegt.
 */
function personalizeForm(form: ParamForm, input: ForecastInput | null): ParamForm {
  const income = Math.round(detectMonthlyIncome(input));
  if (income <= 0) return form;
  return {
    ...form,
    recurring: form.recurring.map((r) => (r.amount > 0 ? { ...r, amount: income } : r)),
  };
}

/** Erzeugt aus dem Formular ein Szenario – nur gesetzte Parameter werden zu Modifikatoren. */
function formToScenario(form: ParamForm, id: string, name: string, description?: string): ForecastScenario {
  const modifiers: ForecastScenario['modifiers'] = [];
  if (form.income.pct !== 0)
    modifiers.push({ id: 'income', type: 'income', percentChange: form.income.pct, fromDate: form.income.fromDate || undefined });
  if (form.expenses.pct !== 0)
    modifiers.push({ id: 'expenses', type: 'expenses', percentChange: form.expenses.pct, fromDate: form.expenses.fromDate || undefined });
  if (form.variable.pct !== 0)
    modifiers.push({ id: 'variable', type: 'variable', percentChange: form.variable.pct });
  if (form.interest.delta !== 0)
    modifiers.push({ id: 'interest', type: 'interest', amount: form.interest.delta });
  for (const fl of form.flows) {
    // Nur abweichende Einträge werden zu Modifikatoren – 100 % = unverändert.
    if (fl.factorPct !== 100)
      modifiers.push({
        id: `flow-${fl.id}`,
        type: 'flow',
        flowSelector: { kind: 'ids', ids: [fl.id] },
        factor: fl.factorPct / 100,
        fromDate: fl.fromDate || undefined,
      });
  }
  for (const e of form.oneTime) {
    if (e.amount !== 0 && e.date)
      modifiers.push({ id: e.localId, type: 'oneTime', amount: e.amount, date: e.date, label: e.label || undefined });
  }
  for (const e of form.recurring) {
    if (e.amount !== 0 && e.anchorDate)
      modifiers.push({ id: e.localId, type: 'recurring', amount: e.amount, cadence: e.cadence, anchorDate: e.anchorDate, label: e.label || undefined });
  }
  return { id, name, description, modifiers };
}

function isFormEmpty(form: ParamForm): boolean {
  return formToScenario(form, '', '').modifiers.length === 0;
}

const CADENCE_OPTIONS: { value: RecurringCadence; label: string }[] = [
  { value: 'monthly', label: 'Monatlich' },
  { value: 'quarterly', label: 'Vierteljährlich' },
  { value: 'annual', label: 'Jährlich' },
];

interface Props {
  /** Beispiel-Szenarien (Presets) und gespeicherte eigene Szenarien. */
  presets: ForecastScenario[];
  /** Vom Nutzer gespeicherte eigene Szenarien (für Löschen/Markierung). */
  customScenarios: ForecastScenario[];
  input: ForecastInput | null;
  /** Live-Vergleich Basis ↔ aktuelles Szenario. */
  comparison: ScenarioComparison | null;
  /** Wird bei jeder Änderung aufgerufen – das Szenario fließt live in die Prognose. */
  onApply: (scenario: ForecastScenario | null) => void;
  /** Eigenes Szenario speichern. */
  onAddScenario: (scenario: ForecastScenario) => void;
  /** Eigenes Szenario löschen. */
  onDeleteScenario: (id: string) => void;
}

/**
 * Einziger Szenario-Bereich der Simulationsseite: Beispiele wählen, ALLE
 * Parameter sehen und anpassen, eigene Szenarien bauen und speichern. Jede
 * Änderung fließt sofort in die Prognose („Live-Vorschau ohne Speichern").
 */
export default function ScenarioExplorer({
  presets,
  customScenarios,
  input,
  comparison,
  onApply,
  onAddScenario,
  onDeleteScenario,
}: Props) {
  // Aktuelle Auswahl: null = Basis; sonst id + Name + (optional) Beschreibung.
  const [selected, setSelected] = useState<{ id: string; name: string; description?: string } | null>(null);
  const [form, setForm] = useState<ParamForm>(() => neutralForm(input));
  const [isCustom, setIsCustom] = useState(false);

  const basePreset = useMemo(
    () => (selected ? presets.find((p) => p.id === selected.id) ?? null : null),
    [selected, presets],
  );
  const isEdited = useMemo(() => {
    if (!selected || !basePreset) return isCustom && !isFormEmpty(form);
    const baseForm = personalizeForm(scenarioToForm(basePreset, input), input);
    return JSON.stringify(form) !== JSON.stringify(baseForm);
  }, [selected, basePreset, form, input, isCustom]);

  const apply = (nextForm: ParamForm, sel: { id: string; name: string; description?: string } | null) => {
    if (!sel || isFormEmpty(nextForm)) {
      onApply(null);
      return;
    }
    onApply(formToScenario(nextForm, sel.id, sel.name, sel.description));
  };

  const selectBase = () => {
    setSelected(null);
    setIsCustom(false);
    setForm(neutralForm(input));
    onApply(null);
  };

  const selectPreset = (preset: ForecastScenario) => {
    const personalized = personalizeForm(scenarioToForm(preset, input), input);
    const sel = { id: preset.id, name: preset.name, description: preset.description };
    setSelected(sel);
    setIsCustom(false);
    setForm(personalized);
    apply(personalized, sel);
  };

  const startCustom = () => {
    const sel = { id: `custom-${Date.now()}`, name: 'Eigenes Szenario' };
    setSelected(sel);
    setIsCustom(true);
    setForm(neutralForm(input));
    onApply(null); // neutrales Formular = Basis, bis der Nutzer etwas setzt
  };

  const update = (patch: (f: ParamForm) => ParamForm) => {
    setForm((prev) => {
      const next = patch(prev);
      apply(next, selected);
      return next;
    });
  };

  const resetToPreset = () => {
    if (!basePreset) return;
    const personalized = personalizeForm(scenarioToForm(basePreset, input), input);
    setForm(personalized);
    apply(personalized, selected);
  };

  const saveCustom = () => {
    if (!selected || isFormEmpty(form)) return;
    const scenario = formToScenario(form, selected.id, selected.name, selected.description);
    onAddScenario(scenario);
    setIsCustom(false);
  };

  const isSavedCustom = !!selected && customScenarios.some((c) => c.id === selected.id);

  // Ein Beispiel kann einen konkreten Eintrag adressieren, den es bei diesem
  // Nutzer nicht gibt (z. B. „Unterhalt fällt weg" ohne erkannten Unterhalt).
  // Dann ist das Szenario wirkungslos – das machen wir transparent statt es
  // stillschweigend ins Leere laufen zu lassen.
  const flowPresetUnmatched = useMemo(() => {
    const presetHasFlow = basePreset?.modifiers.some((m) => m.type === 'flow') ?? false;
    const anyFlowDeviates = form.flows.some((f) => f.factorPct !== 100);
    return presetHasFlow && !anyFlowDeviates;
  }, [basePreset, form.flows]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <SlidersHorizontal className="h-4 w-4 text-brand" />
          Szenarien
        </CardTitle>
        <CardDescription>
          Wähle ein Beispiel oder baue ein eigenes Szenario. Jeder Parameter ist sichtbar und
          anpassbar – die Vorschau aktualisiert sich sofort.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Auswahl: Basis + Beispiele + eigene + „Eigenes Szenario" */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selected === null ? 'default' : 'outline'}
            size="sm"
            onClick={selectBase}
          >
            Basis
          </Button>
          {presets.map((preset) => {
            const saved = customScenarios.some((c) => c.id === preset.id);
            return (
              <span key={preset.id} className="flex items-center">
                <Button
                  variant={selected?.id === preset.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => selectPreset(preset)}
                  title={preset.description}
                >
                  {preset.name}
                </Button>
                {saved && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label="Szenario löschen"
                    onClick={() => {
                      if (selected?.id === preset.id) selectBase();
                      onDeleteScenario(preset.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </span>
            );
          })}
          <Button variant="outline" size="sm" onClick={startCustom}>
            <Plus className="mr-1 h-4 w-4" /> Eigenes Szenario
          </Button>
        </div>

        {/* Editor: volle Parameter-Palette */}
        {selected && (
          <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{selected.name}</span>
                  {isEdited && (
                    <Badge variant="secondary" className="text-[10px]">angepasst</Badge>
                  )}
                </div>
                {selected.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{selected.description}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  Alle Parameter sind sichtbar. Was du veränderst, wird zum Szenario.
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                {isEdited && basePreset && (
                  <Button variant="ghost" size="sm" onClick={resetToPreset}>
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Zurücksetzen
                  </Button>
                )}
                {!isSavedCustom && !isFormEmpty(form) && (
                  <Button variant="ghost" size="sm" onClick={saveCustom}>
                    <Save className="mr-1.5 h-3.5 w-3.5" /> Speichern
                  </Button>
                )}
              </div>
            </div>

            {/* Prozentuale Anpassungen */}
            <div className="grid gap-3 sm:grid-cols-2">
              <ParamGroup title="Einnahmen ändern" hint="z. B. Gehaltserhöhung, Nebenjob, Jobverlust (−100 %)">
                <PercentRow
                  pct={form.income.pct}
                  fromDate={form.income.fromDate}
                  onPct={(pct) => update((f) => ({ ...f, income: { ...f.income, pct } }))}
                  onFrom={(fromDate) => update((f) => ({ ...f, income: { ...f.income, fromDate } }))}
                />
              </ParamGroup>

              <ParamGroup title="Fixkosten ändern" hint="z. B. Mieterhöhung, Nebenkostennachzahlung">
                <PercentRow
                  pct={form.expenses.pct}
                  fromDate={form.expenses.fromDate}
                  onPct={(pct) => update((f) => ({ ...f, expenses: { ...f.expenses, pct } }))}
                  onFrom={(fromDate) => update((f) => ({ ...f, expenses: { ...f.expenses, fromDate } }))}
                />
              </ParamGroup>

              <ParamGroup title="Variable Ausgaben ändern" hint="Grundverbrauch (Lebensmittel, Freizeit …)">
                <Field label="Änderung in %">
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={form.variable.pct}
                    onChange={(e) => update((f) => ({ ...f, variable: { pct: Number(e.target.value) } }))}
                  />
                </Field>
              </ParamGroup>

              <ParamGroup title="Zinssatz ändern" hint="Δ Prozentpunkte auf verzinste Konten">
                <Field label="Δ Prozentpunkte">
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={form.interest.delta}
                    onChange={(e) => update((f) => ({ ...f, interest: { delta: Number(e.target.value) } }))}
                  />
                </Field>
              </ParamGroup>
            </div>

            {/* Konkrete erkannte Einträge an-/abschalten – der Kern: ein Jobverlust
                trifft genau das Hauptgehalt, nicht pauschal „alle Einnahmen". */}
            {form.flows.length > 0 && (
              <div className="space-y-3 rounded-lg border bg-background p-3">
                <div>
                  <div className="text-sm font-medium">Erkannte Einträge an- oder abschalten</div>
                  <div className="text-xs text-muted-foreground">
                    Schalte einzelne Einnahmen oder Verträge ab oder reduziere sie. Beispiel-Szenarien
                    markieren automatisch den passenden Eintrag (z. B. das größte Einkommen bei „Jobverlust").
                  </div>
                </div>

                {flowPresetUnmatched && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                    Für dieses Beispiel wurde kein passender Eintrag in deinen Daten erkannt.
                    Wähle den betroffenen Eintrag unten manuell, damit das Szenario wirkt.
                  </div>
                )}

                {(['income', 'expense'] as const).map((side) => {
                  const rows = form.flows.filter((fl) => (side === 'income' ? fl.isIncome : !fl.isIncome));
                  if (rows.length === 0) return null;
                  return (
                    <div key={side} className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">
                        {side === 'income' ? 'Einnahmen' : 'Verträge & Fixkosten'}
                      </div>
                      {rows.map((fl) => (
                        <FlowRow
                          key={fl.id}
                          entry={fl}
                          onChange={(patch) =>
                            update((f) => ({
                              ...f,
                              flows: f.flows.map((x) => (x.id === fl.id ? { ...x, ...patch } : x)),
                            }))
                          }
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Einmalige Posten */}
            <ListGroup
              title="Einmalige Posten"
              hint="z. B. Reparatur (−), Erstattung (+)"
              onAdd={() =>
                update((f) => ({
                  ...f,
                  oneTime: [...f.oneTime, { localId: nextLocalId(), amount: 0, date: '', label: '' }],
                }))
              }
            >
              {form.oneTime.map((e) => (
                <div key={e.localId} className="grid gap-2 rounded-lg border bg-background p-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                  <Field label="Betrag (− / +)">
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={e.amount}
                      onChange={(ev) =>
                        update((f) => ({
                          ...f,
                          oneTime: f.oneTime.map((x) => (x.localId === e.localId ? { ...x, amount: Number(ev.target.value) } : x)),
                        }))
                      }
                    />
                  </Field>
                  <Field label="Datum">
                    <Input
                      type="date"
                      value={e.date}
                      onChange={(ev) =>
                        update((f) => ({
                          ...f,
                          oneTime: f.oneTime.map((x) => (x.localId === e.localId ? { ...x, date: ev.target.value } : x)),
                        }))
                      }
                    />
                  </Field>
                  <Field label="Bezeichnung">
                    <Input
                      value={e.label}
                      placeholder="z. B. Reparatur"
                      onChange={(ev) =>
                        update((f) => ({
                          ...f,
                          oneTime: f.oneTime.map((x) => (x.localId === e.localId ? { ...x, label: ev.target.value } : x)),
                        }))
                      }
                    />
                  </Field>
                  <RemoveButton
                    onClick={() => update((f) => ({ ...f, oneTime: f.oneTime.filter((x) => x.localId !== e.localId) }))}
                  />
                </div>
              ))}
            </ListGroup>

            {/* Wiederkehrende Posten */}
            <ListGroup
              title="Wiederkehrende Posten"
              hint="neuer/wegfallender Vertrag, neues Gehalt (+)"
              onAdd={() =>
                update((f) => ({
                  ...f,
                  recurring: [
                    ...f.recurring,
                    { localId: nextLocalId(), amount: Math.round(detectMonthlyIncome(input)) || 0, cadence: 'monthly', anchorDate: '', label: '' },
                  ],
                }))
              }
            >
              {form.recurring.map((e) => (
                <div key={e.localId} className="grid gap-2 rounded-lg border bg-background p-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
                  <Field label="Betrag (− / +)">
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={e.amount}
                      onChange={(ev) =>
                        update((f) => ({
                          ...f,
                          recurring: f.recurring.map((x) => (x.localId === e.localId ? { ...x, amount: Number(ev.target.value) } : x)),
                        }))
                      }
                    />
                  </Field>
                  <Field label="Rhythmus">
                    <Select
                      value={e.cadence}
                      onValueChange={(v) =>
                        update((f) => ({
                          ...f,
                          recurring: f.recurring.map((x) => (x.localId === e.localId ? { ...x, cadence: v as RecurringCadence } : x)),
                        }))
                      }
                    >
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CADENCE_OPTIONS.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Beginnt am">
                    <Input
                      type="date"
                      value={e.anchorDate}
                      onChange={(ev) =>
                        update((f) => ({
                          ...f,
                          recurring: f.recurring.map((x) => (x.localId === e.localId ? { ...x, anchorDate: ev.target.value } : x)),
                        }))
                      }
                    />
                  </Field>
                  <Field label="Bezeichnung">
                    <Input
                      value={e.label}
                      placeholder="z. B. Neues Gehalt"
                      onChange={(ev) =>
                        update((f) => ({
                          ...f,
                          recurring: f.recurring.map((x) => (x.localId === e.localId ? { ...x, label: ev.target.value } : x)),
                        }))
                      }
                    />
                  </Field>
                  <RemoveButton
                    onClick={() => update((f) => ({ ...f, recurring: f.recurring.filter((x) => x.localId !== e.localId) }))}
                  />
                </div>
              ))}
            </ListGroup>

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

/**
 * Eine Zeile je erkanntem Eintrag: an/aus per Schalter plus optionale Reduktion
 * in % und „ab Datum". Aus = 0 % (Eintrag entfällt), 100 % = unverändert.
 */
function FlowRow({
  entry,
  onChange,
}: {
  entry: FlowEntry;
  onChange: (patch: Partial<FlowEntry>) => void;
}) {
  const active = entry.factorPct > 0;
  const reduced = active && entry.factorPct !== 100;
  return (
    <div className="rounded-lg border bg-muted/20 p-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{entry.name}</div>
          <div className="text-xs text-muted-foreground tabular-nums">
            {eur.format(entry.monthlyAmount)} / Monat
            {reduced && <span className="ml-1 text-amber-600 dark:text-amber-400">→ {entry.factorPct} %</span>}
            {!active && <span className="ml-1 text-destructive">entfällt</span>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-muted-foreground">{active ? 'aktiv' : 'aus'}</span>
          <Switch
            checked={active}
            aria-label={`${entry.name} ${active ? 'abschalten' : 'aktivieren'}`}
            onCheckedChange={(on) => onChange({ factorPct: on ? 100 : 0 })}
          />
        </div>
      </div>
      {active && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Field label="Anteil in % (100 = unverändert)">
            <Input
              type="number"
              inputMode="decimal"
              value={entry.factorPct}
              onChange={(e) => onChange({ factorPct: Number(e.target.value) })}
            />
          </Field>
          <Field label="Wirksam ab (optional)">
            <Input
              type="date"
              value={entry.fromDate}
              onChange={(e) => onChange({ fromDate: e.target.value })}
            />
          </Field>
        </div>
      )}
    </div>
  );
}

function ParamGroup({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="mb-2">
        <div className="text-sm font-medium">{title}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function PercentRow({
  pct,
  fromDate,
  onPct,
  onFrom,
}: {
  pct: number;
  fromDate: string;
  onPct: (v: number) => void;
  onFrom: (v: string) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Field label="Änderung in %">
        <Input type="number" inputMode="decimal" value={pct} onChange={(e) => onPct(Number(e.target.value))} />
      </Field>
      <Field label="Wirksam ab">
        <Input type="date" value={fromDate} onChange={(e) => onFrom(e.target.value)} />
      </Field>
    </div>
  );
}

function ListGroup({
  title,
  hint,
  onAdd,
  children,
}: {
  title: string;
  hint?: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-lg border bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium">{title}</div>
          {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        </div>
        <Button variant="outline" size="sm" onClick={onAdd}>
          <Plus className="mr-1 h-4 w-4" /> Hinzufügen
        </Button>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex items-end">
      <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Posten entfernen" onClick={onClick}>
        <Trash2 className="h-4 w-4" />
      </Button>
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
