/**
 * Kategorisier-Aktion im Chat: Vorschau → Bestätigen → Rückgängig (Welle 5).
 *
 * Dieselbe Zusage wie bei den Budgets — vor dem Klick ist NICHTS geschrieben.
 * Was diese Fläche zusätzlich leisten muss: **den Unterschied zwischen einer
 * Korrektur und einer Dauerregel sichtbar machen.** Er steckt nicht in der
 * Zahl (dieselben acht Buchungen), sondern in der Reichweite — einmal eine
 * einmalige Änderung, einmal eine eingeschaltete Automatik. Wer das
 * verwechselt, hat eine Regel angelegt, um die er nicht gebeten hat.
 */
import { useState } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/useI18n';
import { InfoGroup } from '@/features/shared/presentation/InfoGroup';
import { useKategorieAction } from '@/features/money-questions/application/use-kategorie-action';
import type { KategorieAktionsVorschlag } from '@/features/shared/domain/question-registry';

function ersetze(text: string, params: Record<string, string>): string {
  return Object.entries(params).reduce((t, [name, wert]) => t.split(`{${name}}`).join(wert), text);
}

export function KategorieAktionAntwort({
  vorschlag,
  aussage,
}: {
  vorschlag: KategorieAktionsVorschlag;
  /** Der Fragesatz des Registers — schon eingesetzt. */
  aussage: string;
}) {
  const { t } = useI18n();
  const model = useKategorieAction();
  // Abbrechen ist rein lokal: Es wurde ja noch nichts geschrieben.
  const [verworfen, setVerworfen] = useState(false);

  const params = {
    haendler: vorschlag.haendler,
    kategorie: vorschlag.kategorieName,
    anzahl: String(vorschlag.anzahl),
  };

  if (model.stand.art === 'zurueckgenommen' || verworfen) {
    return (
      <InfoGroup title={t('financeQuestions.aktion.vorschauTitle')}>
        <p className="text-sm">{t('financeQuestions.aktion.zurueckgenommen')}</p>
      </InfoGroup>
    );
  }

  if (model.stand.art === 'erledigt') {
    return (
      <InfoGroup title={t('financeQuestions.aktion.vorschauTitle')}>
        <p className="flex items-center gap-2 text-sm">
          <Check className="h-4 w-4 text-positive" aria-hidden="true" />
          {ersetze(
            t(
              model.stand.vorschlag.art === 'merken'
                ? 'financeQuestions.kategorieAktion.erledigtMerken'
                : 'financeQuestions.kategorieAktion.erledigtZuordnen',
            ),
            params,
          )}
        </p>
        {/*
          Der Rückgängig-Knopf bleibt in der ANTWORT stehen, nicht in einem
          Toast: Der Chat ist die Fläche, auf der die Aktion passiert ist.
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
      </InfoGroup>
    );
  }

  if (vorschlag.anzahl === 0 && vorschlag.art === 'zuordnen') {
    // Nichts zu tun ist eine Antwort, keine Vorschau: Alle Buchungen tragen
    // die Kategorie bereits. Einen Bestätigen-Knopf anzubieten, der nichts
    // ändert, wäre eine leere Zusage.
    return (
      <InfoGroup title={t('financeQuestions.aktion.vorschauTitle')}>
        <p className="text-sm">{ersetze(t('financeQuestions.kategorieAktion.nichtsZuTun'), params)}</p>
      </InfoGroup>
    );
  }

  return (
    <InfoGroup title={t('financeQuestions.aktion.vorschauTitle')}>
      <p className="text-sm">{aussage}</p>
      <p className="mt-1 text-base font-medium">
        {ersetze(
          t(
            vorschlag.art === 'merken'
              ? 'financeQuestions.kategorieAktion.vorschauMerken'
              : 'financeQuestions.kategorieAktion.vorschauZuordnen',
          ),
          params,
        )}
      </p>
      {vorschlag.art === 'merken' && (
        // Die Reichweite ausdrücklich benannt: Eine Dauerregel wirkt auf
        // Buchungen, die es noch gar nicht gibt.
        <p className="mt-1 text-sm text-muted-foreground">
          {t('financeQuestions.kategorieAktion.reichweite')}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={model.istAmSchreiben}
          onClick={() => model.bestaetigen(vorschlag)}
        >
          <Check className="mr-1 h-3 w-3" aria-hidden="true" />
          {t('financeQuestions.aktion.bestaetigen')}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setVerworfen(true)}>
          <X className="mr-1 h-3 w-3" aria-hidden="true" />
          {t('financeQuestions.aktion.abbrechen')}
        </Button>
      </div>
      {model.istFehler && (
        <p role="alert" className="mt-2 text-sm">
          {t('financeQuestions.aktion.fehler')}
        </p>
      )}
    </InfoGroup>
  );
}
