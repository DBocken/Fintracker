/**
 * Zielrückrechnung im Chat (Welle 3).
 *
 * Das Register hat nur die FRAGE geliefert; die Suche läuft in
 * `useGoalAnswer`. Diese Fläche zeigt das Ergebnis — und in drei Fällen
 * ausdrücklich KEINE Zahl:
 *
 * - **schon ohne Ausgabe unter Deckung** — dann ist nicht die Anschaffung das
 *   Problem, sondern der Stand davor. „0 €" läse sich wie „du darfst nichts
 *   ausgeben" und schickte jemanden auf die falsche Suche.
 * - **schon tragbar** — „0 € monatlich" wäre richtig und missverständlich;
 *   hier steht die Entwarnung.
 * - **auch mit Sparen nicht erreichbar** — dann gibt es keine Rate, die hält,
 *   und eine zu nennen wäre eine Behauptung.
 *
 * Jeder Betrag läuft durch den Sanften Modus (`money.format` maskiert).
 */
import { Link } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/useI18n';
import { useMoneyFormat } from '@/hooks/useMoneyFormat';
import { InfoGroup } from '@/features/shared/presentation/InfoGroup';
import { useGoalAnswer } from '@/features/money-questions/application/use-goal-answer';
import type { Zielfrage } from '@/features/shared/domain/question-registry';

function ersetze(text: string, params: Record<string, string>): string {
  return Object.entries(params).reduce((t, [name, wert]) => t.split(`{${name}}`).join(wert), text);
}

export function ZielAntwort({ ziel }: { ziel: Zielfrage }) {
  const { t } = useI18n();
  const money = useMoneyFormat();
  const model = useGoalAnswer(ziel);

  if (model.isError) {
    return (
      <InfoGroup title={t('financeQuestions.ziel.titel')}>
        <p className="text-sm">{t('financeQuestions.ziel.fehler')}</p>
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={model.refetch}>
          {t('financeQuestions.retry')}
        </Button>
      </InfoGroup>
    );
  }

  if (model.isCalculating) {
    return (
      <InfoGroup title={t('financeQuestions.ziel.titel')}>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('financeQuestions.ziel.rechnet')}
        </p>
      </InfoGroup>
    );
  }

  const sicherheit =
    model.sicherheit === null
      ? null
      : new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 }).format(
          model.sicherheit,
        );

  return (
    <InfoGroup title={t('financeQuestions.ziel.titel')}>
      {model.bereitsUnterDeckung ? (
        <p className="text-sm">{t('financeQuestions.ziel.unterDeckung')}</p>
      ) : model.bereitsTragbar ? (
        <p className="text-sm">{t('financeQuestions.ziel.bereitsTragbar')}</p>
      ) : model.obergrenze !== null ? (
        <>
          <p className="text-2xl font-semibold tabular-nums">{money.format(model.obergrenze)}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {ersetze(t('financeQuestions.ziel.obergrenzeErklaerung'), {
              tage: String(ziel.inTagen),
              sicherheit: sicherheit ?? '—',
            })}
          </p>
        </>
      ) : model.sparrate !== null ? (
        <>
          <p className="text-2xl font-semibold tabular-nums">{money.format(model.sparrate)}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {ersetze(t('financeQuestions.ziel.sparrateErklaerung'), {
              tage: String(ziel.inTagen),
              sicherheit: sicherheit ?? '—',
            })}
          </p>
        </>
      ) : (
        <p className="text-sm">{t('financeQuestions.ziel.unerreichbar')}</p>
      )}

      <Link
        to={
          ziel.betrag !== undefined
            ? `/liquidity?mode=simulation&betrag=${ziel.betrag}&inTagen=${ziel.inTagen}`
            : `/liquidity?mode=simulation&inTagen=${ziel.inTagen}`
        }
        className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {t('financeQuestions.showForecast')}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </InfoGroup>
  );
}
