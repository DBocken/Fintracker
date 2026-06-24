import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

/**
 * Szenario-Fragekarten (FinRisk): übersetzen Alltagsfragen in ScenarioPayloads.
 * Keine Freitext-Magie – jede Karte baut ein klar definiertes Payload.
 */
export default function ScenarioQuestionCards({ ctx, onRun, activeId }: Props) {
  const [purchaseAmount, setPurchaseAmount] = useState(3000);
  const [purchaseInDays, setPurchaseInDays] = useState(60);
  const [lossMonthly, setLossMonthly] = useState(2000);
  const [lossMonths, setLossMonths] = useState(3);
  const [costPercent, setCostPercent] = useState(20);
  const [shock, setShock] = useState(4500);
  const [shockDay, setShockDay] = useState(25);
  const [recovery, setRecovery] = useState(1800);
  const [recoveryDay, setRecoveryDay] = useState(70);

  const isActive = (id: string) => activeId === id || activeId?.startsWith(`${id}-`);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <Card data-active={isActive('base-check')}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Reicht mein Geld im normalen Alltag?</CardTitle>
        </CardHeader>
        <CardContent>
          <Button size="sm" variant="secondary" onClick={() => onRun(buildBaseCheckPayload(ctx))}>
            Alltag prüfen
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Kann ich mir eine größere Anschaffung leisten?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Field label="Betrag" value={purchaseAmount} onChange={setPurchaseAmount} suffix="€" />
            <Field label="in Tagen" value={purchaseInDays} onChange={setPurchaseInDays} suffix="Tage" />
          </div>
          <Button
            size="sm"
            onClick={() => onRun(buildLargePurchasePayload(purchaseAmount, purchaseInDays, ctx))}
          >
            Durchspielen
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Was passiert, wenn mein Einkommen ausfällt?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Field label="Ausfall/Monat" value={lossMonthly} onChange={setLossMonthly} suffix="€" />
            <Field label="Dauer" value={lossMonths} onChange={setLossMonths} suffix="Monate" />
          </div>
          <Button
            size="sm"
            onClick={() => onRun(buildIncomeLossPayload(lossMonthly, lossMonths, ctx))}
          >
            Durchspielen
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Was, wenn mein Alltag teurer wird?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="Teurer um" value={costPercent} onChange={setCostPercent} suffix="%" />
          <Button size="sm" onClick={() => onRun(buildHigherCostPayload(costPercent, ctx))}>
            Durchspielen
          </Button>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            Auto kaputt, aber später mehr Gehalt? (Schock + Kompensation)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Field label="Schock" value={shock} onChange={setShock} suffix="€" />
            <Field label="Schock-Tag" value={shockDay} onChange={setShockDay} suffix="Tag" />
            <Field label="Kompensation" value={recovery} onChange={setRecovery} suffix="€" />
            <Field label="Komp.-Tag" value={recoveryDay} onChange={setRecoveryDay} suffix="Tag" />
          </div>
          <Button
            size="sm"
            onClick={() =>
              onRun(buildShockRecoveryPayload(shock, shockDay, recovery, recoveryDay, ctx))
            }
          >
            Durchspielen
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
