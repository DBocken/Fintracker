/**
 * Die kleineren Ansichten der Liquiditäts-Fläche: Umschalter, Monatsübersicht,
 * Simulations-Steuerung und die Liste der aktiven Annahmen.
 *
 * Alle vier waren in `LiquidityReport.tsx` bereits eigene Funktionen — sie
 * lagen nur in derselben Datei wie die Abfragen und die grosse Liniengrafik.
 */
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Dices, Grid3x3, LineChart, LoaderCircle, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useI18n } from '@/i18n/useI18n';
import { useMoneyFormat } from '@/hooks/useMoneyFormat';
import { cn } from '@/lib/utils';
import DeltaBadge from '@/components/common/DeltaBadge';
import type { ForecastMonthlySummary } from '@/lib/forecast-types';
import type { OverrideChange } from '@/lib/forecast-overrides-summary';
import { eur, fmtMonth, type ChartView } from './chart-shared';

/** Segmentierter Umschalter zwischen Linien- und Heatmap-Ansicht. */
export function ChartViewToggle({ value, onChange }: { value: ChartView; onChange: (v: ChartView) => void }) {
  const { t } = useI18n();
  const opt = (v: ChartView, label: string, Icon: typeof LineChart) => (
    <button
      type="button"
      onClick={() => onChange(v)}
      aria-pressed={value === v}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium transition-colors ${
        value === v ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
      }`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  );
  return (
    <div role="group" aria-label={t("liquidityReport.viewToggleLabel")} className="inline-flex overflow-hidden rounded-lg border">
      {opt('lines', t("liquidityReport.linesView"), LineChart)}
      {opt('heatmap', t("liquidityReport.heatmapView"), Grid3x3)}
    </div>
  );
}

/**
 * Monatsübersicht als kompakte Tabelle (Prinzip 8 „Karten sind Aktionen" +
 * „kompakter statt Kachel-Raster"): ein einziger, ruhig hinterlegter Block mit
 * einer Zeile pro Monat und dünnen Trennlinien statt einer Karte je Monat. Auf
 * schmalen Screens horizontal scrollbar. „Unter Puffer" wird schwellwertbewusst
 * über eine dezente Zeilentönung + Badge signalisiert (kein Karten-Rahmen).
 */
export function MonthlyOverviewTable({ months }: { months: ForecastMonthlySummary[] }) {
  const money = useMoneyFormat();
  const { t } = useI18n();
  const hasTransfers = months.some((m) => m.transfersOut > 0);
  const hasInterest = months.some((m) => m.interest > 0);
  const shortDate = (iso: string) => {
    try {
      return format(parseISO(iso), 'd.M.', { locale: de });
    } catch {
      return iso;
    }
  };

  return (
    <div className="overflow-x-auto rounded-xl bg-muted/30">
      <table className="w-full min-w-[34rem] text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground [&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
            <th className="text-left">{t("liquidityReport.monthLabel")}</th>
            <th className="text-right">{t("liquidityReport.incomeLabel")}</th>
            <th className="text-right">{t("liquidityReport.fixedExpensesLabel")}</th>
            <th className="text-right">{t("liquidityReport.variableLabel")}</th>
            {hasTransfers && <th className="text-right">{t("liquidityReport.savingsTransferLabel")}</th>}
            {hasInterest && <th className="text-right">{t("liquidityReport.interestLabel")}</th>}
            <th className="text-right">{t("liquidityReport.monthEndLabel")}</th>
            <th className="text-right">{t("liquidityReport.monthLowLabel")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60 [&>tr>td]:px-3 [&>tr>td]:py-2">
          {months.map((m, i) => (
            <tr key={m.month} className={cn('tabular-nums', m.belowSafetyBuffer && 'bg-warning/10')}>
              <td>
                <span className="flex items-center gap-1.5 font-medium">
                  {fmtMonth(m.month)}
                  {m.belowSafetyBuffer && (
                    <Badge variant="outline" className="border-warning text-warning">
                      {t("liquidityReport.belowBufferLabel")}
                    </Badge>
                  )}
                </span>
              </td>
              <td className="text-right text-emerald-600 dark:text-emerald-400">
                {money.mask(eur.format(m.income))}
              </td>
              <td className="text-right">−{money.mask(eur.format(m.fixedExpenses))}</td>
              <td className="text-right">−{money.mask(eur.format(m.variableExpenses))}</td>
              {hasTransfers && (
                <td className="text-right">
                  {m.transfersOut > 0 ? `−${money.mask(eur.format(m.transfersOut))}` : '—'}
                </td>
              )}
              {hasInterest && (
                <td className="text-right text-emerald-600 dark:text-emerald-400">
                  {m.interest > 0 ? `+${money.mask(eur.format(m.interest))}` : '—'}
                </td>
              )}
              <td className="text-right">
                <span className="flex items-center justify-end gap-1.5">
                  {/* Monatsende ggü. Vormonat – schwellwertbewusst (kleine Änderung = neutral). */}
                  {i > 0 && (
                    <DeltaBadge current={m.closingBalance} previous={months[i - 1].closingBalance} />
                  )}
                  <span className="font-semibold">{money.mask(eur.format(m.closingBalance))}</span>
                </span>
              </td>
              <td className="text-right text-xs text-muted-foreground">
                {money.mask(eur.format(m.lowestBalance))} · {shortDate(m.lowestBalanceDate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Steuerung der Wahrscheinlichkeits-Simulation (Durchläufe, Einnahme-Streuung).
 * Die Verteilung selbst liegt in der EINEN Grafik – hier stehen nur die Schalter.
 */
export function SimulationControls({
  trials,
  onTrials,
  incomeUncertain,
  onIncomeUncertain,
  isCalculating,
  contextLabel,
}: {
  trials: number;
  onTrials: (v: number) => void;
  incomeUncertain: boolean;
  onIncomeUncertain: (v: boolean) => void;
  isCalculating: boolean;
  contextLabel: string;
}) {
  const { t } = useI18n();
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Dices className="h-4 w-4" /> {t("liquidityReport.probabilitySimulation")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t("liquidityReport.trialsLabel")}</span>
            <Select value={String(trials)} onValueChange={(v) => onTrials(Number(v))}>
              <SelectTrigger className="h-9 w-24" aria-label={t("liquidityReport.trialsLabel")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[200, 500, 1000].map((t) => (
                  <SelectItem key={t} value={String(t)}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={incomeUncertain}
              onCheckedChange={onIncomeUncertain}
              aria-label={t("liquidityReport.incomeUncertaintyAriaLabel")}
            />
            <span className="text-muted-foreground">{t("liquidityReport.incomeUncertaintyLabel")}</span>
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("liquidityReport.calculatedFor")}: <span className="font-medium text-foreground">{contextLabel}</span>
        </p>
        {isCalculating && (
          <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground" role="status">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            {t("liquidityReport.calculatingProbability")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Aktive Annahmen als entfernbare Chips. Macht sichtbar, welche Eingaben die
 * Prognose gerade vom Ist-Zustand entfernen – kritisch, damit der Nutzer den
 * Chart nicht mit der Realität verwechselt. Jeder Chip lässt sich einzeln lösen.
 */
export function ActiveChangesPanel({
  changes,
  onClear,
}: {
  changes: OverrideChange[];
  onClear: (c: OverrideChange) => void;
}) {
  const { t } = useI18n();
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          {t("liquidityReport.activeAssumptions")}
          {changes.length > 0 && (
            <Badge variant="outline" className="font-normal">
              {changes.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {changes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("liquidityReport.noActiveChanges")}
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {changes.map((c) => (
              <li key={c.id}>
                <span className="inline-flex items-center gap-1 rounded-full border bg-muted/40 py-1 pl-3 pr-1 text-xs">
                  <span className="max-w-[16rem] truncate">{c.label}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 rounded-full"
                    aria-label={t("liquidityReport.removeAssumption").replace("{label}", c.label)}
                    onClick={() => onClear(c)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
