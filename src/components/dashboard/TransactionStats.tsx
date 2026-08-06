import { ArrowDownRight, ArrowUpRight, Wallet } from 'lucide-react';
import { useGentleMode } from '@/components/providers/GentleModeProvider';
import { useI18n } from '@/i18n/useI18n';
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber';
import { useMotionQuality } from '@/hooks/useMotionQuality';
import { MOTION_DURATIONS } from '@/lib/motion-tokens';

interface TransactionStatsProps {
  income: number;
  expenses: number;
  balance: number;
  count: number;
  totalTransactions: number;
  /**
   * Kontostand als dominante Zahl links. **Optional**: Screens, die den
   * Kontostand bereits als Hero fuehren (Dashboard), lassen ihn hier weg,
   * damit dieselbe Zahl nicht zweimal gross erscheint und dem Hero die
   * Dominanz nimmt. Die Buchungsseite hat keinen Hero und uebergibt ihn.
   *
   * @see docs/aaa-plus/critic-reports/wp-4.6-art-ux-motion.md — Befund A-1
   */
  currentBalance?: string;
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
  const { t } = useI18n();

  // WP-6.9: Beim Zeitraumwechsel zaehlen die Kennzahlen vom alten auf den
  // neuen Wert, statt zu springen. Das ist der sichtbarste Teil des
  // Uebergangs — der Nutzer sieht, dass es DIESELBE Groesse in einem anderen
  // Zeitraum ist, statt eine neue Zahl vorgesetzt zu bekommen (Design-
  // Prinzip 2: Daten werden aufgebaut, sie poppen nicht auf).
  //
  // Die Dauer kommt aus der Bewegungsstufe des Geraets (WP-7.7); bei
  // reduzierter Bewegung steht dort 0 und der Wert springt bewusst.
  const motion = useMotionQuality();
  const tween = {
    durationMs: motion.duration(MOTION_DURATIONS.default),
    // Im sanften Modus stehen ohnehin nur Sternchen — ein Zaehler dahinter
    // waere reine Rechenlast ohne sichtbares Ergebnis.
    enabled: motion.durationScale > 0 && !gentleModeEnabled,
    // Beim ERSTEN Rendern steht der Wert sofort da. Das Arbeitspaket heisst
    // "Animation zwischen Zeitraeumen" — gemeint ist der Wechsel, nicht der
    // Aufbau. Ein Hochzaehlen beim Laden waere hier ausserdem Doppelung: die
    // Charts daneben bauen sich ohnehin schon auf.
    animateOnMount: false,
  };
  const animatedIncome = useAnimatedNumber(income, tween);
  const animatedExpenses = useAnimatedNumber(expenses, tween);
  const animatedBalance = useAnimatedNumber(balance, tween);

  // Karten-los (Usability-Audit „Karten sind Aktionen"): reines Kennzahlen-
  // Readout ohne Rahmen → wirkt nicht antippbar.
  return (
    <div className="overflow-hidden rounded-xl bg-gradient-to-br from-brand/10 via-premium/15 to-transparent p-5 md:p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          {currentBalance !== undefined && (
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Wallet className="h-4 w-4" />
                {t("transactionStats.accountBalance")}
              </div>
              <div className="mt-1 truncate text-4xl font-semibold tracking-tight md:text-5xl">
                {gentleModeEnabled ? '***' : currentBalance}
              </div>
            </div>
          )}

          {/*
            WP-8.3 — Rangfolge innerhalb der Kennzahlenzeile.

            Befund aus der Gate-Neubewertung: Alle vier Groessen standen auf
            derselben Schriftgroesse und demselben Gewicht. Welche die
            zweitwichtigste ist, sagte die Gestaltung damit nicht — die Zeile
            war eine Aufzaehlung, keine Aussage.

            Die Staffelung folgt der Frage, die der Nutzer nach dem Hero als
            naechste stellt:
            1. Hero: "Wie viel habe ich?" (aktueller Kontostand)
            2. `balance`: "Wie lief dieser Zeitraum?" — die eine Zahl, die das
               beantwortet. Groesser und farbig abgesetzt.
            3. Einnahmen/Ausgaben: ihre Bestandteile. Kleiner.
            4. Buchungsanzahl: kein Geldbetrag, sondern Auskunft ueber den
               Umfang der Auswahl. Am leisesten.
          */}
          <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4 lg:text-right">
            <div>
              <dt className="flex items-center gap-1 text-xs text-muted-foreground lg:justify-end">
                <ArrowUpRight className="h-3.5 w-3.5 text-positive" />
                {t("transactionStats.income")}
              </dt>
              <dd className="mt-1 text-base font-medium">{gentleModeEnabled ? '***' : eur.format(animatedIncome)}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1 text-xs text-muted-foreground lg:justify-end">
                <ArrowDownRight className="h-3.5 w-3.5" />
                {t("transactionStats.expenses")}
              </dt>
              <dd className="mt-1 text-base font-medium">{gentleModeEnabled ? '***' : eur.format(animatedExpenses)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("transactionStats.balance")}</dt>
              <dd
                data-testid="stat-period-balance"
                // `leading-7`: Die Zeilenhoehe bleibt damit exakt die der
                // frueheren `text-lg`-Zeile. Die Rangfolge kostet so keine
                // zusaetzliche Bloeckhoehe — sonst waechst die Kennzahlenzeile
                // und alles darunter verschiebt sich beim Einblenden (CLS).
                className={`mt-1 text-2xl font-semibold leading-7 tracking-tight ${balance >= 0 ? 'text-positive' : 'text-warning'}`}
              >
                {/* Vorzeichen aus dem ZIELwert, nicht aus dem Zaehlerstand:
                    sonst flackerte es beim Nulldurchgang waehrend des
                    Uebergangs zwischen + und -. */}
                {gentleModeEnabled ? '***' : (balance >= 0 ? '+' : '') + eur.format(animatedBalance)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("transactionStats.transactions")}</dt>
              <dd className="mt-1 text-sm font-medium text-muted-foreground">
                {/* Bewusst NICHT animiert: Ein Stueckzaehler, der bei jedem
                    Tastendruck der Live-Suche von 12 ueber 9, 5, 3 auf 1
                    laeuft, liest sich als Stoerung, nicht als Aufbau. Das
                    Zaehlen gilt den Geldbetraegen — dort ist die Zwischenzahl
                    eine Groesse, hier waere sie eine falsche Stueckzahl. */}
                {count}
                <span className="text-sm font-normal text-muted-foreground"> {t("transactionStats.of", "von")} {totalTransactions}</span>
              </dd>
            </div>
          </dl>
        </div>
    </div>
  );
}
