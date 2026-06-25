import { useState } from 'react';
import { FlaskConical, Plus, Trash2, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  ForecastScenario,
  ScenarioComparison,
  ScenarioMetricDelta,
  ScenarioModifier,
  ScenarioModifierType,
} from '@/lib/forecast-scenario-types';

const eur = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});
const today = () => new Date().toISOString().slice(0, 10);

const MODIFIER_LABELS: Record<ScenarioModifierType, string> = {
  income: 'Einnahmen anpassen',
  expenses: 'Fixkosten anpassen',
  variable: 'Grundverbrauch anpassen',
  interest: 'Zinssatz ändern',
  oneTime: 'Einmalige Zahlung / Einnahme',
  recurring: 'Neuer / wegfallender Vertrag',
  flow: 'Eintrag an-/abschalten',
};

interface Props {
  /** Alle wählbaren Szenarien (Presets + eigene). */
  scenarios: ForecastScenario[];
  /** Aktives Szenario (null = Basis). */
  activeId: string | null;
  onSelect: (id: string | null) => void;
  /** Vergleich Basis ↔ aktives Szenario (null = kein aktives Szenario). */
  comparison: ScenarioComparison | null;
  /** Persistierte, eigene Szenarien (zum Löschen). */
  customScenarios: ForecastScenario[];
  onAddScenario: (scenario: ForecastScenario) => void;
  onDeleteScenario: (id: string) => void;
  /**
   * Blendet die Preset-Auswahl-Buttons aus (default: true).
   * Im Feineinstellungs-Modus wird stattdessen nur das aktive Szenario als
   * Badge und der eigene Szenarien-Builder angezeigt.
   */
  showPresets?: boolean;
}

/**
 * Szenario-Panel (Stufe 3): Was-wäre-wenn. Wählt ein Szenario, zeigt den
 * Vergleich gegen die Basis und erlaubt das Anlegen eigener Szenarien.
 */
export default function ScenarioPanel({
  scenarios,
  activeId,
  onSelect,
  comparison,
  customScenarios,
  onAddScenario,
  onDeleteScenario,
  showPresets = true,
}: Props) {
  const [building, setBuilding] = useState(false);
  const activeScenario = scenarios.find((s) => s.id === activeId) ?? null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FlaskConical className="h-4 w-4" /> {showPresets ? 'Szenarien (Was-wäre-wenn)' : 'Manuelle Anpassungen'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {showPresets ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={activeId === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => onSelect(null)}
            >
              Basis
            </Button>
            {scenarios.map((s) => {
              const isCustom = customScenarios.some((c) => c.id === s.id);
              return (
                <span key={s.id} className="flex items-center">
                  <Button
                    variant={activeId === s.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onSelect(s.id)}
                    title={s.description}
                  >
                    {s.name}
                  </Button>
                  {isCustom && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label="Szenario löschen"
                      onClick={() => {
                        if (activeId === s.id) onSelect(null);
                        onDeleteScenario(s.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </span>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {activeScenario ? (
              <>
                <Badge variant="secondary">Aktives Szenario: {activeScenario.name}</Badge>
                <Button variant="ghost" size="sm" onClick={() => onSelect(null)}>
                  Zurücksetzen
                </Button>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">Kein Szenario aktiv – Basis wird verwendet.</span>
            )}
          </div>
        )}

        {comparison && showPresets && <ComparisonGrid comparison={comparison} />}

        {!showPresets && (
          <p className="text-xs text-muted-foreground">
            Diese Anpassungen ergänzen das aktive Szenario (oder die Basisplanung).
          </p>
        )}

        {building ? (
          <ScenarioBuilder
            onCancel={() => setBuilding(false)}
            onSave={(scenario) => {
              onAddScenario(scenario);
              onSelect(scenario.id);
              setBuilding(false);
            }}
          />
        ) : (
          <Button variant="outline" size="sm" onClick={() => setBuilding(true)}>
            <Plus className="mr-1 h-4 w-4" /> Eigenes Szenario
          </Button>
        )}

        {!showPresets && customScenarios.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t pt-2">
            <span className="text-xs text-muted-foreground">Gespeicherte Szenarien:</span>
            {customScenarios.map((s) => (
              <span key={s.id} className="flex items-center">
                <Button
                  variant={activeId === s.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onSelect(s.id)}
                  title={s.description}
                >
                  {s.name}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label="Szenario löschen"
                  onClick={() => {
                    if (activeId === s.id) onSelect(null);
                    onDeleteScenario(s.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Eine Zeile im Vergleich: Basis → Szenario mit Delta-Tönung. */
function MetricRow({
  label,
  metric,
  format,
  higherIsBetter,
}: {
  label: string;
  metric: ScenarioMetricDelta;
  format: (v: number) => string;
  higherIsBetter: boolean;
}) {
  const improved = higherIsBetter ? metric.delta > 0 : metric.delta < 0;
  const worsened = higherIsBetter ? metric.delta < 0 : metric.delta > 0;
  const tone = improved
    ? 'text-emerald-600 dark:text-emerald-400'
    : worsened
      ? 'text-destructive'
      : 'text-muted-foreground';
  const sign = metric.delta > 0 ? '+' : '';

  return (
    <div className="flex items-center justify-between gap-2 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2 tabular-nums">
        <span className="text-muted-foreground">{format(metric.baseline)}</span>
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
        <span className="font-semibold">{format(metric.scenario)}</span>
        <span className={`w-20 text-right ${tone}`}>
          {sign}
          {format(metric.delta)}
        </span>
      </span>
    </div>
  );
}

function ComparisonGrid({ comparison }: { comparison: ScenarioComparison }) {
  const days = (v: number) => `${Math.round(v)} T`;
  return (
    <div className="rounded-md border p-3">
      <div className="mb-2 flex items-center gap-2">
        <Badge variant="outline">{comparison.scenario.name}</Badge>
        {comparison.firstBreachShiftDays != null && comparison.firstBreachShiftDays !== 0 && (
          <span className="text-xs text-muted-foreground">
            Pufferbruch {comparison.firstBreachShiftDays < 0 ? '' : '+'}
            {comparison.firstBreachShiftDays} Tage
          </span>
        )}
      </div>
      <div className="divide-y">
        <MetricRow
          label="Tiefststand"
          metric={comparison.lowestBalance}
          format={eur.format}
          higherIsBetter
        />
        <MetricRow
          label="Min. Giro"
          metric={comparison.minimumOperatingCash}
          format={eur.format}
          higherIsBetter
        />
        <MetricRow
          label="Endvermögen"
          metric={comparison.endingNetWorth}
          format={eur.format}
          higherIsBetter
        />
        <MetricRow
          label="Tage unter Puffer"
          metric={comparison.daysBelowSafetyBuffer}
          format={days}
          higherIsBetter={false}
        />
      </div>
    </div>
  );
}

/** Baut ein eigenes Szenario aus Name + einer Liste von Modifikatoren. */
function ScenarioBuilder({
  onSave,
  onCancel,
}: {
  onSave: (scenario: ForecastScenario) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [modifiers, setModifiers] = useState<ScenarioModifier[]>([]);

  const valid = name.trim() && modifiers.length > 0;

  return (
    <div className="space-y-3 rounded-md border border-dashed p-3">
      <Input
        placeholder="Szenario-Name (z. B. Sabbatical)"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      {modifiers.length > 0 && (
        <ul className="space-y-1">
          {modifiers.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-2 rounded border px-2 py-1 text-sm"
            >
              <span>{describeModifier(m)}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label="Modifikator entfernen"
                onClick={() => setModifiers((prev) => prev.filter((x) => x.id !== m.id))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ModifierForm onAdd={(m) => setModifiers((prev) => [...prev, m])} />

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Abbrechen
        </Button>
        <Button
          size="sm"
          disabled={!valid}
          onClick={() =>
            onSave({ id: `scn-${Date.now()}`, name: name.trim(), modifiers })
          }
        >
          Szenario speichern
        </Button>
      </div>
    </div>
  );
}

/** Menschenlesbare Kurzbeschreibung eines Modifikators. */
function describeModifier(m: ScenarioModifier): string {
  switch (m.type) {
    case 'income':
    case 'expenses':
    case 'variable': {
      const pct = m.percentChange ?? 0;
      const dir = pct >= 0 ? '+' : '';
      const from = m.fromDate ? ` ab ${m.fromDate}` : '';
      return `${MODIFIER_LABELS[m.type]}: ${dir}${pct} %${from}`;
    }
    case 'interest': {
      const v = m.amount ?? 0;
      return `Zinssatz: ${v >= 0 ? '+' : ''}${v} %-Punkte`;
    }
    case 'oneTime':
      return `${m.label || 'Einmalposten'}: ${eur.format(m.amount ?? 0)} am ${m.date}`;
    case 'recurring':
      return `${m.label || 'Rate'}: ${eur.format(m.amount ?? 0)} ${m.cadence}`;
    case 'flow': {
      const pct = Math.round((m.factor ?? 0) * 100);
      const what = pct === 0 ? 'entfällt' : `auf ${pct} %`;
      const from = m.fromDate ? ` ab ${m.fromDate}` : '';
      return `Erkannter Eintrag ${what}${from}`;
    }
  }
}

function ModifierForm({ onAdd }: { onAdd: (m: ScenarioModifier) => void }) {
  const [type, setType] = useState<ScenarioModifierType>('income');
  const [percent, setPercent] = useState('');
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<'out' | 'in'>('out');
  const [date, setDate] = useState(today());
  const [fromDate, setFromDate] = useState('');
  const [cadence, setCadence] = useState<'monthly' | 'quarterly' | 'annual'>('monthly');

  const isPercent = type === 'income' || type === 'expenses' || type === 'variable';
  const valid = isPercent
    ? percent !== ''
    : type === 'interest'
      ? amount !== ''
      : amount !== '' && Number(amount) > 0;

  const reset = () => {
    setPercent('');
    setAmount('');
    setFromDate('');
  };

  const build = (): ScenarioModifier => {
    const id = `m-${Date.now()}`;
    if (isPercent) {
      return {
        id,
        type,
        percentChange: Number(percent),
        ...(fromDate ? { fromDate } : {}),
      };
    }
    if (type === 'interest') {
      return { id, type, amount: Number(amount) };
    }
    const signed = (direction === 'in' ? 1 : -1) * Number(amount);
    if (type === 'oneTime') {
      return { id, type, amount: signed, date, label: MODIFIER_LABELS.oneTime };
    }
    return {
      id,
      type: 'recurring',
      amount: signed,
      cadence,
      anchorDate: date,
      label: MODIFIER_LABELS.recurring,
    };
  };

  return (
    <div className="grid grid-cols-2 gap-2 rounded-md bg-muted/40 p-2">
      <div className="col-span-2">
        <Label className="mb-1 block text-xs text-muted-foreground">Art</Label>
        <Select value={type} onValueChange={(v) => setType(v as ScenarioModifierType)}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(MODIFIER_LABELS) as ScenarioModifierType[]).map((t) => (
              <SelectItem key={t} value={t}>
                {MODIFIER_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isPercent && (
        <>
          <Input
            type="number"
            inputMode="decimal"
            placeholder="Änderung in %"
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
          />
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            title="Optional: wirksam ab"
          />
        </>
      )}

      {type === 'interest' && (
        <Input
          className="col-span-2"
          type="number"
          inputMode="decimal"
          placeholder="Δ Prozentpunkte (z. B. 1.5)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      )}

      {(type === 'oneTime' || type === 'recurring') && (
        <>
          <Input
            type="number"
            inputMode="decimal"
            min="0"
            placeholder="Betrag"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Select value={direction} onValueChange={(v) => setDirection(v as 'out' | 'in')}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="out">Ausgabe</SelectItem>
              <SelectItem value="in">Einnahme</SelectItem>
            </SelectContent>
          </Select>
          {type === 'recurring' && (
            <Select value={cadence} onValueChange={(v) => setCadence(v as typeof cadence)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monatlich</SelectItem>
                <SelectItem value="quarterly">Vierteljährlich</SelectItem>
                <SelectItem value="annual">Jährlich</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Input
            className={type === 'recurring' ? '' : 'col-span-2'}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </>
      )}

      <Button
        variant="secondary"
        className="col-span-2"
        size="sm"
        disabled={!valid}
        onClick={() => {
          onAdd(build());
          reset();
        }}
      >
        <Plus className="mr-1 h-4 w-4" /> Modifikator hinzufügen
      </Button>
    </div>
  );
}
