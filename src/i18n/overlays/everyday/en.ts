import type { TranslationOverlay } from '../types';

/**
 * Everyday wording (English). Only deviations from the base tree — anything
 * missing here falls through to `translations.ts` unchanged.
 *
 * Same rules as the German overlay (see `de.ts`): describe rather than
 * infantilise, never trade accuracy for simplicity, keep navigation labels
 * short because the bottom nav is width-constrained, and preserve the exact
 * placeholder set of the base string.
 *
 * This overlay is deliberately smaller than the German one: several English
 * base terms ("Fixed costs", "Remaining balance", "Emergency fund") are
 * already everyday language, so an entry would only repeat them. Only the
 * genuine jargon is covered — liquidity, net worth, savings rate, cashflow,
 * return, liabilities.
 */
export const everydayEn: TranslationOverlay = {
  glossary: {
    terms: {
      liquidity: {
        term: 'Money available now',
        definition: "The money you can get at right now — in your account and in cash. Invested money doesn't count.",
      },
      netWorth: {
        term: 'What you own minus debts',
        definition: 'Everything you own minus everything you owe. What is left can also be negative.',
      },
      savingsRate: {
        term: 'How much you save',
        definition: 'How much of your money is left over, as a percentage. €2,000 in and €200 left is 10%.',
      },
      emergencyFund: {
        // No `term`: "Emergency fund" is already everyday English.
        definition: "Money set aside so a broken washing machine doesn't turn into a loan. Rule of thumb: three to six months of spending.",
      },
      cashflow: {
        term: 'Money in, money out',
        definition: 'What comes in over a month, minus what goes out.',
      },
      balance: {
        term: 'Account balance',
        definition: 'Where your account stands — what is on it right now.',
      },
      fixedCosts: {
        // No `term`: "Fixed costs" is already everyday English.
        definition: 'Costs that are the same every month no matter what you do — rent, insurance, subscriptions.',
      },
      amortisation: {
        term: 'Repayment',
        definition: 'The part of your payment that actually shrinks the debt. The rest is the price of borrowing.',
      },
      remainingDebt: {
        term: 'Still owed',
        definition: 'How much of the debt is still open.',
      },
      return: {
        term: 'Gain as a percentage',
        definition: 'How much an investment made, measured against the money you put in.',
      },
      liabilities: {
        term: 'Debts',
        definition: 'Everything you owe someone.',
      },
      reserve: {
        term: 'Money set aside',
        definition: 'Money you put aside for something specific that is coming — tax, for example.',
      },
    },
  },
  kpi: {
    // "Balance" is already everyday English, so balanceChart/accounts/
    // transactionStats need no entries here — only the genuine jargon does.
    sectionTitle: 'Your numbers',
    kpisLabel: 'Your numbers',
    selectButton: 'Choose numbers',
    emptyTitle: 'No numbers selected',
    emptyDescription: 'Pick at least one number to show it on the dashboard.',
    savingsRate: {
      label: 'How much you save',
    },
  },
  health: {
    // `emergencyFund` stays — already everyday English.
    savingsRate: 'How much you save',
    liquidity: 'Money available now',
  },
  nav: {
    items: {
      liquidity: 'Available',
      netWorth: 'Bottom line',
      // The section shows what you hold, not the act of trading — and its own
      // subtitle already says "Investments". Width is not a concern: this key
      // only renders in the side/drawer nav (the bottom nav has its own
      // `shortLabelKey`s), next to "Trends & Reports".
      trading: 'Investments',
    },
    subtitles: {
      trading: 'Investments at a glance',
    },
  },
  netWorth: {
    title: 'What you own minus debts',
    netWorth: 'What you own minus debts',
    liquidity: 'Money available now',
    composition: 'Money available now + investments + money owed to you − debts',
    // Closes a wave-1 inconsistency: the tile already said "Money available
    // now" while its own explanation still said "Liquidity".
    liquidityDetailedDescription: 'If an account is linked to a bank, the most recently fetched bank balance is used — even without synced transactions. Without a bank link, the balance is calculated from locally recorded transactions.',
    managePortfolio: 'Manage investments',
    addPortfolio: 'Add investments',
    // Must move with them, otherwise the tile says "Manage investments" while
    // the line above still says "Portfolio".
    portfolio: 'Investments',
    portfolioDesc: 'Current market value of all your investments.',
    // "recorded yet" rather than "set up": the condition behind it (empty
    // `portfolioSources` in NetWorthPage) says no holdings are recorded, not
    // that no portfolio exists.
    noPortfolios: 'No investments recorded yet.',
  },
  other: {
    liquidityTitle: 'Money available now',
    tradingTitle: 'Investments',
    tradingDesc: 'Track your investments and holdings.',
  },
  forecastRisk: {
    belowBuffer:
      'Your available money drops below the buffer ({buffer}) on {date}. Lowest point {lowestBalance} on {lowestBalanceDate}.',
    ok: 'Your available money stays above the buffer ({buffer}) for the whole period. Lowest point {lowestBalance} on {lowestBalanceDate}.',
  },
  budgetOptimizer: {
    bufferHoldsDescription: 'Your buffer holds over the selected period – nothing to do right now.',
  },
  budgetSweep: {
    insufficientLiquidity: 'Not enough money available – secure the buffer first.',
  },
  financeFoundation: {
    zukunftBesparen: {
      description: 'A fixed share put aside (goal: {percent}%) – retirement/ETF.',
      whyItMatters:
        'Investing regularly means that over the years you also earn on the gains you already made.',
    },
  },
  upsell: {
    features: {
      trading: {
        title: 'Investments at a glance',
        benefit1: 'Keep track of value development and how it is split, in one place.',
      },
    },
  },
  mcpService: {
    // "Median" stays accurate — a plain "average" would simply be wrong.
    unusualExpenseReason: '{percent} % above the typical middle ({median} €) for this category',
  },
  coach: {
    statusGridLiquidityLabel: 'Money available now',
    statusGridSavingsLabel: 'How much you save',
    statusGridLiquidityAction: 'See what you own minus debts',
    openLiquidity: 'Open available money',
    viewNetWorth: 'See what you own minus debts',
  },
  financialHealthService: {
    liquidityLabel: 'Money available now',
    savingsRateLabel: 'How much you save',
    savingsRateExplanation: 'You save {percent}% of your income (goal: 20%).',
  },
  premium: {
    smartInsights: {
      savingsRate: 'How much you save',
    },
    timeline: {
      netBalanceLabel: 'Bottom line',
    },
  },
  dashboard: {
    cashflowTitle: 'Money in, money out',
  },
  liquidityReport: {
    // "Median (P50)" is the technical term in the base tree; this is what it
    // actually says — the middle one of many simulated paths.
    seriesMedian: 'Middle path',
    // Percentile notation is technical and stays in the base tree.
    bandCaption: 'How the next {days} days could go — the dense middle is the most likely, and it thins out towards the edges. The soft edge is deliberate: nothing about a forecast is certain. ·',
    liquidityChart: 'How your available money develops ({basis})',
    firstBreachLabel: 'First time below your buffer',
    // `bufferReference`, `belowBufferLabel` and `daysUnderBuffer` stay:
    // "buffer" is already everyday English. Only the compounds are unpacked.
  },
  finrisk: {
    // Unpacked rather than renamed: "buffer breach" hides that this is a
    // probability (see RiskSummaryCard: baseBreachProbability).
    bufferBreach: '{pct} % chance of dipping below your buffer',
    adaptiveSpendingDesc:
      'When things get tight you hold back the spending you can control – fixed costs and contracts stay. A deliberate what-if, not a forecast.',
    driverSentence:
      'This path spends {pct} % {direction} than the typical one, mainly on "{category}" – that explains the {outcome} balance.',
    rangeAndAverage:
      'The band and average summarise every path in this cell – the same balance can come from different assumptions.',
    fixedAndPlanned:
      'Fixed costs and planned items are the same in every path – the spread (±) comes from variable spending and income.',
    noPaths: 'No paths yet – pick a what-if or add data.',
    liquidityProbability: 'How likely you are to run short, over time',
    heatmapAriaLabel: 'Overview across {days} days. Middle end balance {balance}.',
    howToReadValue: 'range (in the red / below buffer / healthy)',
    // "Median" does NOT become "average" — that would be simple and wrong,
    // teaching something untrue to exactly the reader who cannot spot it.
    howToReadMedian: 'Middle (P50)',
    liquidityRiskDetected: 'This could get tight',
    liquiditySafety: 'confidence your money can absorb an unexpected cost of up to',
    diagnosisWarning1:
      'Alert: Even without an extra what-if, your available money is likely to go negative in this period.',
    diagnosisWarning2:
      'Even without an extra what-if, your available money is likely to stay below your buffer.',
    diagnosisMajor: 'The chosen what-if noticeably strains your available money.',
    diagnosisModerate: 'The chosen what-if moderately reduces your buffer.',
    diagnosisRelief: 'The chosen what-if eases your buffer.',
    diagnosisMinor: 'The chosen what-if changes your buffer only slightly.',
    diagnosisDisclaimer:
      'This analysis works out on your device how things could go – it is not financial advice.',
  },
  forecastScenario: {
    presetRentIncreaseDesc: 'Your largest fixed cost (usually rent) goes up by 15%.',
    scenarioItemDefault: 'What-if item',
    scenarioObligationDefault: 'What-if obligation',
  },
  milestones: {
    netWorth10kDescription: 'What you own minus debts has crossed the €10,000 mark.',
  },
  coachService: {
    recommendations: {
      growBufferReason:
        'This lowers your risk and makes it more reliable that something is left at month end.',
      taxReserveTitle: 'Set money aside for tax',
    },
    insights: {
      spendingPatternLow: 'You still save little – small cuts have a strong effect here.',
      spendingPatternGood: 'You save solidly, which gives you room for goals.',
      debtBurdenActive:
        'Minimum payments of {amount} € tie up money each month that would otherwise be yours to use.',
    },
  },
  budgets: {
    formDialog: {
      adaptiveDescription:
        'A limit that grows with you: it follows the middle of your recent months, so single outliers cannot skew it. Your value above is a starting point until enough history exists.',
    },
    waterfall: {
      title: 'Where your money goes',
      savingsRate: 'How much you save',
      highSavingsRateWarning:
        'You are saving too much: after saving, your fixed costs are no longer covered. Save a little less or lower your fixed costs.',
      stepHints: {
        savings: 'save before you spend',
        essentials: 'what you need to live',
        discretionary: 'whatever is left gets a job',
      },
    },
  },
  income: {
    stress: {
      sectionDescription: 'What happens to your money if one source of income disappears?',
      firstBreachShift: 'First time below your buffer',
      shiftNone: 'The buffer is only touched in one case — no day comparison possible.',
      notInForecast:
        'This income is not part of the outlook (irregular income is not projected).',
      deepDiveCta: 'Go to planning your available money',
      loading: 'Working out the case …',
    },
    tax: {
      title: 'Set aside for tax',
    },
  },
  contracts: {
    liabilitiesSum: 'Total of your debts',
    incomesMinusContracts: 'Income − contracts (what is left)',
  },
  debts: {
    // Labels only — "liabilities" becomes "debts". No legal statement is
    // touched here, so these get no RDG bridge to free debt counselling:
    // a pointer with no legal question attached is rhetoric, not care
    // (docs/RDG_TEXTREGELN.md, rule 2 applies only "where a legal question
    // arises"). "Repayment" is already everyday English, so only
    // `description` needs an entry.
    description: 'Keep track of debts and money you lent out, and plan how to pay them down.',
    debtCard: {
      balance: 'Still owed',
    },
    debtsPage: {
      currentBalance: 'Currently still owed',
    },
    detailSheet: {
      currentBalance: 'Currently still owed',
    },
    debtForm: {
      balanceLabel: 'Still owed (€)',
    },
  },
  trading: {
    dashboard: {
      summary: {
        return: 'Gain as a percentage',
      },
    },
  },
  /**
   * Tax: no technical term is replaced here, on purpose.
   *
   * "Werbungskosten", "Pauschbetrag" and "Anlage U" appear verbatim on the
   * German tax form the user fills in afterwards. Translating them away would
   * make the form harder to fill in, not easier.
   *
   * The English base already spells out most abbreviations ("low-value asset",
   * "depreciation"), so only the two genuinely opaque phrases get an entry.
   */
  tax: {
    rubric: {
      agb: {
        hint: 'Only take effect above the reasonable burden — the share you have to cover yourself (1–7% of income, depending on income and children). Collect all receipts anyway.',
      },
    },
    cat: {
      unterhaltEx: {
        hint: 'Real splitting up to €13,805/year (form Anlage U): you deduct the maintenance, the person receiving it pays tax on it — both have to agree.',
      },
    },
  },
};
