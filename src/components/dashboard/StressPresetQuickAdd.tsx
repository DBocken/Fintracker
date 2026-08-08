import { useState } from 'react';
import { ShoppingCart, TrendingDown, Flame, Wrench, type LucideIcon, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DecimalInput } from '@/components/common/DecimalInput';
import { Card } from '@/components/ui/card';
import { buildStressOverrides, type StressPreset } from '@/lib/forecast-stress-presets';
import type { ForecastOverrides } from '@/lib/forecast-types';
import type { VariableExpenseBaseline } from '@/lib/forecast-types';
import { useI18n } from '@/i18n/useI18n';

interface Props {
  startISO: string;
  accountId: string | null;
  variableExpenses?: VariableExpenseBaseline[];
  overrides: ForecastOverrides;
  onApply: (patch: Partial<ForecastOverrides>) => void;
  /**
   * Meldet, welche Editor-Sektion das gerade gewählte Szenario betrifft (oder
   * null). Der Editor hebt diese „Einstellschrauben" hervor – sie bleiben aber
   * unabhängig vom Szenario jederzeit direkt bedienbar.
   */
  onActiveScenarioChange?: (section: string | null) => void;
}

/** Welche ForecastPlanner-Sektion ein Szenario anfasst (für die Hervorhebung). */
const SECTION_BY_PRESET: Record<string, 'events' | 'budgets'> = {
  purchase: 'events',
  'income-loss': 'events',
  'higher-cost': 'budgets',
  'shock-recovery': 'events',
};

interface PresetConfig {
  id: string;
  label: string;
  icon: LucideIcon;
  title: string;
  disabled: boolean;
  params: PresetParams;
  onSetParam: (key: string, value: number | undefined) => void;
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

/**
 * Ein Parameter-Feld eines Szenarios. `value` ist immer der ausgefuellte Wert
 * oder der Vorgabewert; `undefined` nach aussen heisst „geleert" — dann greift
 * beim Anwenden wieder die Vorgabe, statt dass eine 0 durchschlaegt.
 */
function ParamField({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number | undefined) => void;
  suffix?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <DecimalInput
          value={Number.isFinite(value) ? value : null}
          onChange={(v) => onChange(v ?? undefined)}
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
  const { t } = useI18n();
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
    // Deckend (bg-card) und mit Schatten, weil das Fenster über dem Editor
    // darunter schwebt statt ihn nach unten zu schieben.
    <Card className="space-y-3 border-primary/40 bg-card p-3 shadow-xl">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{preset.title}</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 hover:bg-muted"
          aria-label={t('stressPresetQuickAdd.closeButtonAriaLabel')}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        {t('stressPresetQuickAdd.templateDescription')}
      </p>

      {/* Dynamisch Parameter basierend auf Preset-Typ */}
      <div className="grid gap-2">
        {preset.id === 'purchase' && (
          <>
            <ParamField
              label={t('stressPresetQuickAdd.amountLabel')}
              value={preset.params.purchaseAmount ?? 3000}
              onChange={(v) => preset.onSetParam('purchaseAmount', v)}
              suffix="€"
            />
            <ParamField
              label={t('stressPresetQuickAdd.inDaysLabel')}
              value={preset.params.purchaseInDays ?? 60}
              onChange={(v) => preset.onSetParam('purchaseInDays', v)}
              suffix={t('stressPresetQuickAdd.daysUnit')}
            />
          </>
        )}

        {preset.id === 'income-loss' && (
          <>
            <ParamField
              label={t('stressPresetQuickAdd.lossMonthlyLabel')}
              value={preset.params.lossMonthly ?? 2000}
              onChange={(v) => preset.onSetParam('lossMonthly', v)}
              suffix="€"
            />
            <ParamField
              label={t('stressPresetQuickAdd.durationLabel')}
              value={preset.params.lossMonths ?? 3}
              onChange={(v) => preset.onSetParam('lossMonths', v)}
              suffix={t('stressPresetQuickAdd.monthsUnit')}
            />
          </>
        )}

        {preset.id === 'higher-cost' && (
          <ParamField
            label={t('stressPresetQuickAdd.expensiveByLabel')}
            value={preset.params.costPercent ?? 20}
            onChange={(v) => preset.onSetParam('costPercent', v)}
            suffix="%"
          />
        )}

        {preset.id === 'shock-recovery' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <ParamField
                label={t('stressPresetQuickAdd.shockLabel')}
                value={preset.params.shock ?? 4500}
                onChange={(v) => preset.onSetParam('shock', v)}
                suffix="€"
              />
              <ParamField
                label={t('stressPresetQuickAdd.shockDayLabel')}
                value={preset.params.shockDay ?? 25}
                onChange={(v) => preset.onSetParam('shockDay', v)}
                suffix={t('stressPresetQuickAdd.dayUnit')}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ParamField
                label={t('stressPresetQuickAdd.compensationLabel')}
                value={preset.params.recovery ?? 1800}
                onChange={(v) => preset.onSetParam('recovery', v)}
                suffix="€"
              />
              <ParamField
                label={t('stressPresetQuickAdd.compDayLabel')}
                value={preset.params.recoveryDay ?? 70}
                onChange={(v) => preset.onSetParam('recoveryDay', v)}
                suffix={t('stressPresetQuickAdd.dayUnit')}
              />
            </div>
          </>
        )}
      </div>

      <Button size="sm" className="w-full" onClick={handleApply}>
        {t('stressPresetQuickAdd.applyButtonText')}
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
  onActiveScenarioChange,
}: Props) {
  const { t } = useI18n();
  const [openId, setOpenId] = useState<string | null>(null);

  // Auswahl wechseln und dem Editor melden, welche Sektion hervorzuheben ist.
  const selectPreset = (id: string | null) => {
    setOpenId(id);
    onActiveScenarioChange?.(id ? (SECTION_BY_PRESET[id] ?? null) : null);
  };

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

  const setParam = (key: string, value: number | undefined) => {
    setParams((p) => ({ ...p, [key]: value }));
  };

  const presets: PresetConfig[] = [
    {
      id: 'purchase',
      label: t('stressPresetQuickAdd.purchasePresetLabel'),
      icon: ShoppingCart,
      title: t('stressPresetQuickAdd.purchasePresetTitle'),
      disabled: !accountId,
      params,
      onSetParam: setParam,
    },
    {
      id: 'income-loss',
      label: t('stressPresetQuickAdd.incomeLossPresetLabel'),
      icon: TrendingDown,
      title: t('stressPresetQuickAdd.incomeLossPresetTitle'),
      disabled: !accountId,
      params,
      onSetParam: setParam,
    },
    {
      id: 'higher-cost',
      label: t('stressPresetQuickAdd.higherCostPresetLabel'),
      icon: Flame,
      title: t('stressPresetQuickAdd.higherCostPresetTitle'),
      disabled: !variableExpenses || variableExpenses.length === 0,
      params,
      onSetParam: setParam,
    },
    {
      id: 'shock-recovery',
      label: t('stressPresetQuickAdd.shockRecoveryPresetLabel'),
      icon: Wrench,
      title: t('stressPresetQuickAdd.shockRecoveryPresetTitle'),
      disabled: !accountId,
      params,
      onSetParam: setParam,
    },
  ];

  return (
    // relative: das Detail-Fenster wird absolut darüber gelegt und schiebt den
    // Editor darunter nicht weg.
    <div className="relative space-y-3">
      <div>
        <h3 className="text-sm font-medium">{t('stressPresetQuickAdd.heading')}</h3>
        <p className="text-xs text-muted-foreground">
          {t('stressPresetQuickAdd.helpText')}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <PresetButton
            key={preset.id}
            preset={preset}
            isOpen={openId === preset.id}
            onToggle={() => selectPreset(openId === preset.id ? null : preset.id)}
          />
        ))}
      </div>

      {openId && (
        <div className="absolute inset-x-0 top-full z-50 mt-2">
          <PresetPanel
            preset={presets.find((p) => p.id === openId)!}
            onApply={onApply}
            onClose={() => selectPreset(null)}
            accountId={accountId}
            startISO={startISO}
            variableExpenses={variableExpenses}
            overrides={overrides}
          />
        </div>
      )}
    </div>
  );
}
