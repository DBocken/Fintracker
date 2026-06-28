import { ArrowDownRight, ArrowUpRight, Wallet } from 'lucide-react';
import { useGentleMode } from '@/components/providers/GentleModeProvider';

interface TransactionStatsProps {
  income: number;
  expenses: number;
  balance: number;
  count: number;
  totalTransactions: number;
  currentBalance: string;
}

const eur = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

export function TransactionStats({
  income,
  expenses,
  balance,
  count,
  totalTransactions,
  currentBalance,
}: TransactionStatsProps) {
  const { enabled: gentleModeEnabled } = useGentleMode();

  // Karten-los (Usability-Audit „Karten sind Aktionen"): reines Kennzahlen-
  // Readout ohne Rahmen → wirkt nicht antippbar.
  return (
    <div className="overflow-hidden rounded-xl bg-gradient-to-br from-brand/10 via-premium/15 to-transparent p-5 md:p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet className="h-4 w-4" />
              Kontostand
            </div>
            <div className="mt-1 truncate text-4xl font-semibold tracking-tight md:text-5xl">
              {gentleModeEnabled ? '***' : currentBalance}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4 lg:text-right">
            <div>
              <dt className="flex items-center gap-1 text-xs text-muted-foreground lg:justify-end">
                <ArrowUpRight className="h-3.5 w-3.5 text-positive" />
                Einnahmen
              </dt>
              <dd className="mt-1 text-lg font-semibold">{gentleModeEnabled ? '***' : eur.format(income)}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1 text-xs text-muted-foreground lg:justify-end">
                <ArrowDownRight className="h-3.5 w-3.5" />
                Ausgaben
              </dt>
              <dd className="mt-1 text-lg font-semibold">{gentleModeEnabled ? '***' : eur.format(expenses)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Saldo</dt>
              <dd
                className={`mt-1 text-lg font-semibold ${balance >= 0 ? 'text-positive' : 'text-warning'}`}
              >
                {gentleModeEnabled ? '***' : (balance >= 0 ? '+' : '') + eur.format(balance)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Transaktionen</dt>
              <dd className="mt-1 text-lg font-semibold">
                {count}
                <span className="text-sm font-normal text-muted-foreground"> von {totalTransactions}</span>
              </dd>
            </div>
          </dl>
        </div>
    </div>
  );
}
