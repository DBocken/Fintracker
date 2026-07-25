import type { TranslationOverlay } from '../types';

/**
 * Alltagssprache (Deutsch). Nur Abweichungen vom Basisbaum — alles, was hier
 * fehlt, kommt unverändert aus `translations.ts`.
 *
 * Faustregeln beim Ergänzen:
 * - Beschreiben, nicht verniedlichen. „Verfügbares Geld" statt „Dein Geldtopf".
 * - Lieber ungenau-kurz als falsch-einfach: „Liquidität = dein Kontostand"
 *   wäre schlimmer als der Fachbegriff, weil es genau der Person etwas
 *   Unwahres beibringt, die den Fehler nicht bemerken kann.
 * - Navigations-Labels sind breitenbegrenzt (Bottom-Nav!) und bekommen
 *   deshalb die Kurzform („Verfügbar"), Seitentitel und Kacheln die
 *   vollständige („Verfügbares Geld"). Beide sind erkennbar dasselbe Wort.
 * - Platzhalter (`{amount}`, `{days}`) müssen exakt dieselben bleiben wie im
 *   Basistext; `replaceTemplate` ersetzt Unbekanntes still durch "".
 * - Im Schulden-Namespace gelten zusätzlich die RDG-Regeln aus
 *   `docs/RDG_TEXTREGELN.md`: „kann/können" statt „ist/musst", und jede
 *   Rechtsaussage endet mit dem Verweis auf die kostenlose Schuldnerberatung.
 *   Reine Beschriftungen wie „Noch offen" sind davon unberührt.
 *
 * Bewusst NICHT überschrieben: „Notgroschen" und „Puffer" — beides ist bereits
 * Alltagssprache. Ein Overlay-Eintrag wäre hier Ballast; die Begriffe stehen
 * trotzdem im Glossar.
 */
export const everydayDe: TranslationOverlay = {
  glossary: {
    terms: {
      liquidity: {
        term: 'Verfügbares Geld',
        definition: 'Das Geld, an das du sofort herankommst — auf dem Konto und bar. Angelegtes Geld zählt nicht mit.',
      },
      netWorth: {
        term: 'Besitz minus Schulden',
        definition: 'Alles, was dir gehört, minus alles, was du schuldest. Was übrig bleibt, kann auch negativ sein.',
      },
      savingsRate: {
        term: 'Wie viel du sparst',
        definition: 'Wie viel von deinem Geld übrig bleibt, in Prozent. Bei 2.000 € Einnahmen und 200 € übrig sind das 10 %.',
      },
      emergencyFund: {
        // Kein `term`: „Notgroschen" ist in beiden Registern dasselbe Wort.
        definition: 'Geld, das du zur Seite legst, damit eine kaputte Waschmaschine kein Kredit wird. Faustregel: drei bis sechs Monatsausgaben.',
      },
      cashflow: {
        term: 'Geld rein, Geld raus',
        definition: 'Was in einem Monat reinkommt, minus was rausgeht.',
      },
      balance: {
        term: 'Kontostand',
        definition: 'Der Stand deines Kontos — was gerade drauf ist.',
      },
      fixedCosts: {
        term: 'Feste Kosten',
        definition: 'Kosten, die jeden Monat gleich hoch anfallen, egal was du tust — Miete, Versicherung, Abos.',
      },
      amortisation: {
        term: 'Rückzahlung',
        definition: 'Der Teil deiner Rate, der die Schuld wirklich kleiner macht. Der Rest ist der Preis fürs Leihen.',
      },
      remainingDebt: {
        term: 'Noch offen',
        definition: 'Wie viel von der Schuld noch offen ist.',
      },
      return: {
        term: 'Gewinn in Prozent',
        definition: 'Wie viel eine Anlage eingebracht hat, gemessen an dem Geld, das du eingesetzt hast.',
      },
      liabilities: {
        term: 'Schulden',
        definition: 'Alles, was du jemandem schuldest.',
      },
      reserve: {
        term: 'Zurückgelegtes Geld',
        definition: 'Geld, das du für etwas Bestimmtes zurücklegst, das später kommt — zum Beispiel die Steuer.',
      },
    },
  },
  nav: {
    items: {
      liquidity: 'Verfügbar',
      netWorth: 'Unterm Strich',
    },
  },
  netWorth: {
    title: 'Besitz minus Schulden',
    netWorth: 'Besitz minus Schulden',
    liquidity: 'Verfügbares Geld',
    composition: 'Verfügbares Geld + Investitionen + offene Forderungen − Schulden',
  },
  other: {
    liquidityTitle: 'Verfügbares Geld',
  },
  coach: {
    statusGridLiquidityLabel: 'Verfügbares Geld',
    statusGridSavingsLabel: 'Wie viel du sparst',
    statusGridLiquidityAction: 'Besitz minus Schulden ansehen',
    openLiquidity: 'Verfügbares Geld öffnen',
    viewNetWorth: 'Besitz minus Schulden ansehen',
  },
  financialHealthService: {
    liquidityLabel: 'Verfügbares Geld',
    savingsRateLabel: 'Wie viel du sparst',
    contractsLabel: 'Verträge & feste Kosten',
  },
  premium: {
    smartInsights: {
      savingsRate: 'Wie viel du sparst',
    },
    timeline: {
      netBalanceLabel: 'Unterm Strich',
    },
  },
  dashboard: {
    cashflowTitle: 'Geld rein, Geld raus',
  },
  liquidityReport: {
    fixedExpensesLabel: 'Feste Kosten',
  },
  categoryForm: {
    propertyFixedCosts: 'Feste Kosten',
  },
  contracts: {
    liabilitiesSum: 'Summe deiner Schulden',
  },
  debts: {
    debtCard: {
      balance: 'Noch offen',
    },
    debtsPage: {
      currentBalance: 'Aktuell noch offen',
      assignedPayments: 'Zugewiesene Rückzahlungen',
      expectedPayoff: 'Voraussichtlich abbezahlt',
    },
    detailSheet: {
      currentBalance: 'Aktuell noch offen',
    },
    debtForm: {
      balanceLabel: 'Noch offen (€)',
    },
  },
  trading: {
    dashboard: {
      summary: {
        return: 'Gewinn in Prozent',
      },
    },
  },
  accounts: {
    formDialog: {
      balanceDateLabel: 'Kontostand-Stichtag',
    },
  },
  dataExport: {
    pdfBalance: 'Kontostand: €{amount}',
  },
};
