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
  nav: {
    items: {
      liquidity: 'Available',
      netWorth: 'Bottom line',
    },
  },
  netWorth: {
    title: 'What you own minus debts',
    netWorth: 'What you own minus debts',
    liquidity: 'Money available now',
    composition: 'Money available now + investments + money owed to you − debts',
  },
  other: {
    liquidityTitle: 'Money available now',
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
  contracts: {
    liabilitiesSum: 'Total of your debts',
  },
  debts: {
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
};
