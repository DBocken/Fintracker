/**
 * Szenario-Antwort im Chat (WP-H).
 *
 * Drei Schritte, in dieser Reihenfolge sichtbar:
 *
 * 1. **„Verstanden habe ich"** — die erkannten Veränderungen als einzeln
 *    entfernbare Chips (dasselbe Korrektur-Muster wie die Kategorien-Gruppe
 *    aus WP-G): Bevor eine Zahl steht, steht, WORAUS sie entstehen wird.
 *    Ein unbeziffertes Einkommens-Delta fragt hier nach dem Betrag, statt
 *    einen zu erfinden.
 * 2. **Rechenlauf** — die bestehende Monte-Carlo-Engine im Worker
 *    (`useScenarioAnswer`), ein Lauf je abgeschickter Frage bzw. Korrektur.
 * 3. **Kompakt-Ergebnis** — Puffer-Wahrscheinlichkeit (wenn eine Schwelle
 *    gefragt war), Median-Delta am Ende, engster Tag; Details auf
 *    `/liquidity`, vorbelegt über den kodierten Szenario-Parameter.
 *
 * Jeder Betrag läuft durch den Sanften Modus (`money.format` maskiert) —
 * ein einziger unmaskierter Betrag höbe das Versprechen der Fläche auf.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/useI18n';
import { useMoneyFormat } from '@/hooks/useMoneyFormat';
import { InfoGroup } from '@/features/shared/presentation/InfoGroup';
import { DecimalInput } from '@/features/shared/presentation/DecimalInput';
import { useScenarioAnswer } from '@/features/money-questions/application/use-scenario-answer';
import { maxPufferbruch, type DeltaAufloesung } from '@/features/shared/domain/scenario-absicht-payload';
import { encodeScenarioParam } from '@/lib/finrisk/scenario-payload-link';
import type { SzenarioAbsicht } from '@/features/shared/domain/scenario-intent';

function ersetze(text: string, params: Record<string, string>): string {
  return Object.entries(params).reduce(
    (t, [name, wert]) => t.split(`{${name}}`).join(wert),
    text,
  );
}

export function SzenarioAntwort({ absicht: initial }: { absicht: SzenarioAbsicht }) {
  const { t, locale } = useI18n();
  const money = useMoneyFormat();

  // Die Chips korrigieren eine LOKALE Kopie der Absicht — jede Korrektur
  // rechnet neu, ohne dass die Frage neu getippt werden muss. Eine neue
  // abgeschickte Frage setzt die Kopie zurück.
  const [absicht, setAbsicht] = useState(initial);
  useEffect(() => setAbsicht(initial), [initial]);

  const model = useScenarioAnswer(absicht);

  // Bezugspunkt der Tag-Offsets ist das Absenden der Frage — einmal fixiert,
  // damit die Chip-Daten beim Re-Render nicht wandern.
  const [jetzt] = useState(() => new Date());
  const datumFuer = (abTag: number): string =>
    abTag <= 0
      ? t('financeQuestions.szenario.sofort')
      : new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(
          new Date(jetzt.getTime() + abTag * 24 * 60 * 60 * 1000),
        );

  const entferneDelta = (index: number) =>
    setAbsicht((a) => ({ ...a, deltas: a.deltas.filter((_, i) => i !== index) }));

  const beziffereEinkommen = (index: number, betrag: number) =>
    setAbsicht((a) => ({
      ...a,
      deltas: a.deltas.map((d, i) =>
        i === index && d.art === 'einkommen' ? { ...d, betragProMonat: betrag } : d,
      ),
    }));

  const deepLink = useMemo(() => {
    const payload = model.uebersetzung?.payload;
    return payload ? `/liquidity?szenario=${encodeScenarioParam(payload)}` : '/liquidity';
  }, [model.uebersetzung]);

  if (model.isError) {
    return (
      <InfoGroup title={t('financeQuestions.answerTitle')}>
        <p role="alert" className="text-sm">
          {t('financeQuestions.szenario.fehler')}
        </p>
        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={model.refetch}>
          {t('financeQuestions.szenario.erneut')}
        </Button>
      </InfoGroup>
    );
  }

  const bruch = model.result ? maxPufferbruch(model.result, model.uebersetzung?.schwelleEur) : null;
  const engsterTag = model.result?.stressCapacity[0]?.criticalDay;
  const engsterTagIso =
    engsterTag !== undefined ? model.result?.daily[engsterTag]?.date : undefined;

  return (
    <InfoGroup title={t('financeQuestions.szenario.verstandenTitle')}>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('financeQuestions.szenario.verstandenTitle')}>
        {model.uebersetzung?.aufloesungen.map((aufloesung, index) => (
          <DeltaChip
            key={index}
            aufloesung={aufloesung}
            datumFuer={datumFuer}
            geld={money.format}
            onEntfernen={() => entferneDelta(index)}
            onBeziffern={(betrag) => beziffereEinkommen(index, betrag)}
          />
        ))}
        {model.uebersetzung?.schwelleEur !== undefined && (
          <span className="inline-flex items-center rounded-md bg-secondary px-2.5 py-1 text-xs">
            {ersetze(t('financeQuestions.szenario.chipSchwelle'), {
              betrag: money.format(model.uebersetzung.schwelleEur),
            })}
          </span>
        )}
      </div>

      {model.isCalculating && (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {t('financeQuestions.szenario.rechnet')}
        </p>
      )}

      {!model.isCalculating && model.uebersetzung?.payload === null && (
        <p className="mt-3 text-sm">{t('financeQuestions.szenario.nichtsWirksam')}</p>
      )}

      {!model.isCalculating && model.result && (
        <div className="mt-3 space-y-1">
          {bruch !== null && (
            <>
              <p className="text-2xl font-semibold tabular-nums">
                {Math.round((1 - bruch) * 100)} %
              </p>
              <p className="text-sm">{t('financeQuestions.szenario.erfolgTitle')}</p>
            </>
          )}
          <p className="text-sm">
            {ersetze(t('financeQuestions.szenario.deltaEnde'), {
              delta: money.format(model.result.deltaEndP50),
            })}
          </p>
          {engsterTagIso && (
            <p className="text-xs text-muted-foreground">
              {ersetze(t('financeQuestions.szenario.engsterTag'), {
                datum: new Intl.DateTimeFormat(locale, {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                }).format(new Date(`${engsterTagIso}T00:00:00Z`)),
              })}
            </p>
          )}
        </div>
      )}

      <Link
        to={deepLink}
        className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {t('financeQuestions.showForecast')}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </InfoGroup>
  );
}

function DeltaChip({
  aufloesung,
  datumFuer,
  geld,
  onEntfernen,
  onBeziffern,
}: {
  aufloesung: DeltaAufloesung;
  datumFuer: (abTag: number) => string;
  geld: (betrag: number) => string;
  onEntfernen: () => void;
  onBeziffern: (betrag: number) => void;
}) {
  const { t } = useI18n();
  const [betrag, setBetrag] = useState<number | null>(null);
  const { delta } = aufloesung;

  // Das unbezifferte Einkommens-Delta ist der einzige Chip mit Eingabe: Die
  // Erhöhung wurde ERKANNT, ihr Betrag nicht — gefragt wird hier, geraten nie.
  if (delta.art === 'einkommen' && delta.prozent === undefined && delta.betragProMonat === undefined) {
    return (
      <span className="inline-flex items-center gap-2 rounded-md bg-secondary px-2.5 py-1 text-xs">
        {t('financeQuestions.szenario.chipEinkommenOffen')}
        <DecimalInput
          value={betrag}
          onChange={setBetrag}
          className="h-6 w-24 text-xs"
          aria-label={t('financeQuestions.szenario.chipBetragLabel')}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-6 px-2 text-xs"
          disabled={betrag === null || betrag <= 0}
          onClick={() => betrag !== null && onBeziffern(betrag)}
        >
          {t('financeQuestions.szenario.chipUebernehmen')}
        </Button>
      </span>
    );
  }

  const label = (() => {
    switch (delta.art) {
      case 'einmalausgabe':
        return ersetze(t('financeQuestions.szenario.chipEinmalausgabe'), {
          betrag: geld(delta.betrag),
          datum: datumFuer(delta.abTag),
        });
      case 'einkommen': {
        if (delta.prozent !== undefined) {
          return ersetze(t('financeQuestions.szenario.chipEinkommenProzent'), {
            prozent: String(Math.max(0, 100 + delta.prozent)),
            datum: datumFuer(delta.abTag),
          });
        }
        const betragProMonat = delta.betragProMonat ?? 0;
        return ersetze(
          t(
            betragProMonat >= 0
              ? 'financeQuestions.szenario.chipEinkommenPlus'
              : 'financeQuestions.szenario.chipEinkommenMinus',
          ),
          { betrag: geld(Math.abs(betragProMonat)), datum: datumFuer(delta.abTag) },
        );
      }
      case 'flow_entfaellt': {
        if (aufloesung.unberuecksichtigt) {
          return ersetze(t('financeQuestions.szenario.chipFlowKeineTreffer'), {
            konzept: delta.konzept,
          });
        }
        return ersetze(t('financeQuestions.szenario.chipFlowEntfaellt'), {
          konzept: delta.konzept,
          namen: (aufloesung.getroffeneFlows ?? []).map((f) => f.name).join(', '),
        });
      }
      case 'flow_neu':
        return ersetze(
          t(
            delta.richtung === 'einnahme'
              ? 'financeQuestions.szenario.chipFlowNeuEinnahme'
              : 'financeQuestions.szenario.chipFlowNeuAusgabe',
          ),
          { betrag: geld(delta.betragProMonat), datum: datumFuer(delta.abTag) },
        );
    }
  })();

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={onEntfernen}
      aria-label={ersetze(t('financeQuestions.szenario.entfernen'), { label })}
    >
      {label}
      <X className="ml-1 h-3 w-3" aria-hidden="true" />
    </Button>
  );
}
