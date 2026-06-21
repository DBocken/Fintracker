import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2, PiggyBank, CalendarPlus, Percent } from 'lucide-react';
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
import type { PlannedForecastEvent, SinkingFund } from '@/lib/forecast-types';

const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const today = () => new Date().toISOString().slice(0, 10);

interface Props {
  overrides: ForecastOverrides;
  onChange: (patch: Partial<ForecastOverrides>) => void;
}

/** Konten, die sinnvoll verzinst werden (Tagesgeld/Spar, Giro). */
const INTEREST_KINDS = new Set(['savings', 'checking']);

/**
 * Planungs-Panel (Stufe 2): Tagesgeld-Zinsen, geplante Einmalposten und
 * Rücklagen. Schreibt direkt in die persistierten Forecast-Overrides.
 */
export default function ForecastPlanner({ overrides, onChange }: Props) {
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: getAccounts });
  const interestAccounts = accounts.filter((a) => INTEREST_KINDS.has(a.type));
  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? id;

  return (
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

          {/* Geplante Posten */}
          <AccordionItem value="events">
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
