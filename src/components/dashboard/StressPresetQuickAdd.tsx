import { useState } from 'react';
import { ShoppingCart, TrendingDown, Flame, Wrench, type LucideIcon, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { buildStressOverrides, type StressPreset } from '@/lib/forecast-stress-presets';
import type { ForecastOverrides } from '@/services/forecast-overrides-service';
import type { VariableExpenseBaseline } from '@/lib/forecast-types';

interface Props {
  startISO: string;
  accountId: string | null;
  variableExpenses?: VariableExpenseBaseline[];
  overrides: ForecastOverrides;
  onApply: (patch: Partial<ForecastOverrides>) => void;
}

interface PresetConfig {
  id: string;
  label: string;
  icon: LucideIcon;
  title: string;
  disabled: boolean;
  params: PresetParams;
  onSetParam: (key: string, value: number) => void;
}

interface PresetParams {
  purchaseAmount?: number;
  purchaseInDays?: number;
  lossMonthly?: number;
  lossMonths?: number;
  costPercent?: number;
  shock?: number;
  shockDay?: number;
  recovery?: number;
  recoveryDay?: number;
}

function ParamField({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <Input
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : ''}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-8 text-sm"
        />
        {suffix && <span className="whitespace-nowrap text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </label>
  );
}

function PresetButton({
  preset,
  isOpen,
  onToggle,
}: {
  preset: PresetConfig;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const { icon: Icon, label, disabled } = preset;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : isOpen
            ? 'border-primary bg-primary/5'
            : 'border-border hover:bg-muted'
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden />
      <span>{label}</span>
      <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden />
    </button>
  );
}

function PresetPanel({
  preset,
  onApply,
  onClose,
  accountId,
  startISO,
  variableExpenses,
  overrides,
}: {
  preset: PresetConfig;
  onApply: (patch: Partial<ForecastOverrides>) => void;
  onClose: () => void;
  accountId: string | null;
  startISO: string;
  variableExpenses?: VariableExpenseBaseline[];
  overrides: ForecastOverrides;
}) {
  const handleApply = () => {
    if (!accountId) return;

    let stressPreset: StressPreset;

    switch (preset.id) {
      case 'purchase':
        stressPreset = {
          kind: 'purchase',
          amount: preset.params.purchaseAmount ?? 3000,
          inDays: preset.params.purchaseInDays ?? 60,
        };
        break;
      case 'income-loss':
        stressPreset = {
          kind: 'income-loss',
          monthlyLoss: preset.params.lossMonthly ?? 2000,
          months: preset.params.lossMonths ?? 3,
        };
        break;
      case 'higher-cost':
        stressPreset = {
          kind: 'higher-cost',
          percent: preset.params.costPercent ?? 20,
        };
        break;
      case 'shock-recovery':
        stressPreset = {
          kind: 'shock-recovery',
          shock: preset.params.shock ?? 4500,
          shockInDays: preset.params.shockDay ?? 25,
          recovery: preset.params.recovery ?? 1800,
          recoveryInDays: preset.params.recoveryDay ?? 70,
        };
        break;
      default:
        return;
    }

    const patch = buildStressOverrides(overrides, stressPreset, {
      startISO,
      accountId,
      variableExpenses,
      makeId: (s) => `stress-${s}-${Date.now()}`,
    });

    onApply(patch);
    onClose();
  };

  return (
    <Card className="space-y-3 border-primary/20 bg-primary/5 p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{preset.title}</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 hover:bg-muted"
          aria-label="Schließen"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Dynamisch Parameter basierend auf Preset-Typ */}
      <div className="grid gap-2">
        {preset.id === 'purchase' && (
          <>
            <ParamField
              label="Betrag"
              value={preset.params.purchaseAmount ?? 3000}
              onChange={(v) => preset.onSetParam('purchaseAmount', v)}
              suffix="€"
            />
            <ParamField
              label="In Tagen"
              value={preset.params.purchaseInDays ?? 60}
              onChange={(v) => preset.onSetParam('purchaseInDays', v)}
              suffix="Tage"
            />
          </>
        )}

        {preset.id === 'income-loss' && (
          <>
            <ParamField
              label="Ausfall/Monat"
              value={preset.params.lossMonthly ?? 2000}
              onChange={(v) => preset.onSetParam('lossMonthly', v)}
              suffix="€"
            />
            <ParamField
              label="Dauer"
              value={preset.params.lossMonths ?? 3}
              onChange={(v) => preset.onSetParam('lossMonths', v)}
              suffix="Monate"
            />
          </>
        )}

        {preset.id === 'higher-cost' && (
          <ParamField
            label="Teurer um"
            value={preset.params.costPercent ?? 20}
            onChange={(v) => preset.onSetParam('costPercent', v)}
            suffix="%"
          />
        )}

        {preset.id === 'shock-recovery' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <ParamField
                label="Schock"
                value={preset.params.shock ?? 4500}
                onChange={(v) => preset.onSetParam('shock', v)}
                suffix="€"
              />
              <ParamField
                label="Schock-Tag"
                value={preset.params.shockDay ?? 25}
                onChange={(v) => preset.onSetParam('shockDay', v)}
                suffix="Tag"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ParamField
                label="Kompensation"
                value={preset.params.recovery ?? 1800}
                onChange={(v) => preset.onSetParam('recovery', v)}
                suffix="€"
              />
              <ParamField
                label="Komp.-Tag"
                value={preset.params.recoveryDay ?? 70}
                onChange={(v) => preset.onSetParam('recoveryDay', v)}
                suffix="Tag"
              />
            </div>
          </>
        )}
      </div>

      <Button size="sm" className="w-full" onClick={handleApply}>
        Als Annahme eintragen
      </Button>
    </Card>
  );
}

/**
 * Schnell-Annahmen aus typischen Stressfragen: Preset-Buttons, die beim Klick
 * Parameter-Input zeigen und dann die Annahmen direkt in die Planungs-Tabelle
 * schreiben. Betroffene Felder leuchten dann in ForecastPlanner auf.
 */
export default function StressPresetQuickAdd({
  startISO,
  accountId,
  variableExpenses,
  overrides,
  onApply,
}: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  const [params, setParams] = useState<PresetParams>({
    purchaseAmount: 3000,
    purchaseInDays: 60,
    lossMonthly: 2000,
    lossMonths: 3,
    costPercent: 20,
    shock: 4500,
    shockDay: 25,
    recovery: 1800,
    recoveryDay: 70,
  });

  const setParam = (key: string, value: number) => {
    setParams((p) => ({ ...p, [key]: value }));
  };

  const presets: PresetConfig[] = [
    {
      id: 'purchase',
      label: 'Anschaffung',
      icon: ShoppingCart,
      title: 'Größere Anschaffung als geplanten Posten',
      disabled: !accountId,
      params,
      onSetParam: setParam,
    },
    {
      id: 'income-loss',
      label: 'Einkommen weg',
      icon: TrendingDown,
      title: 'Einkommensausfall als monatliche Abflüsse',
      disabled: !accountId,
      params,
      onSetParam: setParam,
    },
    {
      id: 'higher-cost',
      label: 'Teurer',
      icon: Flame,
      title: 'Höhere Lebenshaltung als skalierte Budgets',
      disabled: !variableExpenses || variableExpenses.length === 0,
      params,
      onSetParam: setParam,
    },
    {
      id: 'shock-recovery',
      label: 'Schock + Komp.',
      icon: Wrench,
      title: 'Negativer Schock plus spätere Kompensation',
      disabled: !accountId,
      params,
      onSetParam: setParam,
    },
  ];

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium">Stresstest als Annahme</h3>
        <p className="text-xs text-muted-foreground">Szenario anklicken für Parameter</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <PresetButton
            key={preset.id}
            preset={preset}
            isOpen={openId === preset.id}
            onToggle={() => setOpenId(openId === preset.id ? null : preset.id)}
          />
        ))}
      </div>

      {openId && (
        <PresetPanel
          preset={presets.find((p) => p.id === openId)!}
          onApply={onApply}
          onClose={() => setOpenId(null)}
          accountId={accountId}
          startISO={startISO}
          variableExpenses={variableExpenses}
          overrides={overrides}
        />
      )}
    </div>
  );
}
