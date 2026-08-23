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
 *
 * Ebenfalls bewusst NICHT überschrieben — und das ist kein Rückstand, sondern
 * eine Entscheidung:
 *
 * - `trading.etoro.*` mit „Smart Portfolios": ein **Produktname** von eToro.
 *   Wer ihn übersetzt, macht die Funktion in der eToro-Oberfläche
 *   unauffindbar.
 * - `trading.portfolioManager.*` und `portfolio.*`: dort ist „Portfolio" der
 *   **Behälter, den die Nutzerin selbst anlegt und benennt** — ein Portfolio
 *   *enthält* Wertpapiere, es *ist* keines. `portfolio.newPortfolioName` wird
 *   ausserdem als Standardname **persistiert**; eine Umbenennung würde
 *   Bestandsdaten und Neuanlagen auseinanderlaufen lassen.
 *   In `nav`, `netWorth` und `other` benennt dasselbe Wort dagegen den
 *   *Bereich* bzw. den *Vermögensposten* — dort heisst es „Wertpapiere".
 */
export const everydayDe: TranslationOverlay = {
  learnedCategorization: {
    title: 'Wie gut ordnet Fintracker zu?',
    empty: 'Noch zu wenig bestätigt, um etwas zu lernen. Ordne ein paar Buchungen selbst zu — die App merkt es sich.',
    error: 'Die Auswertung lässt sich gerade nicht laden.',
    withModel: 'Von 100 automatisch zugeordneten Buchungen waren im Test {correct} richtig.',
    withoutModel: 'Ohne das Lernen aus deinen Buchungen wären es {correct} — und die App würde nur {coverage} von 100 Buchungen überhaupt zuordnen statt {modelCoverage}.',
    basis: 'Grundlage: {count} Buchungen, die du selbst bestätigt hast.',
  },
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
  billing: {
    // Fachsprache: „Abo-Status", „freischalten". Alltagssprache benennt, was
    // der Nutzer davon hat, und vermeidet den Vertragston.
    subtitle: 'Alles freischalten. Du kannst jeden Monat wieder aufhören.',
    loading: 'Einen Moment, wir schauen nach …',
    upgradeTitle: 'Alles freischalten',
    upgradeCta: 'Freischalten',
    activeTitle: 'Du hast alles freigeschaltet',
    cancelHint: 'Du kannst jederzeit aufhören. Was du bezahlt hast, bleibt bis zum Ende nutzbar.',
    errorTitle: 'Wir konnten gerade nicht nachsehen',
    errorBody: 'Ob du freigeschaltet bist, konnten wir gerade nicht prüfen. An deinen Daten ändert das nichts — die liegen auf deinem Gerät.',
    unavailableTitle: 'Kaufen geht hier noch nicht',
    unavailableBody: 'Sobald das Bezahlen eingerichtet ist, findest du es hier.',
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
    // NICHT 'Kontostand': das ist der Saldo EINES ZEITRAUMS (Einnahmen minus
    // Ausgaben), also ein Fluss, kein Stand — und auf dem Dashboard stand
    // damit dieselbe Bezeichnung an zwei Stellen fuer zwei verschiedene
    // Groessen. Genau der Fall, den die Faustregel oben meint: falsch-einfach
    // ist schlimmer als der Fachbegriff.
    balance: 'Übrig geblieben',
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
    // Muss mitgehen, sonst sagt die Kachel „Wertpapiere verwalten" und die
    // Zeile darüber weiter „Portfolio" — dieselbe Drift, die dieser Overlay
    // abstellen soll.
    portfolio: 'Wertpapiere',
    portfolioDesc: 'Aktueller Marktwert aller Wertpapiere.',
    // „Noch keine … erfasst" statt „Keine … hinterlegt": die Bedingung
    // dahinter (NetWorthPage: leeres `portfolioSources`) sagt aus, dass keine
    // Depots mit Positionen vorliegen — nicht, dass gar kein Depot angelegt
    // ist. „Erfasst" beschreibt genau das, ohne über die Struktur dahinter
    // etwas zu behaupten.
    noPortfolios: 'Noch keine Wertpapiere erfasst.',
  },
  other: {
    liquidityTitle: 'Verfügbares Geld',
    tradingTitle: 'Wertpapiere',
    tradingDesc: 'Verwalte deine Investitionen und Wertpapiere.',
  },
  forecastRisk: {
    belowBuffer:
      'Dein verfügbares Geld fällt am {date} unter den Puffer ({buffer}). Tiefststand {lowestBalance} am {lowestBalanceDate}.',
    ok: 'Dein verfügbares Geld bleibt im gesamten Zeitraum über dem Puffer ({buffer}). Tiefststand {lowestBalance} am {lowestBalanceDate}.',
  },
  budgetOptimizer: {
    bufferHoldsDescription:
      'Dein Puffer hält im gewählten Zeitraum – aktuell ist kein Eingriff nötig.',
  },
  budgetSweep: {
    insufficientLiquidity: 'Zu wenig verfügbares Geld – erst den Puffer sichern.',
  },
  budgetWaterfall: {
    essentials: 'Feste Kosten',
  },
  accountDataQuality: {
    noOpeningBalanceMessage:
      'Kein Kontostand am Anfang hinterlegt – der Stand beruht nur auf erfassten Transaktionen.',
  },
  financeFoundation: {
    zukunftBesparen: {
      description: 'Fester Sparanteil (Ziel: {percent} %) – Altersvorsorge/ETF.',
      whyItMatters:
        'Wer regelmäßig investiert, verdient über die Jahre auch an den bereits erzielten Gewinnen mit.',
    },
  },
  onboarding: {
    lifeSituations: {
      employed_stable: {
        description: 'Feste Kosten im Griff — jetzt geht es ums Optimieren und Vermögen aufbauen.',
      },
    },
  },
  upsell: {
    features: {
      basicContracts: {
        title: 'Verträge & feste Kosten erkennen',
      },
      trading: {
        title: 'Wertpapiere im Blick',
        benefit1: 'Behalte Wertentwicklung und Aufteilung an einem Ort.',
      },
    },
  },
  mcpService: {
    // „Median" bleibt als Wort erhalten, wird aber einmal aufgelöst — ein
    // blosses „Durchschnitt" waere hier schlicht falsch.
    unusualExpenseReason: '{percent} % über der üblichen Mitte ({median} €) dieser Kategorie',
  },
  coach: {
    statusGridLiquidityLabel: 'Verfügbares Geld',
    statusGridSavingsLabel: 'Wie viel du sparst',
    statusGridLiquidityAction: 'Besitz minus Schulden ansehen',
    openLiquidity: 'Verfügbares Geld öffnen',
    viewNetWorth: 'Besitz minus Schulden ansehen',
    fixedCostsNotice: 'Achtung: Die festen Kosten übersteigen dein Guthaben vor dem Gehalt.',
  },
  financialHealthService: {
    liquidityLabel: 'Verfügbares Geld',
    savingsRateLabel: 'Wie viel du sparst',
    contractsLabel: 'Verträge & feste Kosten',
    savingsRateExplanation: 'Du sparst {percent} % deiner Einnahmen (Ziel: 20 %).',
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
    // „Median (P50)" ist die Fachsprache im Basisbaum; hier die Aussage, die
    // sie trifft — der mittlere von vielen durchgerechneten Verläufen.
    seriesMedian: 'Mittlerer Verlauf',
    // Perzentil-Schreibweise ist Fachsprache und steht so im Basisbaum.
    // Alltagssprachlich zaehlt die Aussage, nicht die Notation.
    bandCaption: 'So koennte es in den naechsten {days} Tagen laufen — der dichte Bereich in der Mitte ist das Wahrscheinlichste, nach aussen wird es unwahrscheinlicher. Der Rand ist absichtlich weich: sicher ist an einer Vorhersage nichts. ·',
    liquidityChart: 'Verlauf deines verfügbaren Geldes ({basis})',
    firstBreachLabel: 'Zum ersten Mal unter dem Puffer',
    // `bufferReference` („Puffer"), `belowBufferLabel` („unter Puffer") und
    // `daysUnderBuffer` bleiben: „Puffer" ist bereits Alltagssprache, ein
    // Eintrag wäre reiner Ballast. Nur die Komposita werden aufgelöst.
  },
  finrisk: {
    fixedCosts: 'Feste Kosten',
    // Aufgelöst statt umbenannt: „Pufferbruch" ist ein Wort, das ausserhalb
    // dieser App niemand benutzt — und es verschweigt, dass es sich um eine
    // Wahrscheinlichkeit handelt (siehe RiskSummaryCard: baseBreachProbability).
    bufferBreach: '{pct} % Risiko, unter den Puffer zu rutschen',
    adaptiveSpendingDesc:
      'Wenn es eng wird, hältst du die Ausgaben zurück, die du selbst steuern kannst – feste Kosten und Verträge bleiben. Ein bewusstes Was-wäre-wenn, keine Vorhersage.',
    driverSentence:
      'Dieser Verlauf gibt vor allem bei „{category}" {pct} % {direction} aus als der typische – das erklärt den {outcome} Kontostand.',
    rangeAndAverage:
      'Band und Ø fassen alle Verläufe dieser Zelle zusammen – derselbe Kontostand kann durch unterschiedliche Annahmen entstehen.',
    fixedAndPlanned:
      'Feste Kosten und geplante Posten sind in jedem Verlauf gleich – die Streuung (±) kommt aus schwankenden Ausgaben und Einnahmen.',
    noPaths: 'Noch keine Verläufe – Fall wählen oder Daten ergänzen.',
    liquidityProbability: 'Wie wahrscheinlich dir Geld ausgeht, über die Zeit',
    heatmapAriaLabel:
      'Übersicht über {days} Tage. Kontostand am Ende in der Mitte aller Verläufe: {balance}.',
    howToReadValue: 'Bereich (im Minus / unter Puffer / gesund)',
    // „Median" wird NICHT zu „Durchschnitt" — das wäre falsch-einfach und
    // brächte genau der Person etwas Unwahres bei, die es nicht bemerkt.
    // „Mitte" ist kurz und trifft die Bedeutung: die Hälfte liegt darüber.
    howToReadMedian: 'Mitte (P50)',
    liquidityRiskDetected: 'Es könnte eng werden',
    liquiditySafety: 'Sicherheit verkraftet dein Geld eine zusätzliche unerwartete Ausgabe bis',
    tapToSeeAssumptions:
      'Tippe eine Zelle an, um die Annahmen dahinter zu sehen – welche konkreten Werte diesen Kontostand erzeugt haben.',
    diagnosisWarning1:
      'Achtung: Schon ohne zusätzlichen Fall rutscht dein verfügbares Geld im betrachteten Zeitraum voraussichtlich ins Minus.',
    diagnosisWarning2:
      'Schon ohne zusätzlichen Fall bleibt dein verfügbares Geld voraussichtlich unter deinem Puffer.',
    diagnosisMajor: 'Der gewählte Fall belastet dein verfügbares Geld sichtbar.',
    diagnosisModerate: 'Der gewählte Fall reduziert deinen Puffer moderat.',
    diagnosisRelief: 'Der gewählte Fall entlastet deinen Puffer.',
    diagnosisMinor: 'Der gewählte Fall verändert deinen Puffer nur begrenzt.',
    diagnosisDisclaimer:
      'Diese Analyse rechnet auf deinem Gerät durch, wie es laufen könnte – sie ist keine Finanzberatung.',
  },
  forecastScenario: {
    presetRentIncreaseDesc: 'Der größte feste Kostenpunkt (meist die Miete) steigt um 15%.',
    scenarioItemDefault: 'Posten im Was-wäre-wenn',
    scenarioObligationDefault: 'Verpflichtung im Was-wäre-wenn',
  },
  categoryForm: {
    propertyFixedCosts: 'Feste Kosten',
  },
  milestones: {
    netWorth10kDescription: 'Was dir nach Abzug der Schulden gehört, hat die 10.000-€-Marke geknackt.',
  },
  coachService: {
    // `stages.fullEmergencyFund.whyItMatters` bleibt: „Mehr Puffer bedeutet
    // weniger Stress" ist bereits Alltagssprache.
    recommendations: {
      growBufferReason:
        'Das senkt dein Risiko und sorgt dafür, dass am Monatsende verlässlicher etwas übrig bleibt.',
      taxReserveTitle: 'Geld für die Steuer zurücklegen',
    },
    insights: {
      spendingPatternLow: 'Du sparst noch wenig – kleine Kürzungen wirken hier besonders stark.',
      spendingPatternGood: 'Du sparst solide und hast dadurch Spielraum für Ziele.',
      debtBurdenActive:
        'Mindestraten von {amount} € binden jeden Monat Geld, das dir sonst frei zur Verfügung stünde.',
    },
  },
  budgets: {
    formDialog: {
      adaptiveDescription:
        'Mitwachsendes Limit: es folgt der Mitte deiner letzten Monate, sodass einzelne Ausreißer es nicht verzerren. Dein Wert oben gilt als Startwert, bis genug Historie da ist.',
    },
    waterfall: {
      title: 'Wohin dein Geld fließt',
      savingsRate: 'Wie viel du sparst',
      highSavingsRateWarning:
        'Du sparst zu viel: Nach dem Sparen sind die festen Kosten nicht mehr gedeckt. Spare etwas weniger oder senke die festen Kosten.',
      stepHints: {
        // `taxReserve` („Steuern sind fremdes Geld") und `surplus` („frei für
        // Sparen/Investieren") bleiben — beides ist schon Alltagssprache.
        savings: 'erst sparen, dann ausgeben',
        essentials: 'was du zum Leben brauchst',
        discretionary: 'was übrig bleibt, wird verplant',
      },
    },
  },
  income: {
    stress: {
      sectionDescription: 'Was passiert mit deinem Geld, wenn eine Einnahmequelle wegfällt?',
      firstBreachShift: 'Zum ersten Mal unter dem Puffer',
      shiftNone: 'Nur in einem Fall wird der Puffer angebrochen — kein Tagesvergleich möglich.',
      notInForecast:
        'Diese Einnahme ist nicht Teil der Vorausschau (unregelmäßige Einnahmen werden nicht vorausberechnet).',
      deepDiveCta: 'Zur Planung deines verfügbaren Geldes',
      loading: 'Berechne den Fall …',
    },
    tax: {
      title: 'Steuer zurücklegen',
    },
  },
  contracts: {
    liabilitiesSum: 'Summe deiner Schulden',
    incomesMinusContracts: 'Einnahmen − Verträge (was übrig bleibt)',
    statusConfirmActiveHint: 'Fließt in die aktuellen festen Kosten ein.',
    onlyActiveContracts:
      'Nur aktive Verträge mit bekanntem Zyklus zählen. Verträge mit unklarem Zyklus oder lange ohne Buchung werden nicht hochgerechnet, damit alte Verträge die festen Kosten nicht verfälschen.',
  },
  debts: {
    // Diese Einträge sind reine Beschriftungen — „Tilgung" → „Rückzahlung",
    // „Verbindlichkeiten" → „Schulden". Sie enthalten KEINE Rechtsaussage,
    // deshalb bekommen sie auch keine RDG-Brücke zur Schuldnerberatung: ein
    // Verweis ohne Rechtsfrage wäre Rhetorik, nicht Sorgfalt
    // (docs/RDG_TEXTREGELN.md, Faustregel 2 greift nur „wo eine Rechtsfrage
    // auftaucht"). Keine „kann/musst"-Aussage wird hier berührt.
    description: 'Behalte Schulden und verliehenes Geld im Blick und plane, wie du sie abbaust.',
    assignSuccess: 'Zahlung als Rückzahlung zugewiesen',
    debtCard: {
      balance: 'Noch offen',
    },
    debtsPage: {
      assignHint:
        'Ordne wiederkehrende Lastschriften (z.B. Kreditkartenrate) einer Schuld zu — so sehen wir automatisch, wie viel du schon zurückgezahlt hast.',
      currentBalance: 'Aktuell noch offen',
      assignedPayments: 'Zugewiesene Rückzahlungen',
      expectedPayoff: 'Voraussichtlich abbezahlt',
    },
    detailSheet: {
      currentBalance: 'Aktuell noch offen',
      assignPaymentsHint:
        'Ordne wiederkehrende Lastschriften zu — so sehen wir automatisch, wie viel du schon zurückgezahlt hast.',
    },
    debtForm: {
      balanceLabel: 'Noch offen (€)',
    },
  },
  debtService: {
    onlyDebitsAllowed: 'Nur Abbuchungen können einer Schuld als Rückzahlung zugewiesen werden.',
  },
  /**
   * Steuer: hier wird ABSICHTLICH kein Fachbegriff ersetzt.
   *
   * „Pauschbetrag", „Werbungskosten", „Betriebseinnahmen", „GWG", „AfA" stehen
   * genau so auf dem Elster-Formular, das die Nutzerin danach ausfüllt. Wer
   * hier „Arbeitskosten von der Steuer absetzen" liest und dann im Formular
   * „Werbungskosten" sucht, findet nichts — die Vereinfachung würde das
   * Ausfüllen erschweren statt erleichtern.
   *
   * Was das Alltagsregister stattdessen tut: die Abkürzung EINMAL auflösen und
   * das Fachwort stehen lassen. Die Erklärung selbst trägt das Glossar.
   */
  tax: {
    rubric: {
      werbungskosten: {
        hint: 'Wirken erst über dem Arbeitnehmer-Pauschbetrag von 1.230 €/Jahr — den zieht das Finanzamt ohnehin ab, deine Ausgaben zählen erst darüber hinaus (gilt je Arbeitnehmer).',
      },
      agb: {
        hint: 'Wirken erst über der zumutbaren Belastung — dem Eigenanteil, den du selbst tragen musst (1–7 % der Einkünfte, je nach Einkommen und Kindern). Sammle trotzdem alle Belege.',
      },
      betriebsausgaben: {
        hint: 'Ausgaben aus Nebenerwerb/Selbstständigkeit – gehören in die Einnahmenüberschussrechnung (EÜR), die einfache Gewinnermittlung: Einnahmen minus Ausgaben.',
      },
    },
    cat: {
      minijob: {
        hint: 'Haushaltshilfe, die du über das Haushaltsscheckverfahren bei der Minijob-Zentrale angemeldet hast.',
      },
      reisekosten: {
        hint: 'Auswärtstätigkeit — beruflich unterwegs ausserhalb deiner ersten Arbeitsstätte, inkl. Verpflegungspauschalen.',
      },
      spenden: {
        hint: 'Nur an steuerbegünstigte Organisationen; ab 300 € brauchst du eine Zuwendungsbestätigung — die Spendenquittung des Empfängers.',
      },
      unterhaltEx: {
        hint: 'Realsplitting bis 13.805 €/Jahr (Anlage U): du setzt den Unterhalt ab, die empfangende Person versteuert ihn — beide müssen zustimmen.',
      },
      vSonstiges: {
        hint: 'AfA (Absetzung für Abnutzung — die jährliche Wertminderung) ist nicht zahlungsbasiert – hier nur informativ.',
      },
      euerArbeitsmittel: {
        hint: 'Bis 800 € netto sofort abziehbar (geringwertiges Wirtschaftsgut, kurz GWG), darüber verteilt über die Nutzungsdauer.',
      },
      euerKfz: {
        hint: 'Private Nutzung (1-%-Regel oder Fahrtenbuch) bildet die App nicht ab – kläre den Privatanteil in der Erklärung.',
      },
      euerRaumkosten: {
        hint: 'Miete/Nebenkosten für Betriebsräume. Ein Arbeitszimmer zu Hause läuft stattdessen über die Homeoffice-Pauschale.',
      },
    },
    form: {
      euerPrivateHint:
        'Schließt diese Buchung trotz Geschäftskonto aus der Einnahmenüberschussrechnung (EÜR) aus.',
    },
    commute: {
      description:
        'Die Entfernungspauschale („Pendlerpauschale") rechnet nach Kilometern – trag deine Werte ein, wir rechnen sie exakt für das Steuerjahr.',
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
  privacy: {
    localEncryption: {
      // WP 3.3 (SEC-3): genau die Zielgruppe eines schwachen Passworts liest
      // eine Fachsprachen-Warnung am wenigsten — deshalb hier ausdrücklich
      // in Alltagssprache statt nur im Basisbaum.
      weakPasswordWarning: 'Dieses Passwort ist leicht zu knacken. Selbst die beste Verschlüsselung schützt dann kaum.',
      overrideWeakLabel: 'Ich weiß, dass das riskant ist, und mache trotzdem weiter.',
    },
  },
};
