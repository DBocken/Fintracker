import { useState, type ReactNode } from 'react';
import { ShoppingCart, TrendingDown, Flame, Wrench, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { buildStressOverrides, type StressPreset } from '@/lib/forecast-stress-presets';
import type { ForecastOverrides } from '@/services/forecast-overrides-service';
import type { VariableExpenseBaseline } from '@/lib/forecast-types';

interface Props {
  /** Forecast-Startdatum (ISO yyyy-mm-dd) als Anker für die relativen Tage. */
  startISO: string;
  /** Operatives Konto, dem die erzeugten Posten zugeordnet werden. */
  accountId: string | null;
  variableExpenses?: VariableExpenseBaseline[];
  overrides: ForecastOverrides;
  onApply: (patch: Partial<ForecastOverrides>) => void;
}

function Field({
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
    <label className="flex flex-1 flex-col gap-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1">
        <Input
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : ''}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-9"
        />
        {suffix && <span className="text-muted-foreground">{suffix}</span>}
      </span>
    </label>
  );
}

/**
 * Ein Stresstest als Chip + Popover. Beim „Eintragen" wird das Preset in echte
 * Annahmen übersetzt (geplante Posten / Budgets) und an die Overrides angehängt –
 * keine zweite Eingabefläche mehr.
 */
function PresetChip({
  label,
  icon: Icon,
  title,
  open,
  onOpenChange,
  onSubmit,
  disabled,
  children,
}: {
  label: string;
  icon: LucideIcon;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="inline-flex shrink-0 snap-start items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
        >
          <Icon className="h-4 w-4" aria-hidden />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3 p-3">
        <div className="text-sm font-medium leading-snug">{title}</div>
        {children}
        <Button size="sm" className="w-full" onClick={onSubmit}>
          Als Annahme eintragen
        </Button>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Schnell-Annahmen aus typischen Stressfragen. Früher waren das die separaten
 * FinRisk-Szenario-Chips mit eigenem Rechenweg; jetzt schreiben sie unter
 * passenden Namen direkt in die Planungs-Annahmen und wirken auf die EINE Grafik.
 */
export default function StressPresetQuickAdd({
  startISO,
  accountId,
  variableExpenses,
  overrides,
  onApply,
}: Props) {
  const [purchaseAmount, setPurchaseAmount] = useState(3000);
  const [purchaseInDays, setPurchaseInDays] = useState(60);
  const [lossMonthly, setLossMonthly] = useState(2000);
  const [lossMonths, setLossMonths] = useState(3);
  const [costPercent, setCostPercent] = useState(20);
  const [shock, setShock] = useState(4500);
  const [shockDay, setShockDay] = useState(25);
  const [recovery, setRecovery] = useState(1800);
  const [recoveryDay, setRecoveryDay] = useState(70);
  const [openId, setOpenId] = useState<string | null>(null);

  const apply = (preset: StressPreset) => {
    if (!accountId) return;
    const patch = buildStressOverrides(overrides, preset, {
      startISO,
      accountId,
      variableExpenses,
      makeId: (s) => `stress-${s}-${Date.now()}`,
    });
    onApply(patch);
    setOpenId(null);
  };
  const openFor = (id: string) => (open: boolean) => setOpenId(open ? id : null);

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">Stresstest als Annahme</span>
        <span className="text-xs text-muted-foreground">tippen für Parameter</span>
      </div>
      <div
        role="group"
        aria-label="Stresstest"
        className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1"
      >
        <PresetChip
          label="Anschaffung"
          icon={ShoppingCart}
          title="Größere Anschaffung als geplanten Posten eintragen"
          open={openId === 'purchase'}
          onOpenChange={openFor('purchase')}
          disabled={!accountId}
          onSubmit={() => apply({ kind: 'purchase', amount: purchaseAmount, inDays: purchaseInDays })}
        >
          <div className="flex gap-2">
            <Field label="Betrag" value={purchaseAmount} onChange={setPurchaseAmount} suffix="€" />
            <Field label="in Tagen" value={purchaseInDays} onChange={setPurchaseInDays} suffix="Tage" />
          </div>
        </PresetChip>

        <PresetChip
          label="Einkommen weg"
          icon={TrendingDown}
          title="Einkommensausfall als monatliche Abflüsse eintragen"
          open={openId === 'income-loss'}
          onOpenChange={openFor('income-loss')}
          disabled={!accountId}
          onSubmit={() => apply({ kind: 'income-loss', monthlyLoss: lossMonthly, months: lossMonths })}
        >
          <div className="flex gap-2">
            <Field label="Ausfall/Monat" value={lossMonthly} onChange={setLossMonthly} suffix="€" />
            <Field label="Dauer" value={lossMonths} onChange={setLossMonths} suffix="Monate" />
          </div>
        </PresetChip>

        <PresetChip
          label="Teurer"
          icon={Flame}
          title="Höhere Lebenshaltung als skalierte Budgets eintragen"
          open={openId === 'higher-cost'}
          onOpenChange={openFor('higher-cost')}
          disabled={!variableExpenses || variableExpenses.length === 0}
          onSubmit={() => apply({ kind: 'higher-cost', percent: costPercent })}
        >
          <Field label="Teurer um" value={costPercent} onChange={setCostPercent} suffix="%" />
        </PresetChip>

        <PresetChip
          label="Schock + Komp."
          icon={Wrench}
          title="Negativer Schock plus spätere Kompensation als zwei Posten"
          open={openId === 'shock-recovery'}
          onOpenChange={openFor('shock-recovery')}
          disabled={!accountId}
          onSubmit={() =>
            apply({
              kind: 'shock-recovery',
              shock,
              shockInDays: shockDay,
              recovery,
              recoveryInDays: recoveryDay,
            })
          }
        >
          <div className="flex flex-wrap gap-2">
            <Field label="Schock" value={shock} onChange={setShock} suffix="€" />
            <Field label="Schock-Tag" value={shockDay} onChange={setShockDay} suffix="Tag" />
            <Field label="Kompensation" value={recovery} onChange={setRecovery} suffix="€" />
            <Field label="Komp.-Tag" value={recoveryDay} onChange={setRecoveryDay} suffix="Tag" />
          </div>
        </PresetChip>
      </div>
    </div>
  );
}
