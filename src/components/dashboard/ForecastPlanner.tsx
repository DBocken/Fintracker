import { Fragment, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2, PiggyBank, CalendarPlus, Percent, Target, ArrowRightLeft, Link2Off, Edit2 } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getAccounts } from '@/services/account-service';
import { calculateRequiredContribution } from '@/lib/forecast';
import type { ForecastOverrides } from '@/services/forecast-overrides-service';
import type { PlannedForecastEvent, SinkingFund, ForecastInput, ForecastTransfer, RecurringFlow } from '@/lib/forecast-types';
import { useMoneyFormat } from '@/hooks/useMoneyFormat';

const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const today = () => new Date().toISOString().slice(0, 10);

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
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: getAccounts });
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

type AccountLite = { id: string; name: string };

function AccountSelect({
  accounts,
  value,
  onValueChange,
  placeholder,
}: {
  accounts: AccountLite[];
  value: string;
  onValueChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-9" aria-label={placeholder}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {accounts.map((a) => (
          <SelectItem key={a.id} value={a.id}>
            {a.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

type EventCadence = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'semiannual' | 'annual';

function EventForm({
  accounts,
  onAdd,
}: {
  accounts: AccountLite[];
  onAdd: (ev: PlannedForecastEvent) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<'out' | 'in'>('out');
  const [accountId, setAccountId] = useState('');
  // Wiederkehrend: macht aus dem Posten z. B. ein neues Gehalt oder einen
  // 603-€-Job, der ab `date` zykluskorrekt gebucht wird.
  const [isRecurring, setIsRecurring] = useState(false);
  const [cadence, setCadence] = useState<EventCadence>('monthly');
  const [endDate, setEndDate] = useState('');

  const valid = name.trim() && amount && Number(amount) > 0 && accountId;

  return (
    <div className="grid grid-cols-2 gap-2 [&_input]:h-9">
      <div className="col-span-2 text-xs font-medium text-muted-foreground">{t('forecast.newItem')}</div>
      <Input placeholder={t('forecast.itemName')} value={name} onChange={(e) => setName(e.target.value)} />
      <Select value={isRecurring ? 'recurring' : 'onetime'} onValueChange={(v) => setIsRecurring(v === 'recurring')}>
        <SelectTrigger className="h-9" aria-label={t('forecast.kindLabel')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="onetime">{t('forecast.oneTime')}</SelectItem>
          <SelectItem value="recurring">{t('forecast.recurring')}</SelectItem>
        </SelectContent>
      </Select>
      <Input
        type="number"
        inputMode="decimal"
        min="0"
        placeholder={t('forecast.amount')}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <Select value={direction} onValueChange={(v) => setDirection(v as 'out' | 'in')}>
        <SelectTrigger className="h-9" aria-label={t('forecast.directionLabel')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="out">{t('forecast.expense')}</SelectItem>
          <SelectItem value="in">{t('forecast.income')}</SelectItem>
        </SelectContent>
      </Select>

      {isRecurring ? (
        <>
          <label className="col-span-2 flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{t('forecast.whenAndFrequency')}</span>
            <div className="grid grid-cols-2 gap-2 [&_input]:h-9">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <Select value={cadence} onValueChange={(v) => setCadence(v as EventCadence)}>
                <SelectTrigger className="h-9" aria-label={t('forecast.cadenceLabel')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">{t('forecast.weekly')}</SelectItem>
                  <SelectItem value="biweekly">{t('forecast.biweekly')}</SelectItem>
                  <SelectItem value="monthly">{t('forecast.monthly')}</SelectItem>
                  <SelectItem value="quarterly">{t('forecast.quarterly')}</SelectItem>
                  <SelectItem value="semiannual">{t('forecast.semiannual')}</SelectItem>
                  <SelectItem value="annual">{t('forecast.annual')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </label>
          <label className="col-span-2 flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{t('forecast.until')}</span>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
        </>
      ) : (
        <Input className="col-span-2" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      )}

      <div className="col-span-2">
        <AccountSelect accounts={accounts} value={accountId} onValueChange={setAccountId} placeholder={t('forecast.selectAccount')} />
      </div>
      <Button
        className="col-span-2"
        disabled={!valid}
        onClick={() => {
          const signed = (direction === 'in' ? 1 : -1) * Number(amount);
          onAdd({
            id: `ev-${Date.now()}`,
            name: name.trim(),
            amount: signed,
            date,
            accountId,
            ...(isRecurring ? { cadence, ...(endDate ? { endDate } : {}) } : {}),
          });
          setName('');
          setAmount('');
          setEndDate('');
        }}
      >
        <Plus className="mr-1 h-4 w-4" /> {t('forecast.addItem')}
      </Button>
    </div>
  );
}

function FundForm({
  accounts,
  onAdd,
}: {
  accounts: AccountLite[];
  onAdd: (f: SinkingFund) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [accountId, setAccountId] = useState('');

  const valid = name.trim() && target && Number(target) > 0 && dueDate && accountId;

  return (
    <div className="grid grid-cols-2 gap-2 [&_input]:h-9">
      <div className="col-span-2 text-xs font-medium text-muted-foreground">{t('forecast.newReserve')}</div>
      <Input placeholder={t('forecast.reserveName')} value={name} onChange={(e) => setName(e.target.value)} />
      <Input
        type="number"
        inputMode="decimal"
        min="0"
        placeholder={t('forecast.targetAmount')}
        value={target}
        onChange={(e) => setTarget(e.target.value)}
      />
      <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      <AccountSelect accounts={accounts} value={accountId} onValueChange={setAccountId} placeholder={t('forecast.reserveAccount')} />
      <Button
        className="col-span-2"
        disabled={!valid}
        onClick={() => {
          onAdd({
            id: `sf-${Date.now()}`,
            name: name.trim(),
            targetAmount: Number(target),
            dueDate,
            accountId,
          });
          setName('');
          setTarget('');
          setDueDate('');
        }}
      >
        <Plus className="mr-1 h-4 w-4" /> {t('forecast.createReserve')}
      </Button>
    </div>
  );
}

export function BudgetOverrideForm({
  variableExpenses,
  overrides,
  onChange,
}: {
  variableExpenses: Array<{ category: string; monthlyAmount: number; confidence?: number; budgetOverride?: number }>;
  overrides: ForecastOverrides;
  onChange: (patch: Partial<ForecastOverrides>) => void;
}) {
  const money = useMoneyFormat();
  const { t } = useI18n();
  const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

  const getConfidenceBadge = (confidence?: number) => {
    if (!confidence) return null;
    const pct = Math.round(confidence * 100);
    if (pct >= 75) return 'text-emerald-600 dark:text-emerald-400';
    if (pct >= 50) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-orange-600 dark:text-orange-400';
  };

  // Kompakte Zeilen mit Trennlinien statt einer Box je Kategorie: Name +
  // Baseline links, Eingabefeld rechts – eine Zeile pro Budget.
  return (
    <div className="divide-y divide-border/60">
      {variableExpenses.map((expense) => (
        <div key={expense.category} className="flex items-center gap-3 py-2">
          <div className="min-w-0 flex-1">
            <Label className="block truncate text-sm font-medium">{expense.category}</Label>
            <div className="text-xs text-muted-foreground">
              {t('forecast.baseline')} {money.mask(eur.format(expense.monthlyAmount))}
              {expense.confidence != null && (
                <span className={`ml-1.5 font-semibold ${getConfidenceBadge(expense.confidence)}`}>
                  {Math.round(expense.confidence * 100)}%
                </span>
              )}
            </div>
          </div>
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            aria-label={t('forecast.budgetFor').replace('{category}', expense.category)}
            placeholder={String(expense.monthlyAmount)}
            value={overrides.categoryBudgets[expense.category] ?? ''}
            onChange={(e) => {
              const next = { ...overrides.categoryBudgets };
              const v = e.target.value;
              if (v === '') delete next[expense.category];
              else next[expense.category] = Number(v);
              onChange({ categoryBudgets: next });
            }}
            className="h-9 w-28 shrink-0 text-right tabular-nums"
          />
        </div>
      ))}
    </div>
  );
}

function TransferForm({
  accounts,
  onAdd,
}: {
  accounts: AccountLite[];
  onAdd: (t: ForecastTransfer) => void;
}) {
  const { t } = useI18n();
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [date, setDate] = useState(today());
  const [cadence, setCadence] = useState<'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'semiannual' | 'annual'>('monthly');
  const [anchorDate, setAnchorDate] = useState(today());

  const valid =
    fromAccountId && toAccountId && amount && Number(amount) > 0 && fromAccountId !== toAccountId;

  return (
    <div className="grid grid-cols-2 gap-2 [&_input]:h-9">
      <div className="col-span-2 text-xs font-medium text-muted-foreground">{t('forecast.newTransfer')}</div>
      <div className="col-span-2">
        <Select value={isRecurring ? 'recurring' : 'onetime'} onValueChange={(v) => setIsRecurring(v === 'recurring')}>
          <SelectTrigger className="h-9" aria-label={t('forecast.kindLabel')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="onetime">{t('forecast.oneTime')}</SelectItem>
            <SelectItem value="recurring">{t('forecast.recurring')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <AccountSelect accounts={accounts} value={fromAccountId} onValueChange={setFromAccountId} placeholder={t('forecast.fromAccount')} />
      <AccountSelect accounts={accounts} value={toAccountId} onValueChange={setToAccountId} placeholder={t('forecast.toAccount')} />

      <Input
        type="number"
        inputMode="decimal"
        min="0"
        placeholder={t('forecast.amount')}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      {isRecurring ? (
        <>
          <Select value={cadence} onValueChange={(v) => setCadence(v as typeof cadence)}>
            <SelectTrigger className="h-9" aria-label={t('forecast.cadenceLabel')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">{t('forecast.weekly')}</SelectItem>
              <SelectItem value="biweekly">{t('forecast.biweekly')}</SelectItem>
              <SelectItem value="monthly">{t('forecast.monthly')}</SelectItem>
              <SelectItem value="quarterly">{t('forecast.quarterly')}</SelectItem>
              <SelectItem value="semiannual">{t('forecast.semiannual')}</SelectItem>
              <SelectItem value="annual">{t('forecast.annual')}</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)} />
        </>
      ) : (
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      )}

      <Button
        className="col-span-2"
        disabled={!valid}
        onClick={() => {
          onAdd({
            id: `tf-${Date.now()}`,
            amount: Number(amount),
            fromAccountId,
            toAccountId,
            ...(isRecurring ? { cadence, anchorDate } : { date }),
          });
          setFromAccountId('');
          setToAccountId('');
          setAmount('');
          setDate(today());
          setAnchorDate(today());
        }}
      >
        <Plus className="mr-1 h-4 w-4" /> {t('forecast.addTransfer')}
      </Button>
    </div>
  );
}

function getCadenceLabel(t: (key: string) => string, cadence: string): string {
  const labels: Record<string, string> = {
    weekly: t('forecast.weekly'),
    biweekly: t('forecast.biweekly'),
    monthly: t('forecast.monthly'),
    quarterly: t('forecast.quarterly'),
    semiannual: t('forecast.semiannual'),
    annual: t('forecast.annual'),
    custom: 'Custom',
  };
  return labels[cadence] ?? cadence;
}

export function RecurringFlowOverrideForm({
  recurringFlows,
  overrides,
  onChange,
}: {
  recurringFlows: RecurringFlow[];
  overrides: ForecastOverrides;
  onChange: (patch: Partial<ForecastOverrides>) => void;
}) {
  const money = useMoneyFormat();
  const { t } = useI18n();
  const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
  const [expandedFlow, setExpandedFlow] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground [&>th]:pb-1.5 [&>th]:font-medium">
            <th className="w-6" aria-label={t('forecast.active')} />
            <th className="text-left">{t('forecast.payment')}</th>
            <th className="text-left">{t('forecast.cycle')}</th>
            <th className="text-right">{t('forecast.amount')}</th>
            <th className="w-8" aria-label={t('forecast.action')} />
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60 [&>tr>td]:py-2">
          {recurringFlows.map((flow) => {
            const override = overrides.recurringFlowOverrides[flow.id];
            // flow.disabled = auto-deaktiviert durch Vertragsstatus (ended/stale)
            // override?.enabled === false = nutzerseitig abgehakt
            const isAutoDisabled = flow.disabled === true;
            const isUserDisabled = override?.enabled === false;
            const isDisabled = isAutoDisabled || isUserDisabled;
            const displayAmount = override?.amount ?? flow.amount;
            const isIncome = displayAmount > 0;
            const isOpen = expandedFlow === flow.id && !isAutoDisabled;

            return (
              <Fragment key={flow.id}>
                <tr className={isDisabled ? 'opacity-50' : undefined}>
                  <td>
                    <input
                      type="checkbox"
                      checked={!isDisabled}
                      disabled={isAutoDisabled}
                      title={isAutoDisabled ? t('forecast.contractEndedOrStale') : undefined}
                      onChange={(e) => {
                        if (isAutoDisabled) return;
                        const next = { ...overrides.recurringFlowOverrides };
                        if (!e.target.checked) {
                          next[flow.id] = { ...override, enabled: false };
                        } else {
                          const updated = { ...override };
                          delete updated.enabled;
                          if (Object.keys(updated).length > 0) {
                            next[flow.id] = updated;
                          } else {
                            delete next[flow.id];
                          }
                        }
                        onChange({ recurringFlowOverrides: next });
                      }}
                      className="h-4 w-4 align-middle"
                    />
                  </td>
                  <td className="pr-2">
                    <span className="block truncate font-medium">{flow.name}</span>
                    {(flow.category || isAutoDisabled) && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {isAutoDisabled ? t('forecast.ended') : flow.category}
                      </span>
                    )}
                  </td>
                  <td className="pr-2 text-xs text-muted-foreground whitespace-nowrap">
                    {getCadenceLabel(t, flow.cadence)}
                  </td>
                  <td
                    className={`text-right font-semibold tabular-nums whitespace-nowrap ${isIncome ? 'text-emerald-600 dark:text-emerald-400' : ''}`}
                  >
                    {isIncome ? '+' : ''}
                    {money.mask(eur.format(displayAmount))}
                  </td>
                  <td className="text-right">
                    {!isAutoDisabled && (
                      <button
                        onClick={() => setExpandedFlow(isOpen ? null : flow.id)}
                        className="rounded p-1.5 transition-colors hover:bg-muted"
                        aria-label={t('common.edit')}
                        aria-expanded={isOpen}
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
                {isOpen && (
                  <tr>
                    <td />
                    <td colSpan={4} className="pb-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <Label className="text-xs">{t('forecast.amount')}</Label>
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            placeholder={String(flow.amount)}
                            value={override?.amount ?? ''}
                            onChange={(e) => {
                              const next = { ...overrides.recurringFlowOverrides };
                              const v = e.target.value;
                              if (v === '') {
                                const updated = { ...override };
                                delete updated.amount;
                                if (Object.keys(updated).length > 0) {
                                  next[flow.id] = updated;
                                } else {
                                  delete next[flow.id];
                                }
                              } else {
                                next[flow.id] = { ...override, amount: Number(v) };
                              }
                              onChange({ recurringFlowOverrides: next });
                            }}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">{t('forecast.endDateOptional')}</Label>
                          <Input
                            type="date"
                            value={override?.endDate ?? ''}
                            onChange={(e) => {
                              const next = { ...overrides.recurringFlowOverrides };
                              const v = e.target.value;
                              if (v === '') {
                                const updated = { ...override };
                                delete updated.endDate;
                                if (Object.keys(updated).length > 0) {
                                  next[flow.id] = updated;
                                } else {
                                  delete next[flow.id];
                                }
                              } else {
                                next[flow.id] = { ...override, endDate: v };
                              }
                              onChange({ recurringFlowOverrides: next });
                            }}
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
