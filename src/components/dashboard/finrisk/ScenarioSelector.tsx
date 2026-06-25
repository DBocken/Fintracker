import { useState, type ReactNode } from 'react';
import {
  Wallet,
  ShoppingCart,
  TrendingDown,
  Flame,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  buildBaseCheckPayload,
  buildHigherCostPayload,
  buildIncomeLossPayload,
  buildLargePurchasePayload,
  buildShockRecoveryPayload,
  type QuestionContext,
} from '@/lib/finrisk/scenario-questions';
import type { ScenarioPayload } from '@/lib/finrisk/scenario-payload-types';

interface Props {
  ctx: QuestionContext;
  onRun: (payload: ScenarioPayload) => void;
  activeId?: string | null;
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

function chipClass(active: boolean): string {
  return [
    'inline-flex shrink-0 snap-start items-center gap-1.5 rounded-full border px-3 py-1.5',
    'text-sm font-medium transition-colors',
    active
      ? 'border-primary bg-primary text-primary-foreground'
      : 'border-border bg-background hover:bg-muted',
  ].join(' ');
}

/**
 * Ein parametrisches Szenario: Chip im Auswahl-„Wheel" + Popover, in dem die
 * Eingaben erst bei Bedarf erscheinen (kompakt, mobil tauglich).
 */
function ParamChip({
  label,
  icon: Icon,
  title,
  active,
  open,
  onOpenChange,
  onSubmit,
  children,
}: {
  label: string;
  icon: LucideIcon;
  title: string;
  active: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
  children: ReactNode;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button type="button" aria-pressed={active} className={chipClass(active)}>
          <Icon className="h-4 w-4" aria-hidden />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3 p-3">
        <div className="text-sm font-medium leading-snug">{title}</div>
        {children}
        <Button size="sm" className="w-full" onClick={onSubmit}>
          Durchspielen
        </Button>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Szenario-Auswahl (FinRisk): ein horizontal scrollbares Chip-„Wheel" statt
 * fünf dauerhaft offener Karten. Jeder Chip ist einzeln wählbar – die
 * Basisprüfung rechnet sofort, parametrische Szenarien öffnen ein Popover mit
 * ihren Eingaben. So bleibt die Auswahl auf Mobile kompakt und übersichtlich.
 */
export default function ScenarioSelector({ ctx, onRun, activeId }: Props) {
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

  // Aktiv ist ein Szenario, dessen ID exakt oder als Präfix (parametrische IDs
  // tragen Werte im Suffix, z. B. „large-purchase-3000-60") übereinstimmt.
  const isActive = (id: string) => activeId === id || (activeId?.startsWith(`${id}-`) ?? false);

  // Lauf starten und zugehöriges Popover schließen.
  const run = (payload: ScenarioPayload) => {
    onRun(payload);
    setOpenId(null);
  };
  const openFor = (id: string) => (open: boolean) => setOpenId(open ? id : null);

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">Szenario wählen</span>
        <span className="text-xs text-muted-foreground">tippen für Parameter</span>
      </div>

      <div
        role="group"
        aria-label="Szenario"
        className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1"
      >
        {/* Basisprüfung: keine Parameter – sofort rechnen. */}
        <button
          type="button"
          onClick={() => run(buildBaseCheckPayload(ctx))}
          aria-pressed={isActive('base-check')}
          className={chipClass(isActive('base-check'))}
        >
          <Wallet className="h-4 w-4" aria-hidden />
          Alltag
        </button>

        <ParamChip
          label="Anschaffung"
          icon={ShoppingCart}
          title="Kann ich mir eine größere Anschaffung leisten?"
          active={isActive('large-purchase')}
          open={openId === 'large-purchase'}
          onOpenChange={openFor('large-purchase')}
          onSubmit={() => run(buildLargePurchasePayload(purchaseAmount, purchaseInDays, ctx))}
        >
          <div className="flex gap-2">
            <Field label="Betrag" value={purchaseAmount} onChange={setPurchaseAmount} suffix="€" />
            <Field label="in Tagen" value={purchaseInDays} onChange={setPurchaseInDays} suffix="Tage" />
          </div>
        </ParamChip>

        <ParamChip
          label="Einkommen weg"
          icon={TrendingDown}
          title="Was passiert, wenn mein Einkommen ausfällt?"
          active={isActive('income-loss')}
          open={openId === 'income-loss'}
          onOpenChange={openFor('income-loss')}
          onSubmit={() => run(buildIncomeLossPayload(lossMonthly, lossMonths, ctx))}
        >
          <div className="flex gap-2">
            <Field label="Ausfall/Monat" value={lossMonthly} onChange={setLossMonthly} suffix="€" />
            <Field label="Dauer" value={lossMonths} onChange={setLossMonths} suffix="Monate" />
          </div>
        </ParamChip>

        <ParamChip
          label="Teurer"
          icon={Flame}
          title="Was, wenn mein Alltag teurer wird?"
          active={isActive('higher-cost')}
          open={openId === 'higher-cost'}
          onOpenChange={openFor('higher-cost')}
          onSubmit={() => run(buildHigherCostPayload(costPercent, ctx))}
        >
          <Field label="Teurer um" value={costPercent} onChange={setCostPercent} suffix="%" />
        </ParamChip>

        <ParamChip
          label="Schock + Komp."
          icon={Wrench}
          title="Auto kaputt, aber später mehr Gehalt? (Schock + Kompensation)"
          active={isActive('shock-recovery')}
          open={openId === 'shock-recovery'}
          onOpenChange={openFor('shock-recovery')}
          onSubmit={() =>
            run(buildShockRecoveryPayload(shock, shockDay, recovery, recoveryDay, ctx))
          }
        >
          <div className="flex flex-wrap gap-2">
            <Field label="Schock" value={shock} onChange={setShock} suffix="€" />
            <Field label="Schock-Tag" value={shockDay} onChange={setShockDay} suffix="Tag" />
            <Field label="Kompensation" value={recovery} onChange={setRecovery} suffix="€" />
            <Field label="Komp.-Tag" value={recoveryDay} onChange={setRecoveryDay} suffix="Tag" />
          </div>
        </ParamChip>
      </div>
    </div>
  );
}
