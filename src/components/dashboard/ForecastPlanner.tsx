import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2, PiggyBank, CalendarPlus, Percent, Target, ArrowRightLeft, Link2Off, Edit2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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

const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const today = () => new Date().toISOString().slice(0, 10);

interface Props {
  overrides: ForecastOverrides;
  onChange: (patch: Partial<ForecastOverrides>) => void;
  input?: ForecastInput | null;
  /** Accordion section to highlight briefly (e.g., "budgets" for higher-cost preset) */
  highlightedSection?: string | null;
  /** Callback when highlight animation completes */
  onHighlightComplete?: () => void;
}

/** Konten, die sinnvoll verzinst werden (Tagesgeld/Spar, Giro). */
const INTEREST_KINDS = new Set(['savings', 'checking']);

/**
 * Planungs-Panel (Stufe 2): Tagesgeld-Zinsen, variable Ausgaben-Budgets,
 * geplante Einmalposten und Rücklagen. Schreibt direkt in die persistierten
 * Forecast-Overrides. Unterstützt Highlighting nach Stresstest-Preset-Anwendung.
 */
export default function ForecastPlanner({ overrides, onChange, input, highlightedSection, onHighlightComplete }: Props) {
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: getAccounts });
  const interestAccounts = accounts.filter((a) => INTEREST_KINDS.has(a.type));
  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? id;
  const [activeHighlight, setActiveHighlight] = useState<string | null>(null);

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
  }, [highlightedSection, onHighlightComplete]);

  // Define highlight animation styles
  const highlightClass = (sectionId: string) =>
    activeHighlight === sectionId
      ? 'animate-[background-color_0.5s_ease-in-out_0s_1_forwards] bg-primary/10 transition-colors'
      : '';

  return (
    <>
      <style>{`
        @keyframes highlightPulse {
          0% { background-color: hsl(var(--primary) / 0.15); }
          50% { background-color: hsl(var(--primary) / 0.25); }
          100% { background-color: transparent; }
        }
      `}</style>
      <Card>
        <CardContent className="p-2">
          <Accordion type="single" collapsible>
          {/* Zinsen */}
          <AccordionItem value="interest">
            <AccordionTrigger className="px-2 text-sm">
              <span className="flex items-center gap-2">
                <Percent className="h-4 w-4" /> Tagesgeld-Zinsen
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 px-2">
              {interestAccounts.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Keine Tagesgeld-/Giro-Konten gefunden.
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
                    <span className="text-sm text-muted-foreground">% p.a.</span>
                  </div>
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>

          {/* Variable Ausgaben-Budgets */}
          <AccordionItem value="budgets" className={highlightClass('budgets')}>
            <AccordionTrigger className="px-2 text-sm">
              <span className="flex items-center gap-2">
                <Target className="h-4 w-4" /> Variable Budgets
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
                  Keine variablen Ausgaben gefunden.
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
                <Link2Off className="h-4 w-4" /> Wiederkehrende Zahlungen
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
                  Keine wiederkehrenden Zahlungen gefunden.
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
                <ArrowRightLeft className="h-4 w-4" /> Transfers
                {overrides.transfers.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({overrides.transfers.length})
                  </span>
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 px-2">
              {overrides.transfers.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {t.name || `${accountName(t.fromAccountId)} → ${accountName(t.toAccountId)}`}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t.date
                        ? `${t.date}`
                        : `${t.cadence} ${t.anchorDate ? `(ab ${t.anchorDate})` : ''}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{eur.format(t.amount)}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label="Transfer entfernen"
                      onClick={() =>
                        onChange({
                          transfers: overrides.transfers.filter((x) => x.id !== t.id),
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <TransferForm
                accounts={accounts}
                onAdd={(t) => onChange({ transfers: [...overrides.transfers, t] })}
              />
            </AccordionContent>
          </AccordionItem>

          {/* Geplante Posten */}
          <AccordionItem value="events" className={highlightClass('events')}>
            <AccordionTrigger className="px-2 text-sm">
              <span className="flex items-center gap-2">
                <CalendarPlus className="h-4 w-4" /> Geplante Posten
                {overrides.plannedEvents.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({overrides.plannedEvents.length})
                  </span>
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 px-2">
              {overrides.plannedEvents.map((ev) => (
                <div key={ev.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{ev.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {ev.date} · {accountName(ev.accountId)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-semibold ${ev.amount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : ''}`}
                    >
                      {ev.amount >= 0 ? '+' : '−'}
                      {eur.format(Math.abs(ev.amount))}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label="Posten entfernen"
                      onClick={() =>
                        onChange({
                          plannedEvents: overrides.plannedEvents.filter((e) => e.id !== ev.id),
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
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
                <PiggyBank className="h-4 w-4" /> Rücklagen
                {overrides.sinkingFunds.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({overrides.sinkingFunds.length})
                  </span>
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 px-2">
              {overrides.sinkingFunds.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{f.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {eur.format(f.targetAmount)} bis {f.dueDate} ·{' '}
                      {eur.format(calculateRequiredContribution(f, today()))}/Monat
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Rücklage entfernen"
                    onClick={() =>
                      onChange({
                        sinkingFunds: overrides.sinkingFunds.filter((x) => x.id !== f.id),
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
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
      <SelectTrigger className="h-9">
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

function EventForm({
  accounts,
  onAdd,
}: {
  accounts: AccountLite[];
  onAdd: (ev: PlannedForecastEvent) => void;
}) {
  const [name, setName] = useState('');
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<'out' | 'in'>('out');
  const [accountId, setAccountId] = useState('');

  const valid = name.trim() && amount && Number(amount) > 0 && accountId;

  return (
    <div className="grid grid-cols-2 gap-2 rounded-md border border-dashed p-2">
      <Input placeholder="Name (z. B. Urlaub)" value={name} onChange={(e) => setName(e.target.value)} />
      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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
      <div className="col-span-2">
        <AccountSelect accounts={accounts} value={accountId} onValueChange={setAccountId} placeholder="Konto wählen" />
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
          });
          setName('');
          setAmount('');
        }}
      >
        <Plus className="mr-1 h-4 w-4" /> Posten hinzufügen
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
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [accountId, setAccountId] = useState('');

  const valid = name.trim() && target && Number(target) > 0 && dueDate && accountId;

  return (
    <div className="grid grid-cols-2 gap-2 rounded-md border border-dashed p-2">
      <Input placeholder="Name (z. B. Kfz-Steuer)" value={name} onChange={(e) => setName(e.target.value)} />
      <Input
        type="number"
        inputMode="decimal"
        min="0"
        placeholder="Zielbetrag"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
      />
      <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      <AccountSelect accounts={accounts} value={accountId} onValueChange={setAccountId} placeholder="Reservekonto" />
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
        <Plus className="mr-1 h-4 w-4" /> Rücklage anlegen
      </Button>
    </div>
  );
}

function BudgetOverrideForm({
  variableExpenses,
  overrides,
  onChange,
}: {
  variableExpenses: Array<{ category: string; monthlyAmount: number; confidence?: number; budgetOverride?: number }>;
  overrides: ForecastOverrides;
  onChange: (patch: Partial<ForecastOverrides>) => void;
}) {
  const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

  const getConfidenceBadge = (confidence?: number) => {
    if (!confidence) return null;
    const pct = Math.round(confidence * 100);
    if (pct >= 75) return 'text-emerald-600 dark:text-emerald-400';
    if (pct >= 50) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-orange-600 dark:text-orange-400';
  };

  return (
    <div className="space-y-3">
      {variableExpenses.map((expense) => (
        <div key={expense.category} className="rounded-md border p-3">
          <div className="mb-2 flex items-center justify-between">
            <Label className="text-sm font-medium">{expense.category}</Label>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Baseline: {eur.format(expense.monthlyAmount)}</span>
              {expense.confidence != null && (
                <span className={`font-semibold ${getConfidenceBadge(expense.confidence)}`}>
                  {Math.round(expense.confidence * 100)}%
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder={String(expense.monthlyAmount)}
              value={overrides.categoryBudgets[expense.category] ?? ''}
              onChange={(e) => {
                const next = { ...overrides.categoryBudgets };
                const v = e.target.value;
                if (v === '') delete next[expense.category];
                else next[expense.category] = Number(v);
                onChange({ categoryBudgets: next });
              }}
              className="h-9 flex-1"
            />
            {overrides.categoryBudgets[expense.category] != null && (
              <span className="text-sm font-semibold whitespace-nowrap">
                {eur.format(overrides.categoryBudgets[expense.category])}
              </span>
            )}
          </div>
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
    <div className="grid grid-cols-2 gap-2 rounded-md border border-dashed p-2">
      <div className="col-span-2">
        <Select value={isRecurring ? 'recurring' : 'onetime'} onValueChange={(v) => setIsRecurring(v === 'recurring')}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="onetime">Einmalig</SelectItem>
            <SelectItem value="recurring">Wiederkehrend</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <AccountSelect accounts={accounts} value={fromAccountId} onValueChange={setFromAccountId} placeholder="Von Konto" />
      <AccountSelect accounts={accounts} value={toAccountId} onValueChange={setToAccountId} placeholder="Zu Konto" />

      <Input
        type="number"
        inputMode="decimal"
        min="0"
        placeholder="Betrag"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      {isRecurring ? (
        <>
          <Select value={cadence} onValueChange={(v) => setCadence(v as typeof cadence)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Wöchentlich</SelectItem>
              <SelectItem value="biweekly">Alle 2 Wochen</SelectItem>
              <SelectItem value="monthly">Monatlich</SelectItem>
              <SelectItem value="quarterly">Vierteljährlich</SelectItem>
              <SelectItem value="semiannual">Halbjährlich</SelectItem>
              <SelectItem value="annual">Jährlich</SelectItem>
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
        <Plus className="mr-1 h-4 w-4" /> Transfer hinzufügen
      </Button>
    </div>
  );
}

const CADENCE_LABELS: Record<string, string> = {
  weekly: 'Wöchentlich',
  biweekly: '2-wöchentlich',
  monthly: 'Monatlich',
  quarterly: 'Vierteljährlich',
  semiannual: 'Halbjährlich',
  annual: 'Jährlich',
  custom: 'Individuell',
};

function RecurringFlowOverrideForm({
  recurringFlows,
  overrides,
  onChange,
}: {
  recurringFlows: RecurringFlow[];
  overrides: ForecastOverrides;
  onChange: (patch: Partial<ForecastOverrides>) => void;
}) {
  const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
  const [expandedFlow, setExpandedFlow] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      {recurringFlows.map((flow) => {
        const override = overrides.recurringFlowOverrides[flow.id];
        // flow.disabled = auto-deaktiviert durch Vertragsstatus (ended/stale)
        // override?.enabled === false = nutzerseitig abgehakt
        const isAutoDisabled = flow.disabled === true;
        const isUserDisabled = override?.enabled === false;
        const isDisabled = isAutoDisabled || isUserDisabled;
        const displayAmount = override?.amount ?? flow.amount;
        const isIncome = displayAmount > 0;

        return (
          <div
            key={flow.id}
            className={`rounded-md border p-3 transition-opacity ${isDisabled ? 'opacity-50' : ''}`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!isDisabled}
                    disabled={isAutoDisabled}
                    title={isAutoDisabled ? 'Vertrag ist beendet oder veraltet – Status in Verträge ändern' : undefined}
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
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-medium">{flow.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {CADENCE_LABELS[flow.cadence] ?? flow.cadence}
                  </span>
                  {isAutoDisabled && (
                    <span className="text-xs text-muted-foreground italic">beendet</span>
                  )}
                </div>
                <div className={`text-xs mt-1 ${isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                  {isIncome ? '+' : ''}{eur.format(displayAmount)}
                  {flow.category && <span className="ml-1 text-muted-foreground">· {flow.category}</span>}
                </div>
              </div>

              {!isAutoDisabled && (
                <button
                  onClick={() => setExpandedFlow(expandedFlow === flow.id ? null : flow.id)}
                  className="p-1.5 hover:bg-muted rounded transition-colors"
                  aria-label="Bearbeiten"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              )}
            </div>

            {expandedFlow === flow.id && !isAutoDisabled && (
              <div className="mt-3 space-y-2 border-t pt-3">
                <div>
                  <Label className="text-xs">Betrag</Label>
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
                  <Label className="text-xs">End-Datum (optional)</Label>
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
            )}
          </div>
        );
      })}
    </div>
  );
}
