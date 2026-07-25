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
      // „Trading" ist ein englisches Lehnwort und „Depot" Bankdeutsch — beides
      // sagt einer Schülerin nichts. Der Bereich zeigt ohnehin den Bestand,
      // nicht das Handeln. Breite ist unkritisch: `nav.items.*` erscheint nur
      // in Seiten-/Drawer-Navigation (die Bottom-Nav hat eigene
      // `shortLabelKey`s), direkt neben „Trends & Berichte".
      trading: 'Wertpapiere',
    },
    subtitles: {
      trading: 'Wertpapiere im Blick',
    },
  },
  kpi: {
    sectionTitle: 'Wichtige Zahlen',
    kpisLabel: 'Wichtige Zahlen',
    selectButton: 'Zahlen auswählen',
    emptyTitle: 'Keine Zahlen ausgewählt',
    emptyDescription: 'Wähle mindestens eine Zahl aus, damit sie auf dem Dashboard erscheint.',
    savingsRate: {
      label: 'Wie viel du sparst',
    },
  },
  health: {
    // `emergencyFund` bleibt „Notgroschen" — bereits Alltagssprache.
    savingsRate: 'Wie viel du sparst',
    liquidity: 'Verfügbares Geld',
  },
  analysisModePanel: {
    balance: 'Kontostand',
    avgBalance: 'Ø Kontostand',
    timeRangeDesc: 'Zahlen und Diagramme folgen dem gewählten Zeitraum-Filter. Wechsle auf „Typischer Monat" für gemittelte Werte oder „Tendenz" für den Vergleich mit dem Vorzeitraum.',
  },
  transactionStats: {
    balance: 'Kontostand',
  },
  balanceChart: {
    balance: 'Kontostand',
    endBalance: 'Kontostand am Ende:',
    startingBalanceLabel: 'Kontostand am Anfang:',
    currentBalance: 'Aktueller Kontostand:',
    dialogTitle: 'Kontostand am Anfang einstellen',
    startingBalanceInput: 'Kontostand am Anfang (€)',
  },
  netWorth: {
    title: 'Besitz minus Schulden',
    netWorth: 'Besitz minus Schulden',
    liquidity: 'Verfügbares Geld',
    composition: 'Verfügbares Geld + Investitionen + offene Forderungen − Schulden',
    // Schliesst eine Inkonsistenz aus Welle 1: die Kachel sagte bereits
    // „Verfügbares Geld", ihr eigener Erklärtext weiter „Liquidität"/„Saldo".
    liquidityDetailedDescription: 'Wenn ein Konto mit der Bank verbunden ist, wird der zuletzt abgerufene Kontostand der Bank verwendet – auch ohne synchronisierte Transaktionen. Ohne Bankanbindung wird der Kontostand aus den lokal erfassten Transaktionen berechnet.',
    liveBadge: 'Von der Bank',
    liveSyncAt: 'Kontostand direkt von der Bank',
    calculatedFrom: 'Berechnet aus Kontostand am Anfang + lokalen Transaktionen',
    managePortfolio: 'Wertpapiere verwalten',
    addPortfolio: 'Wertpapiere hinzufügen',
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
      openingBalanceLabel: 'Kontostand am Anfang (optional)',
      balanceHint: 'Kontostand vor der ersten importierten/erfassten Transaktion. Wird zur Summe der Transaktionen addiert, damit der berechnete Stand dem echten Kontostand entspricht.',
      manualBalanceHint: 'Überschreibt den berechneten/synchronisierten Kontostand direkt – z.B. um nach einem CSV-Import den echten Stand laut Kontoauszug einzutragen.',
    },
    cards: {
      totalBalance: 'Gesamter Kontostand',
    },
  },
  dataExport: {
    pdfBalance: 'Kontostand: €{amount}',
  },
};
