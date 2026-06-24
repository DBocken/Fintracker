import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  HelpCircle,
  Lightbulb,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { ForecastInput, RecurringCadence } from '@/lib/forecast-types';
import type { ForecastScenario } from '@/lib/forecast-scenario-types';
import type { MonteCarloSettings } from '@/components/dashboard/MonteCarloPanel';

type Goal = 'everyday' | 'income-loss' | 'unexpected-cost' | 'purchase';
type Caution = 'simple' | 'balanced' | 'cautious';

export interface WizardSuggestions {
  operatingBalance: number;
  availableBalance: number;
  monthlyIncome: number;
  monthlyFixedExpenses: number;
  monthlyVariableExpenses: number;
  historyConfidence: number;
  recommendedBuffer: number;
  recommendedTrials: number;
  incomeUncertain: boolean;
  reasons: string[];
}

function monthlyFactor(cadence: RecurringCadence, intervalDays?: number): number {
  switch (cadence) {
    case 'weekly': return 52 / 12;
    case 'biweekly': return 26 / 12;
    case 'quarterly': return 1 / 3;
    case 'semiannual': return 1 / 6;
    case 'annual': return 1 / 12;
    case 'custom': return 30 / Math.max(1, intervalDays ?? 30);
    default: return 1;
  }
}

export function deriveWizardSuggestions(input: ForecastInput | null): WizardSuggestions {
  if (!input) {
    return {
      operatingBalance: 0,
      availableBalance: 0,
      monthlyIncome: 0,
      monthlyFixedExpenses: 0,
      monthlyVariableExpenses: 0,
      historyConfidence: 0,
      recommendedBuffer: 1000,
      recommendedTrials: 1000,
      incomeUncertain: true,
      reasons: ['Es liegen noch zu wenige Daten vor. Deshalb rechnen wir zunächst vorsichtig.'],
    };
  }

  const operatingKinds = new Set(['checking', 'cash', 'wallet']);
  const availableKinds = new Set(['checking', 'cash', 'wallet', 'savings']);
  const operatingBalance = input.accounts
    .filter((account) => operatingKinds.has(account.kind))
    .reduce((sum, account) => sum + account.openingBalance, 0);
  const availableBalance = input.accounts
    .filter((account) => account.liquidReserve ?? availableKinds.has(account.kind))
    .reduce((sum, account) => sum + account.openingBalance, 0);

  let monthlyIncome = 0;
  let monthlyFixedExpenses = 0;
  let uncertainIncome = false;
  for (const flow of input.recurringFlows ?? []) {
    const monthly = Math.abs(flow.amount) * monthlyFactor(flow.cadence, flow.intervalDays);
    if (flow.amount >= 0) {
      monthlyIncome += monthly;
      if ((flow.confidence ?? 0.6) < 0.8) uncertainIncome = true;
    } else {
      monthlyFixedExpenses += monthly;
    }
  }

  const variables = input.variableExpenses ?? [];
  const monthlyVariableExpenses = variables.reduce(
    (sum, item) => sum + (item.budgetOverride ?? item.monthlyAmount),
    0,
  );
  const historyConfidence = variables.length
    ? variables.reduce((sum, item) => sum + (item.confidence ?? 0.5), 0) / variables.length
    : 0;
  const monthlyOutflow = monthlyFixedExpenses + monthlyVariableExpenses;
  const recommendedBuffer = Math.ceil(Math.max(500, monthlyOutflow * 0.5) / 100) * 100;
  const sparseHistory = historyConfidence < 0.7;
  const reasons = [
    `Der vorgeschlagene Puffer deckt ungefähr zwei Wochen deiner erkannten Ausgaben (${Math.round(monthlyOutflow)} € pro Monat).`,
    sparseHistory
      ? 'Deine Datenhistorie ist noch kurz oder lückenhaft. Deshalb schlagen wir mehr Testläufe und eine breitere Unsicherheit vor.'
      : 'Mehrere Monate sind vorhanden. Deshalb kann die Schwankung weitgehend aus deinen eigenen Ausgaben abgeleitet werden.',
  ];
  if (uncertainIncome) {
    reasons.push('Mindestens eine Einnahme wurde nur mit mittlerer Sicherheit erkannt; eine kleine Einkommensschwankung ist deshalb sinnvoll.');
  }

  return {
    operatingBalance,
    availableBalance,
    monthlyIncome,
    monthlyFixedExpenses,
    monthlyVariableExpenses,
    historyConfidence,
    recommendedBuffer,
    recommendedTrials: sparseHistory ? 1000 : 500,
    incomeUncertain: uncertainIncome,
    reasons,
  };
}

interface Props {
  input: ForecastInput | null;
  scenarios: ForecastScenario[];
  activeScenarioId: string | null;
  safetyBuffer: number;
  onSafetyBufferChange: (value: number) => void;
  onScenarioSelect: (id: string | null) => void;
  onMonteCarloChange: (patch: Partial<MonteCarloSettings>) => void;
}

const money = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const GOALS: Array<{ id: Goal; title: string; example: string; scenarioId: string | null }> = [
  {
    id: 'everyday',
    title: 'Reicht mein Geld im normalen Alltag?',
    example: 'Beispiel: Bleibt mein Girokonto in den nächsten Monaten über meinem Sicherheitspuffer?',
    scenarioId: null,
  },
  {
    id: 'income-loss',
    title: 'Was passiert, wenn Einkommen wegfällt?',
    example: 'Beispiel: Drei Monate ab heute kommt vorübergehend kein Gehalt.',
    scenarioId: 'preset-job-loss',
  },
  {
    id: 'unexpected-cost',
    title: 'Was passiert bei einer unerwarteten Ausgabe?',
    example: 'Beispiel: Das Auto muss repariert werden – die Versicherung zahlt erst später einen Teil zurück.',
    scenarioId: 'preset-car-breakdown',
  },
  {
    id: 'purchase',
    title: 'Kann ich mir eine größere Anschaffung leisten?',
    example: 'Beispiel: In drei Monaten werden einmalig 3.000 € fällig.',
    scenarioId: 'preset-big-purchase',
  },
];

export default function SimulationWizard({
  input,
  scenarios,
  activeScenarioId,
  safetyBuffer,
  onSafetyBufferChange,
  onScenarioSelect,
  onMonteCarloChange,
}: Props) {
  const suggestions = useMemo(() => deriveWizardSuggestions(input), [input]);
  const initialGoal = GOALS.find((goal) => goal.scenarioId === activeScenarioId)?.id ?? 'everyday';
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<Goal>(initialGoal);
  const [caution, setCaution] = useState<Caution>('balanced');
  const [useSuggestedBuffer, setUseSuggestedBuffer] = useState(true);
  const proposedBuffer = Math.max(safetyBuffer, suggestions.recommendedBuffer);
  const selectedGoal = GOALS.find((item) => item.id === goal)!;
  const selectedScenario = selectedGoal.scenarioId
    ? scenarios.find((scenario) => scenario.id === selectedGoal.scenarioId) ?? null
    : null;

  const startSimulation = () => {
    onScenarioSelect(selectedScenario?.id ?? null);
    if (useSuggestedBuffer) onSafetyBufferChange(proposedBuffer);
    const settings = caution === 'simple'
      ? { trials: 200, incomeUncertain: false }
      : caution === 'cautious'
        ? { trials: 1000, incomeUncertain: true }
        : {
            trials: suggestions.recommendedTrials,
            incomeUncertain: suggestions.incomeUncertain,
          };
    onMonteCarloChange({ enabled: true, ...settings });
    setStep(3);
  };

  return (
    <Card className="overflow-hidden border-brand/30">
      <CardHeader className="space-y-3 bg-brand/5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Badge variant="secondary" className="mb-2">Geführte Simulation</Badge>
            <CardTitle className="text-lg">Was möchtest du über deine Zukunft wissen?</CardTitle>
          </div>
          <Sparkles className="h-5 w-5 shrink-0 text-brand" />
        </div>
        <div className="flex gap-1" aria-label={`Schritt ${Math.min(step + 1, 4)} von 4`}>
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className={`h-1.5 flex-1 rounded-full ${index <= step ? 'bg-brand' : 'bg-muted'}`} />
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-4 sm:p-6">
        {step === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Du brauchst keine Fachbegriffe. Wähle einfach die Frage, die dir gerade im Kopf herumgeht.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {GOALS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setGoal(item.id)}
                  className={`rounded-xl border p-4 text-left transition-colors ${goal === item.id ? 'border-brand bg-brand/10' : 'hover:bg-muted/50'}`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 grid h-5 w-5 place-items-center rounded-full border ${goal === item.id ? 'border-brand bg-brand text-white' : ''}`}>
                      {goal === item.id && <Check className="h-3 w-3" />}
                    </span>
                    <span>
                      <span className="block font-medium">{item.title}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{item.example}</span>
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold">Das haben wir bereits für dich übernommen</h3>
              <p className="text-sm text-muted-foreground">
                Die Werte stammen aus deinen Konten, erkannten Verträgen und bisherigen Buchungen.
              </p>
            </div>

            {/* Kontostände mit Confidence-Styling */}
            <div className="grid grid-cols-3 gap-3">
              <DataPoint
                label="Direkt verfügbar"
                value={money.format(suggestions.operatingBalance)}
                explanation="Giro, Bargeld und Wallets"
              />
              <DataPoint
                label="Mit Reserven"
                value={money.format(suggestions.availableBalance)}
                explanation="Zusätzlich kurzfristige Sparkonten"
              />
              <DataPoint
                label="Datengrundlage"
                value={`${Math.round(suggestions.historyConfidence * 100)} %`}
                explanation="Je höher, desto weniger Annahmen"
                tone={suggestions.historyConfidence >= 0.7 ? 'good' : suggestions.historyConfidence >= 0.4 ? 'warning' : 'critical'}
              />
            </div>

            {/* Kontostand-Warnung */}
            {suggestions.operatingBalance < suggestions.monthlyFixedExpenses && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Dein verfügbarer Kontostand ({money.format(suggestions.operatingBalance)}) liegt unter deinen monatlichen Fixkosten ({money.format(suggestions.monthlyFixedExpenses)}). Das kann kurzfristig zu Engpässen führen.
                </AlertDescription>
              </Alert>
            )}

            {/* Cash-Flow-Diagramm + Monatliche Kaufkraft */}
            <CashFlowBar
              income={suggestions.monthlyIncome}
              fixed={suggestions.monthlyFixedExpenses}
              variable={suggestions.monthlyVariableExpenses}
            />

            {/* Kontotypen-Breakdown */}
            {input?.accounts && input.accounts.length > 0 && (
              <AccountKindBreakdown accounts={input.accounts} />
            )}

            {/* Warum diese Vorschläge */}
            <div className="rounded-xl bg-muted/50 p-4">
              <div className="mb-2 flex items-center gap-2 font-medium">
                <Lightbulb className="h-4 w-4 text-warning" /> Warum diese Vorschläge?
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {suggestions.reasons.map((reason) => <li key={reason}>• {reason}</li>)}
              </ul>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold">Wie vorsichtig sollen wir rechnen?</h3>
              <p className="text-sm text-muted-foreground">
                Vorsicht bedeutet: Wir testen mehr ungünstige Kombinationen. Es ist keine Vorhersage, sondern ein Belastungstest.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <CautionChoice id="simple" selected={caution} onSelect={setCaution} title="Schneller Überblick" text="200 Tests. Gut zum ersten Ausprobieren." />
              <CautionChoice id="balanced" selected={caution} onSelect={setCaution} title="Ausgewogen" text={`${suggestions.recommendedTrials} Tests auf Basis deiner Daten. Empfohlen.`} recommended />
              <CautionChoice id="cautious" selected={caution} onSelect={setCaution} title="Sehr vorsichtig" text="1.000 Tests plus schwankende Einnahmen." />
            </div>
            <button
              type="button"
              onClick={() => setUseSuggestedBuffer((value) => !value)}
              className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left ${useSuggestedBuffer ? 'border-brand bg-brand/5' : ''}`}
            >
              <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border ${useSuggestedBuffer ? 'border-brand bg-brand text-white' : ''}`}>
                {useSuggestedBuffer && <Check className="h-3 w-3" />}
              </span>
              <span>
                <span className="block font-medium">Sicherheitspuffer von {money.format(proposedBuffer)} verwenden</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {safetyBuffer > suggestions.recommendedBuffer
                    ? `Dein bisheriger Puffer ist höher als unser Mindestvorschlag. Wir senken ihn nicht automatisch.`
                    : `Vorschlag: ungefähr zwei Wochen deiner erkannten monatlichen Ausgaben.`}
                  {' '}Aktuell eingestellt: {money.format(safetyBuffer)}.
                </span>
              </span>
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-500/15 text-emerald-600">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold">Deine Simulation ist vorbereitet</h3>
              <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">
                Wir prüfen jetzt „{selectedGoal.title}“ mit {caution === 'simple' ? 200 : caution === 'cautious' ? 1000 : suggestions.recommendedTrials} unterschiedlichen Verläufen. Unter dem Wizard siehst du nicht nur einen Mittelwert, sondern auch ungünstige und günstige Bandbreiten.
              </p>
            </div>
            <Button variant="outline" onClick={() => setStep(0)}>Andere Frage durchspielen</Button>
          </div>
        )}

        {step < 3 && (
          <div className="flex items-center justify-between border-t pt-4">
            <Button variant="ghost" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Zurück
            </Button>
            {step < 2 ? (
              <Button onClick={() => setStep((value) => value + 1)}>
                Weiter <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={startSimulation}>
                Simulation starten <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DataPoint({
  label,
  value,
  explanation,
  tone = 'default',
}: {
  label: string;
  value: string;
  explanation: string;
  tone?: 'default' | 'good' | 'warning' | 'critical';
}) {
  const valueClass =
    tone === 'good' ? 'text-positive' :
    tone === 'warning' ? 'text-warning' :
    tone === 'critical' ? 'text-destructive' :
    '';
  return (
    <div className="rounded-xl border p-3">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {label} <HelpCircle className="h-3 w-3" aria-hidden />
      </div>
      <div className={`mt-1 text-lg font-bold ${valueClass}`}>{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{explanation}</div>
    </div>
  );
}

const KIND_LABELS: Record<string, string> = {
  checking: 'Girokonto',
  cash: 'Bargeld',
  wallet: 'Wallet',
  savings: 'Sparkonto',
  credit_card: 'Kreditkarte',
  investment: 'Depot',
  loan: 'Kredit',
  other: 'Sonstige',
};

function CashFlowBar({ income, fixed, variable }: { income: number; fixed: number; variable: number }) {
  const remainder = income - fixed - variable;
  const total = Math.max(income, fixed + variable, 1);
  const fixedPct = Math.min((fixed / total) * 100, 100);
  const variablePct = Math.min((variable / total) * 100, Math.max(0, 100 - fixedPct));
  const remainderPct = Math.max(0, 100 - fixedPct - variablePct);
  const overdrawn = remainder < 0;

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Cash-Flow / Monat</span>
        <span className="text-muted-foreground">Einnahmen: {money.format(income)}</span>
      </div>
      <div className="flex h-5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="bg-destructive/70 transition-all"
          style={{ width: `${fixedPct}%` }}
          title={`Fixkosten: ${money.format(fixed)}`}
        />
        <div
          className="bg-warning/70 transition-all"
          style={{ width: `${variablePct}%` }}
          title={`Alltag: ${money.format(variable)}`}
        />
        {!overdrawn && (
          <div
            className="bg-positive/40 transition-all"
            style={{ width: `${remainderPct}%` }}
            title={`Kaufkraft: ${money.format(remainder)}`}
          />
        )}
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-destructive/70" />
          Fixkosten {money.format(fixed)}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-warning/70" />
          Alltag {money.format(variable)}
        </span>
        <span className="flex items-center gap-1">
          <span className={`inline-block h-2 w-2 rounded-full ${overdrawn ? 'bg-destructive' : 'bg-positive/70'}`} />
          Kaufkraft {overdrawn ? '' : '+'}{money.format(remainder)}
        </span>
      </div>
      <div className={`text-center text-xl font-bold ${overdrawn ? 'text-destructive' : 'text-positive'}`}>
        {overdrawn ? '' : '+'}{money.format(remainder)} monatlich verfügbar
      </div>
    </div>
  );
}

function AccountKindBreakdown({ accounts }: { accounts: ForecastInput['accounts'] }) {
  const groups = useMemo(() => {
    const map = new Map<string, number>();
    for (const acc of accounts) {
      map.set(acc.kind, (map.get(acc.kind) ?? 0) + acc.openingBalance);
    }
    return Array.from(map.entries()).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  }, [accounts]);

  const totalAbs = groups.reduce((s, [, v]) => s + Math.abs(v), 0) || 1;

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <div className="text-sm font-medium">Kontotypen-Übersicht</div>
      <div className="space-y-2">
        {groups.map(([kind, balance]) => {
          const pct = (Math.abs(balance) / totalAbs) * 100;
          return (
            <div key={kind} className="flex items-center gap-2 text-sm">
              <span className="w-28 shrink-0 text-muted-foreground">{KIND_LABELS[kind] ?? kind}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${balance >= 0 ? 'bg-brand/60' : 'bg-destructive/60'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className={`w-24 text-right font-medium tabular-nums ${balance < 0 ? 'text-warning' : ''}`}>
                {money.format(balance)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CautionChoice({
  id,
  selected,
  onSelect,
  title,
  text,
  recommended,
}: {
  id: Caution;
  selected: Caution;
  onSelect: (value: Caution) => void;
  title: string;
  text: string;
  recommended?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className={`relative rounded-xl border p-4 text-left ${selected === id ? 'border-brand bg-brand/10' : 'hover:bg-muted/50'}`}
    >
      {recommended && <Badge className="absolute right-2 top-2 text-[10px]">Empfohlen</Badge>}
      <WalletCards className="mb-3 h-5 w-5 text-brand" />
      <span className="block font-medium">{title}</span>
      <span className="mt-1 block text-xs text-muted-foreground">{text}</span>
    </button>
  );
}
