/**
 * Budget-Aktion im Chat: Vorschau → Bestätigen → Rückgängig (WP-I).
 *
 * Die Fläche, an der das Versprechen des Pakets sichtbar wird: Vor dem
 * Klick auf „Bestätigen" ist NICHTS geschrieben. Was passieren würde, steht
 * in einem Satz da — beim Ändern mit Vorher → Nachher, damit die Größe der
 * Änderung sichtbar ist und nicht nur ihr Ergebnis.
 *
 * Alle Beträge laufen durch `money.format` (Sanfter Modus): Ein Budget-Limit
 * ist ein Geldbetrag wie jeder andere.
 */
import { useState } from 'react';
import { ArrowRight, Check, RotateCcw, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/useI18n';
import { useMoneyFormat } from '@/hooks/useMoneyFormat';
import { InfoGroup } from '@/features/shared/presentation/InfoGroup';
import { useBudgetAction } from '@/features/money-questions/application/use-budget-action';
import type { Budget } from '@/lib/budget-types';
import type { BudgetAktionsVorschlag, QuestionAnswer } from '@/lib/question-registry';

function ersetze(text: string, params: Record<string, string>): string {
  return Object.entries(params).reduce((t, [name, wert]) => t.split(`{${name}}`).join(wert), text);
}

export function BudgetAktionAntwort({
  antwort,
  vorschlag,
  budgets,
  aussage,
}: {
  antwort: QuestionAnswer;
  vorschlag: BudgetAktionsVorschlag;
  budgets: readonly Budget[];
  /** Der Fragesatz des Registers („Budget für X anlegen?") — schon eingesetzt. */
  aussage: string;
}) {
  const { t } = useI18n();
  const money = useMoneyFormat();
  const model = useBudgetAction(budgets);
  // Abbrechen ist rein lokal: Es wurde ja noch nichts geschrieben. Der
  // Vorschlag verschwindet, die Frage bleibt beantwortbar.
  const [verworfen, setVerworfen] = useState(false);

  const beschreibung = (() => {
    switch (vorschlag.art) {
      case 'anlegen':
        return ersetze(t('financeQuestions.aktion.anlegen'), {
          name: vorschlag.name,
          betrag: money.format(vorschlag.nachher ?? 0),
        });
      case 'aendern':
        return ersetze(t('financeQuestions.aktion.aendern'), {
          name: vorschlag.name,
          vorher: money.format(vorschlag.vorher ?? 0),
          nachher: money.format(vorschlag.nachher ?? 0),
        });
      case 'loeschen':
        return ersetze(t('financeQuestions.aktion.loeschen'), {
          name: vorschlag.name,
          betrag: money.format(vorschlag.vorher ?? 0),
        });
    }
  })();

  const budgetsLink = (
    <Link
      to={antwort.deepLink}
      className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {t('financeQuestions.aktion.zuBudgets')}
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );

  if (model.stand.art === 'zurueckgenommen' || verworfen) {
    return (
      <InfoGroup title={t('financeQuestions.aktion.vorschauTitle')}>
        <p className="text-sm">{t('financeQuestions.aktion.zurueckgenommen')}</p>
        {budgetsLink}
      </InfoGroup>
    );
  }

  if (model.stand.art === 'erledigt') {
    const erledigt = ersetze(
      t(
        model.stand.vorschlag.art === 'anlegen'
          ? 'financeQuestions.aktion.erledigtAnlegen'
          : model.stand.vorschlag.art === 'aendern'
            ? 'financeQuestions.aktion.erledigtAendern'
            : 'financeQuestions.aktion.erledigtLoeschen',
      ),
      { name: model.stand.vorschlag.name },
    );
    return (
      <InfoGroup title={t('financeQuestions.aktion.vorschauTitle')}>
        <p className="flex items-center gap-2 text-sm">
          <Check className="h-4 w-4 text-positive" aria-hidden="true" />
          {erledigt}
        </p>
        {/*
          Der Rückgängig-Knopf bleibt in der ANTWORT stehen, nicht nur in
          einem Toast: Der Chat ist die Fläche, auf der die Aktion passiert
          ist — dort gehört auch ihr Widerruf hin, und ein Toast wäre nach
          Sekunden verschwunden.
        */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          disabled={model.istAmSchreiben}
          onClick={model.rueckgaengig}
        >
          <RotateCcw className="mr-1 h-3 w-3" aria-hidden="true" />
          {t('financeQuestions.aktion.rueckgaengig')}
        </Button>
        {model.istFehler && (
          <p role="alert" className="mt-2 text-sm">
            {t('financeQuestions.aktion.fehler')}
          </p>
        )}
        {budgetsLink}
      </InfoGroup>
    );
  }

  return (
    <InfoGroup title={t('financeQuestions.aktion.vorschauTitle')}>
      <p className="text-sm">{aussage}</p>
      <p className="mt-1 text-base font-medium">{beschreibung}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={model.istAmSchreiben}
          onClick={() => model.bestaetigen(vorschlag)}
        >
          <Check className="mr-1 h-4 w-4" aria-hidden="true" />
          {t('financeQuestions.aktion.bestaetigen')}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setVerworfen(true)}>
          <X className="mr-1 h-4 w-4" aria-hidden="true" />
          {t('financeQuestions.aktion.abbrechen')}
        </Button>
      </div>

      {model.istFehler && (
        <p role="alert" className="mt-2 text-sm">
          {t('financeQuestions.aktion.fehler')}
        </p>
      )}
      {budgetsLink}
    </InfoGroup>
  );
}
