import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { PiggyBank, Wallet, CreditCard, TrendingUp, ArrowRight, Info } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { FinancialHealth } from "@/services/financial-health-service";

const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

type Tone = "good" | "warn" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  good: "text-positive",
  warn: "text-warning",
  neutral: "text-foreground",
};

/**
 * Eine antippbare Status-Kachel: zeigt einen glasklaren Wert auf einen Blick und
 * öffnet ein Bottom-Sheet mit Erklärung und nächster Aktion. Ganze Kachel ist
 * Touch-Ziel (≥44 px) und per Tastatur erreichbar.
 */
function StatusTile({
  icon,
  label,
  value,
  tone,
  explanation,
  ctaLabel,
  ctaTo,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: Tone;
  explanation: string;
  ctaLabel: string;
  ctaTo: string;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="flex min-h-[88px] flex-col justify-between gap-1 rounded-2xl border bg-card p-3 text-left shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {icon}
            {label}
            <Info className="h-3 w-3 opacity-60" aria-hidden />
          </span>
          <span className={`text-2xl font-bold ${TONE_CLASS[tone]}`}>{value}</span>
        </button>
      </SheetTrigger>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>{label}</SheetTitle>
          <SheetDescription>{explanation}</SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          <Button asChild variant="outline" size="sm">
            <Link to={ctaTo}>
              {ctaLabel}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * 2×2-Statusraster (Audit P1.4): vier glanceable Kennzahlen aus der
 * Finanzgesundheit – Liquidität, Sparquote, Schulden, Monatssaldo – jeweils mit
 * Details und nächster Aktion per Tap. Bewusst numerisch und komplementär zur
 * illustrativen Finanzlandschaft (keine doppelte Score-Darstellung).
 */
export default function CoachStatusGrid({
  health,
  gentle,
}: {
  health: FinancialHealth;
  gentle: boolean;
}) {
  const mask = (v: string) => (gentle ? "***" : v);
  const explanationFor = (key: string) => health.subScores.find((s) => s.key === key)?.explanation ?? "";

  const monthsCovered =
    health.monthlyExpenses > 0 ? health.netWorth.cash / health.monthlyExpenses : health.netWorth.cash > 0 ? 6 : 0;
  const monthlyNet = health.monthlyIncome - health.monthlyExpenses;
  const savingsPct = Math.round(health.savingsRate * 100);

  return (
    <div className="grid grid-cols-2 gap-3">
      <StatusTile
        icon={<Wallet className="h-3.5 w-3.5" />}
        label="Liquidität"
        value={mask(`${monthsCovered.toFixed(1)} Mon.`)}
        tone={monthsCovered >= 3 ? "good" : "warn"}
        explanation={explanationFor("emergency_fund")}
        ctaLabel="Nettovermögen ansehen"
        ctaTo="/net-worth"
      />
      <StatusTile
        icon={<PiggyBank className="h-3.5 w-3.5" />}
        label="Sparquote"
        value={mask(`${savingsPct} %`)}
        tone={savingsPct >= 20 ? "good" : savingsPct >= 0 ? "neutral" : "warn"}
        explanation={explanationFor("savings_rate")}
        ctaLabel="Ausgaben ansehen"
        ctaTo="/dashboard"
      />
      <StatusTile
        icon={<CreditCard className="h-3.5 w-3.5" />}
        label="Schulden"
        value={mask(eur.format(health.netWorth.debts))}
        tone={health.netWorth.debts <= 0 ? "good" : "warn"}
        explanation={explanationFor("debt")}
        ctaLabel="Schulden verwalten"
        ctaTo="/debts"
      />
      <StatusTile
        icon={<TrendingUp className="h-3.5 w-3.5" />}
        label="Monatssaldo"
        value={mask(eur.format(monthlyNet))}
        tone={monthlyNet > 0 ? "good" : monthlyNet === 0 ? "neutral" : "warn"}
        explanation={`Im Schnitt der letzten 3 Monate: ${gentle ? "***" : eur.format(health.monthlyIncome)} Einnahmen, ${gentle ? "***" : eur.format(health.monthlyExpenses)} Ausgaben.`}
        ctaLabel="Details im Dashboard"
        ctaTo="/dashboard"
      />
    </div>
  );
}
