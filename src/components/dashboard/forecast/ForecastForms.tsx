/**
 * Die Eingabeformulare der Prognose-Planung.
 *
 * Sechs Formulare — Kontoauswahl, geplanter Posten, Rücklage, Budget-Override,
 * Übertrag und der Override je wiederkehrender Zahlung. Alle waren in
 * `ForecastPlanner.tsx` (943 Zeilen) bereits eigene Funktionen; sie lagen nur
 * in derselben Datei wie die Abfrage der Konten und die Akkordeon-Struktur,
 * die sie einbettet.
 */
import { Fragment, useState } from 'react';
import { Plus, Edit2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { DecimalInput } from '@/features/shared/presentation/DecimalInput';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useI18n } from '@/i18n/useI18n';
import { useMoneyFormat } from '@/hooks/useMoneyFormat';
import type {
  ForecastOverrides,
  ForecastTransfer,
  PlannedForecastEvent,
  RecurringFlow,
  SinkingFund,
} from '@/lib/forecast-types';
import { today } from './forecast-shared';

export type AccountLite = { id: string; name: string };

export function AccountSelect({
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
      <SelectTrigger className="h-9 fokussiert:min-h-11" aria-label={placeholder}>
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

export type EventCadence = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'semiannual' | 'annual';

export function EventForm({
  accounts,
  onAdd,
}: {
  accounts: AccountLite[];
  onAdd: (ev: PlannedForecastEvent) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState<number | null>(null);
  const [direction, setDirection] = useState<'out' | 'in'>('out');
  const [accountId, setAccountId] = useState('');
  // Wiederkehrend: macht aus dem Posten z. B. ein neues Gehalt oder einen
  // 603-€-Job, der ab `date` zykluskorrekt gebucht wird.
  const [isRecurring, setIsRecurring] = useState(false);
  const [cadence, setCadence] = useState<EventCadence>('monthly');
  const [endDate, setEndDate] = useState('');

  const valid = name.trim() && amount !== null && amount > 0 && accountId;

  return (
    <div className="grid grid-cols-2 gap-2 [&_input]:h-9">
      <div className="col-span-2 text-xs font-medium text-muted-foreground">{t('forecast.newItem')}</div>
      <Input placeholder={t('forecast.itemName')} value={name} onChange={(e) => setName(e.target.value)} />
      <Select value={isRecurring ? 'recurring' : 'onetime'} onValueChange={(v) => setIsRecurring(v === 'recurring')}>
        <SelectTrigger className="h-9 fokussiert:min-h-11" aria-label={t('forecast.kindLabel')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="onetime">{t('forecast.oneTime')}</SelectItem>
          <SelectItem value="recurring">{t('forecast.recurring')}</SelectItem>
        </SelectContent>
      </Select>
      <DecimalInput
        placeholder={t('forecast.amount')}
        value={amount}
        onChange={setAmount}
      />
      <Select value={direction} onValueChange={(v) => setDirection(v as 'out' | 'in')}>
        <SelectTrigger className="h-9 fokussiert:min-h-11" aria-label={t('forecast.directionLabel')}>
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
                <SelectTrigger className="h-9 fokussiert:min-h-11" aria-label={t('forecast.cadenceLabel')}>
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
          const signed = (direction === 'in' ? 1 : -1) * (amount ?? 0);
          onAdd({
            id: `ev-${Date.now()}`,
            name: name.trim(),
            amount: signed,
            date,
            accountId,
            ...(isRecurring ? { cadence, ...(endDate ? { endDate } : {}) } : {}),
          });
          setName('');
          setAmount(null);
          setEndDate('');
        }}
      >
        <Plus className="mr-1 h-4 w-4" /> {t('forecast.addItem')}
      </Button>
    </div>
  );
}

export function FundForm({
  accounts,
  onAdd,
}: {
  accounts: AccountLite[];
  onAdd: (f: SinkingFund) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [target, setTarget] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [accountId, setAccountId] = useState('');

  const valid = name.trim() && target !== null && target > 0 && dueDate && accountId;

  return (
    <div className="grid grid-cols-2 gap-2 [&_input]:h-9">
      <div className="col-span-2 text-xs font-medium text-muted-foreground">{t('forecast.newReserve')}</div>
      <Input placeholder={t('forecast.reserveName')} value={name} onChange={(e) => setName(e.target.value)} />
      <DecimalInput
        placeholder={t('forecast.targetAmount')}
        value={target}
        onChange={setTarget}
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
            targetAmount: target ?? 0,
            dueDate,
            accountId,
          });
          setName('');
          setTarget(null);
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
          <DecimalInput
            aria-label={t('forecast.budgetFor').replace('{category}', expense.category)}
            placeholder={String(expense.monthlyAmount)}
            value={overrides.categoryBudgets[expense.category] ?? null}
            onChange={(v) => {
              const next = { ...overrides.categoryBudgets };
              if (v === null) delete next[expense.category];
              else next[expense.category] = v;
              onChange({ categoryBudgets: next });
            }}
            className="h-9 w-28 shrink-0 text-right tabular-nums"
          />
        </div>
      ))}
    </div>
  );
}

export function TransferForm({
  accounts,
  onAdd,
}: {
  accounts: AccountLite[];
  onAdd: (t: ForecastTransfer) => void;
}) {
  const { t } = useI18n();
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [date, setDate] = useState(today());
  const [cadence, setCadence] = useState<'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'semiannual' | 'annual'>('monthly');
  const [anchorDate, setAnchorDate] = useState(today());

  const valid =
    fromAccountId && toAccountId && amount !== null && amount > 0 && fromAccountId !== toAccountId;

  return (
    <div className="grid grid-cols-2 gap-2 [&_input]:h-9">
      <div className="col-span-2 text-xs font-medium text-muted-foreground">{t('forecast.newTransfer')}</div>
      <div className="col-span-2">
        <Select value={isRecurring ? 'recurring' : 'onetime'} onValueChange={(v) => setIsRecurring(v === 'recurring')}>
          <SelectTrigger className="h-9 fokussiert:min-h-11" aria-label={t('forecast.kindLabel')}>
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

      <DecimalInput
        placeholder={t('forecast.amount')}
        value={amount}
        onChange={setAmount}
      />

      {isRecurring ? (
        <>
          <Select value={cadence} onValueChange={(v) => setCadence(v as typeof cadence)}>
            <SelectTrigger className="h-9 fokussiert:min-h-11" aria-label={t('forecast.cadenceLabel')}>
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
            amount: amount ?? 0,
            fromAccountId,
            toAccountId,
            ...(isRecurring ? { cadence, anchorDate } : { date }),
          });
          setFromAccountId('');
          setToAccountId('');
          setAmount(null);
          setDate(today());
          setAnchorDate(today());
        }}
      >
        <Plus className="mr-1 h-4 w-4" /> {t('forecast.addTransfer')}
      </Button>
    </div>
  );
}

export function getCadenceLabel(t: (key: string) => string, cadence: string): string {
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
                          <DecimalInput
                            aria-label={t('forecast.amountFor').replace('{flow}', flow.name)}
                            placeholder={String(flow.amount)}
                            value={override?.amount ?? null}
                            onChange={(v) => {
                              const next = { ...overrides.recurringFlowOverrides };
                              if (v === null) {
                                const updated = { ...override };
                                delete updated.amount;
                                if (Object.keys(updated).length > 0) {
                                  next[flow.id] = updated;
                                } else {
                                  delete next[flow.id];
                                }
                              } else {
                                next[flow.id] = { ...override, amount: v };
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
