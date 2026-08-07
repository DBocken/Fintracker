import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trash2, PiggyBank, CalendarPlus, Percent, Target, ArrowRightLeft, Link2Off } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/i18n/useI18n';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { getAccounts } from '@/services/account-service';
import { calculateRequiredContribution } from '@/lib/forecast';
import FinanceErrorState from '@/components/common/FinanceErrorState';
import type { ForecastOverrides } from '@/lib/forecast-types';
import type { ForecastInput } from '@/lib/forecast-types';
import { useMoneyFormat } from '@/hooks/useMoneyFormat';
import { eur, today } from './forecast/forecast-shared';
import {
  BudgetOverrideForm,
  EventForm,
  FundForm,
  RecurringFlowOverrideForm,
  TransferForm,
  getCadenceLabel,
} from './forecast/ForecastForms';


interface Props {
  overrides: ForecastOverrides;
  onChange: (patch: Partial<ForecastOverrides>) => void;
  input?: ForecastInput | null;
  /** Kurzer Puls nach dem Eintragen eines Stresstests (z. B. "budgets"). */
  highlightedSection?: string | null;
  /** Callback, wenn der Puls abgelaufen ist. */
  onHighlightComplete?: () => void;
  /**
   * Sektion, deren „Einstellschrauben" das aktuell gewählte Szenario betrifft.
   * Sie wird aufgeklappt und in Kontrastfarbe markiert – bleibt aber jederzeit
   * direkt bedienbar, auch ohne Szenario.
   */
  activeSection?: string | null;
}

/** Konten, die sinnvoll verzinst werden (Tagesgeld/Spar, Giro). */
const INTEREST_KINDS = new Set(['savings', 'checking']);

/**
 * Planungs-Panel (Stufe 2): Tagesgeld-Zinsen, variable Ausgaben-Budgets,
 * geplante Einmalposten und Rücklagen. Schreibt direkt in die persistierten
 * Forecast-Overrides. Unterstützt Highlighting nach Stresstest-Preset-Anwendung.
 */
export default function ForecastPlanner({ overrides, onChange, input, highlightedSection, onHighlightComplete, activeSection }: Props) {
  const money = useMoneyFormat();
  const { t } = useI18n();
  const {
    data: accounts = [],
    isError: accountsError,
    refetch: refetchAccounts,
  } = useQuery({ queryKey: ['accounts'], queryFn: getAccounts });
  const interestAccounts = accounts.filter((a) => INTEREST_KINDS.has(a.type));
  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? id;
  const [activeHighlight, setActiveHighlight] = useState<string | null>(null);
  // Kontrolliertes Akkordeon, damit ein gewähltes Szenario seine Sektion öffnen
  // kann – der Nutzer kann weiterhin frei auf-/zuklappen.
  const [expanded, setExpanded] = useState<string | undefined>(undefined);

  // Auto-clear highlight after animation completes (2.5s for keyframe animation)
  useEffect(() => {
    if (highlightedSection && highlightedSection !== activeHighlight) {
      setActiveHighlight(highlightedSection);
      const timer = setTimeout(() => {
        setActiveHighlight(null);
        onHighlightComplete?.();
      }, 2500);
      return () => clearTimeout(timer);
    }
    // activeHighlight bewusst nicht in den Deps: nur ein neuer highlightedSection
    // soll den Puls auslösen, nicht das Zurücksetzen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedSection, onHighlightComplete]);

  // Gewähltes Szenario klappt seine Sektion auf, damit die Felder sichtbar sind.
  useEffect(() => {
    if (activeSection) setExpanded(activeSection);
  }, [activeSection]);

  // Hervorhebung einer Sektion: anhaltender Kontrast-Rahmen, solange ein Szenario
  // sie betrifft (activeSection), plus ein kurzer Puls direkt nach dem Eintragen.
  const sectionClass = (sectionId: string) => {
    const active = activeSection === sectionId ? 'rounded-md bg-primary/5 ring-2 ring-primary' : '';
    const pulse = activeHighlight === sectionId ? 'animate-[highlightPulse_2s_ease-out]' : '';
    return `${active} ${pulse}`.trim();
  };

  if (accountsError) return <FinanceErrorState variant="data" onRetry={() => void refetchAccounts()} />;

  return (
    <>
      <style>{`
        @keyframes highlightPulse {
          0% { background-color: hsl(var(--primary) / 0.18); }
          50% { background-color: hsl(var(--primary) / 0.28); }
          100% { background-color: transparent; }
        }
      `}</style>
      <Card>
        <CardContent className="p-2">
          <Accordion
            type="single"
            collapsible
            value={expanded}
            onValueChange={(v) => setExpanded(v || undefined)}
          >
          {/* Zinsen */}
          <AccordionItem value="interest">
            <AccordionTrigger className="px-2 text-sm">
              <span className="flex items-center gap-2">
                <Percent className="h-4 w-4" /> {t('forecast.interestRates')}
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 px-2">
              {interestAccounts.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {t('forecast.noInterestAccounts')}
                </p>
              )}
              {interestAccounts.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3">
                  <Label className="truncate text-sm">{a.name}</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min="0"
                      className="h-9 w-24"
                      value={overrides.accountInterest[a.id] ?? ''}
                      placeholder="0"
                      onChange={(e) => {
                        const next = { ...overrides.accountInterest };
                        const v = e.target.value;
                        if (v === '') delete next[a.id];
                        else next[a.id] = Number(v);
                        onChange({ accountInterest: next });
                      }}
                    />
                    <span className="text-sm text-muted-foreground">{t('forecast.pctPerAnnum')}</span>
                  </div>
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>

          {/* Variable Ausgaben-Budgets */}
          <AccordionItem value="budgets" className={sectionClass('budgets')}>
            <AccordionTrigger className="px-2 text-sm">
              <span className="flex items-center gap-2">
                <Target className="h-4 w-4" /> {t('forecast.variableBudgets')}
                {Object.keys(overrides.categoryBudgets).length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({Object.keys(overrides.categoryBudgets).length})
                  </span>
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 px-2">
              {!input || !input.variableExpenses || input.variableExpenses.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('forecast.noVariableExpenses')}
                </p>
              ) : (
                <BudgetOverrideForm
                  variableExpenses={input.variableExpenses}
                  overrides={overrides}
                  onChange={onChange}
                />
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Wiederkehrende Zahlungen */}
          <AccordionItem value="recurring">
            <AccordionTrigger className="px-2 text-sm">
              <span className="flex items-center gap-2">
                <Link2Off className="h-4 w-4" /> {t('forecast.recurringPayments')}
                {input && (input.allRecurringFlows ?? input.recurringFlows) && (input.allRecurringFlows ?? input.recurringFlows)!.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({(input.allRecurringFlows ?? input.recurringFlows)!.length})
                  </span>
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 px-2">
              {!input || !(input.allRecurringFlows ?? input.recurringFlows)?.length ? (
                <p className="text-sm text-muted-foreground">
                  {t('forecast.noRecurringPayments')}
                </p>
              ) : (
                <RecurringFlowOverrideForm
                  recurringFlows={(input.allRecurringFlows ?? input.recurringFlows)!}
                  overrides={overrides}
                  onChange={onChange}
                />
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Transfers */}
          <AccordionItem value="transfers">
            <AccordionTrigger className="px-2 text-sm">
              <span className="flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4" /> {t('forecast.transfers')}
                {overrides.transfers.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({overrides.transfers.length})
                  </span>
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 px-2">
              {overrides.transfers.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground [&>th]:pb-1.5 [&>th]:font-medium">
                        <th className="text-left">{t('forecast.transfer')}</th>
                        <th className="text-left">{t('forecast.when')}</th>
                        <th className="text-right">{t('forecast.amount')}</th>
                        <th className="w-8" aria-label={t('forecast.action')} />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 [&>tr>td]:py-2">
                      {overrides.transfers.map((transfer) => (
                        <tr key={transfer.id}>
                          <td className="pr-2">
                            <span className="block truncate font-medium">
                              {transfer.name || `${accountName(transfer.fromAccountId)} → ${accountName(transfer.toAccountId)}`}
                            </span>
                          </td>
                          <td className="pr-2 text-xs text-muted-foreground whitespace-nowrap">
                            {transfer.date
                              ? transfer.date
                              : `${getCadenceLabel(t, transfer.cadence ?? '')}${transfer.anchorDate ? ` ab ${transfer.anchorDate}` : ''}`}
                          </td>
                          <td className="text-right font-semibold tabular-nums whitespace-nowrap">
                            {money.mask(eur.format(transfer.amount))}
                          </td>
                          <td className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label={t('forecast.removeTransfer')}
                              onClick={() =>
                                onChange({
                                  transfers: overrides.transfers.filter((x) => x.id !== transfer.id),
                                })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <TransferForm
                accounts={accounts}
                onAdd={(t) => onChange({ transfers: [...overrides.transfers, t] })}
              />
            </AccordionContent>
          </AccordionItem>

          {/* Geplante Posten */}
          <AccordionItem value="events" className={sectionClass('events')}>
            <AccordionTrigger className="px-2 text-sm">
              <span className="flex items-center gap-2">
                <CalendarPlus className="h-4 w-4" /> {t('forecast.plannedItems')}
                {overrides.plannedEvents.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({overrides.plannedEvents.length})
                  </span>
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 px-2">
              {overrides.plannedEvents.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground [&>th]:pb-1.5 [&>th]:font-medium">
                        <th className="text-left">{t('forecast.item')}</th>
                        <th className="text-left">{t('forecast.whenAndAccount')}</th>
                        <th className="text-right">{t('forecast.amount')}</th>
                        <th className="w-8" aria-label={t('forecast.action')} />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 [&>tr>td]:py-2">
                      {overrides.plannedEvents.map((ev) => (
                        <tr key={ev.id}>
                          <td className="pr-2">
                            <span className="block truncate font-medium">{ev.name}</span>
                          </td>
                          <td className="pr-2 text-xs text-muted-foreground">
                            {ev.cadence
                              ? `${getCadenceLabel(t, ev.cadence)} ab ${ev.date}${ev.endDate ? ` bis ${ev.endDate}` : ''}`
                              : ev.date}{' '}
                            · {accountName(ev.accountId)}
                          </td>
                          <td
                            className={`text-right font-semibold tabular-nums whitespace-nowrap ${ev.amount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : ''}`}
                          >
                            {ev.amount >= 0 ? '+' : '−'}
                            {money.mask(eur.format(Math.abs(ev.amount)))}
                          </td>
                          <td className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label={t('forecast.removeItem')}
                              onClick={() =>
                                onChange({
                                  plannedEvents: overrides.plannedEvents.filter((e) => e.id !== ev.id),
                                })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <EventForm
                accounts={accounts}
                onAdd={(ev) => onChange({ plannedEvents: [...overrides.plannedEvents, ev] })}
              />
            </AccordionContent>
          </AccordionItem>

          {/* Rücklagen */}
          <AccordionItem value="funds">
            <AccordionTrigger className="px-2 text-sm">
              <span className="flex items-center gap-2">
                <PiggyBank className="h-4 w-4" /> {t('forecast.reserves')}
                {overrides.sinkingFunds.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({overrides.sinkingFunds.length})
                  </span>
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 px-2">
              {overrides.sinkingFunds.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground [&>th]:pb-1.5 [&>th]:font-medium">
                        <th className="text-left">{t('forecast.reserve')}</th>
                        <th className="text-right">{t('forecast.goal')}</th>
                        <th className="text-right">{t('forecast.due')}</th>
                        <th className="text-right">{t('forecast.perMonth')}</th>
                        <th className="w-8" aria-label={t('forecast.action')} />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 [&>tr>td]:py-2">
                      {overrides.sinkingFunds.map((f) => (
                        <tr key={f.id}>
                          <td className="pr-2">
                            <span className="block truncate font-medium">{f.name}</span>
                          </td>
                          <td className="text-right tabular-nums whitespace-nowrap">
                            {money.mask(eur.format(f.targetAmount))}
                          </td>
                          <td className="text-right text-xs text-muted-foreground whitespace-nowrap">
                            {f.dueDate}
                          </td>
                          <td className="text-right font-semibold tabular-nums whitespace-nowrap">
                            {money.mask(eur.format(calculateRequiredContribution(f, today())))}
                          </td>
                          <td className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label={t('forecast.removeReserve')}
                              onClick={() =>
                                onChange({
                                  sinkingFunds: overrides.sinkingFunds.filter((x) => x.id !== f.id),
                                })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <FundForm
                accounts={accounts}
                onAdd={(f) => onChange({ sinkingFunds: [...overrides.sinkingFunds, f] })}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
    </>
  );
}
