/**
 * Registereinträge der Depot-Slice (Welle 2).
 *
 * Gerechnet wird mit `summarizePortfolio` — derselben reinen Funktion, die
 * auch `/trading` und der `portfolio-service` benutzen. Keine zweite
 * Bewertungslogik daneben.
 *
 * **Fremdwährung wird ausgewiesen, nie summiert** (VE-1,
 * `docs/architecture/currency-eur-only.md`). Es gibt keine Kursquelle; 1:1 zu
 * addieren ergäbe beim damaligen EUR/USD-Kurs rund 8 % Fehler, und zwar
 * lautlos. Der Chat sagt deshalb dazu, wenn ein Teil des Depots nicht in der
 * Zahl steckt — eine Summe, die schweigend unvollständig ist, ist schlimmer
 * als eine, die ihre Lücke nennt.
 */
import type { Portfolio, PortfolioPosition, PortfolioSummary } from '@/types';
import type { Aussage, ListenPosten, QuestionAnswer, QuestionData, QuestionEntry } from '@/lib/question-registry';
import { summarizePortfolio } from '@/features/trading/domain/portfolio-summary';
import { currentPriceOf } from '@/features/trading/domain/position-metrics';

const KEIN_DEPOT: Omit<QuestionAnswer, 'aussage'> = {
  art: 'keine',
  wert: null,
  anzahl: 0,
  deepLink: '/trading',
  deepLinkArt: 'kontext',
};

interface DepotStand {
  summen: PortfolioSummary[];
  depots: readonly Portfolio[];
  /** Positionen in fremder Währung über ALLE Depots — die benannte Lücke. */
  nichtVerrechnet: number;
}

function depotStand(daten: QuestionData): DepotStand | null {
  const depots = daten.portfolios ?? [];
  if (depots.length === 0) return null;
  const summen = depots.map((depot) =>
    summarizePortfolio(depot, (daten.positionsByPortfolio?.get(depot.id) ?? []) as PortfolioPosition[]),
  );
  return {
    summen,
    depots,
    nichtVerrechnet: summen.reduce((n, s) => n + s.unconverted_positions.length, 0),
  };
}

/** Hinweis auf die nicht verrechneten Positionen — nur, wenn es welche gibt. */
function fremdwaehrungsHinweis(stand: DepotStand): Aussage[] {
  if (stand.nichtVerrechnet === 0) return [];
  return [
    {
      key: 'financeQuestions.reason.fremdwaehrungNichtSummiert',
      params: { anzahl: stand.nichtVerrechnet },
    },
  ];
}

const depotWert: QuestionEntry = {
  id: 'depot.wert',
  slots: { erforderlich: [], optional: [] },
  ausloeser: ['financeQuestions.trigger.depotWert'],
  verstaerker: ['financeQuestions.trigger.depot'],
  needs: ['portfolios'],
  aufwand: 'guenstig',
  antwort: (_slots, daten): QuestionAnswer => {
    const stand = depotStand(daten);
    if (!stand) {
      return { ...KEIN_DEPOT, aussage: { key: 'financeQuestions.answer.depotKeines', params: {} } };
    }
    const wert = stand.summen.reduce((s, d) => s + d.total_value, 0);
    return {
      art: 'geld',
      wert,
      anzahl: stand.summen.reduce((n, d) => n + d.positions_count, 0),
      aussage: {
        key: 'financeQuestions.answer.depotWert',
        params: { anzahl: stand.depots.length },
      },
      begruendung: fremdwaehrungsHinweis(stand),
      deepLink: '/trading',
      deepLinkArt: 'quelle',
    };
  },
};

const depotRendite: QuestionEntry = {
  id: 'depot.rendite',
  slots: { erforderlich: [], optional: [] },
  ausloeser: ['financeQuestions.trigger.depotRendite'],
  verstaerker: ['financeQuestions.trigger.depot'],
  needs: ['portfolios'],
  aufwand: 'guenstig',
  antwort: (_slots, daten): QuestionAnswer => {
    const stand = depotStand(daten);
    if (!stand) {
      return { ...KEIN_DEPOT, aussage: { key: 'financeQuestions.answer.depotKeines', params: {} } };
    }
    const eingesetzt = stand.summen.reduce((s, d) => s + d.total_cost, 0);
    const gewinn = stand.summen.reduce((s, d) => s + d.unrealized_gain_loss, 0);

    // Ohne eingesetztes Kapital gibt es keine Rendite — nicht „0 %".
    if (eingesetzt <= 0) {
      return {
        ...KEIN_DEPOT,
        aussage: { key: 'financeQuestions.answer.depotOhneEinsatz', params: {} },
      };
    }

    return {
      art: 'geld',
      wert: gewinn,
      anzahl: stand.summen.reduce((n, d) => n + d.positions_count, 0),
      aussage: {
        key: gewinn < 0 ? 'financeQuestions.answer.depotVerlust' : 'financeQuestions.answer.depotGewinn',
        params: {},
      },
      begruendung: [
        { key: 'financeQuestions.reason.depotEingesetzt', params: { betrag: eingesetzt } },
        {
          key: 'financeQuestions.reason.depotProzent',
          // Prozentpunkte als ZAHL, gerundet in der Präsentation: Das
          // Register liefert nie fertigen Text (AGENTS.md, Register-Regel 1).
          params: { prozent: (gewinn / eingesetzt) * 100 },
        },
        ...fremdwaehrungsHinweis(stand),
      ],
      deepLink: '/trading',
      deepLinkArt: 'quelle',
    };
  },
};

const depotPositionen: QuestionEntry = {
  id: 'depot.positionen',
  slots: { erforderlich: [], optional: [] },
  ausloeser: ['financeQuestions.trigger.depotPositionen'],
  verstaerker: ['financeQuestions.trigger.depot'],
  needs: ['portfolios'],
  aufwand: 'guenstig',
  antwort: (_slots, daten): QuestionAnswer => {
    const stand = depotStand(daten);
    if (!stand) {
      return { ...KEIN_DEPOT, aussage: { key: 'financeQuestions.answer.depotKeines', params: {} } };
    }

    // Je Position eine Zeile, absteigend nach Marktwert. Fremdwährung bleibt
    // draußen — sie ist mit den übrigen nicht vergleichbar, und eine Liste,
    // die Äpfel neben Birnen sortiert, behauptet eine Rangfolge, die es
    // nicht gibt.
    const posten: ListenPosten[] = [];
    for (const depot of stand.depots) {
      const summe = summarizePortfolio(
        depot,
        (daten.positionsByPortfolio?.get(depot.id) ?? []) as PortfolioPosition[],
      );
      const ausgeschlossen = new Set(summe.unconverted_positions.map((p) => p.id));
      for (const position of daten.positionsByPortfolio?.get(depot.id) ?? []) {
        if (ausgeschlossen.has(position.id)) continue;
        posten.push({
          label: position.name || position.symbol,
          betrag: position.quantity * currentPriceOf(position),
        });
      }
    }
    posten.sort((a, b) => b.betrag - a.betrag);

    if (posten.length === 0) {
      return { ...KEIN_DEPOT, aussage: { key: 'financeQuestions.answer.depotOhnePositionen', params: {} } };
    }

    return {
      art: 'liste',
      wert: null,
      anzahl: posten.length,
      posten: posten.slice(0, 10),
      aussage: { key: 'financeQuestions.answer.depotPositionen', params: {} },
      begruendung: fremdwaehrungsHinweis(stand),
      deepLink: '/trading',
      deepLinkArt: 'quelle',
    };
  },
};

export const questions: readonly QuestionEntry[] = [depotWert, depotRendite, depotPositionen];
