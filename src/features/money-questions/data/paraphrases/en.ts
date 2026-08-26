/**
 * English paraphrases — smaller than the German set, and that asymmetry is a
 * NAMED decision, not neglect: the measured corpus (the 225 owner-provided
 * questions) is German, so German carries the calibration. English grows the
 * same way German did — through curation and the local learning loop.
 */
import { LUECKE_KLASSE } from '@/lib/question-intent-model';

export const PARAPHRASEN_EN: Readonly<Record<string, readonly string[]>> = {
  'ausgaben.haendler': [
    'how much did i spend at amazon',
    'my total payments to netflix',
    'what did i pay at the supermarket',
  ],
  'ausgaben.kategorie': [
    'how much went on groceries',
    'my spending on clothes this year',
    'what did i pay for leisure',
  ],
  'ausgaben.gesamt': [
    'my total spending last month',
    'how much money went out overall',
    'sum of all my expenses this year',
  ],
  'ausgaben.topHaendler': [
    'which merchants get most of my money',
    'my most expensive stores',
    'top ten merchants by spending',
  ],
  'ausgaben.topKategorien': [
    'what do i mostly spend money on',
    'my biggest spending categories',
    'where does most of my money go',
  ],
  'ausgaben.ungewoehnlich': [
    'any unusual spending lately',
    'which months were oddly expensive',
    'outliers in my expenses',
  ],
  'einnahmen.zeitraum': [
    'how much came in this month',
    'my income this quarter',
    'total earnings this year',
  ],
  'einkommen.letztes': [
    'when did my last salary arrive',
    'how much was my last paycheck',
    'has my salary come in yet',
  ],
  'einkommen.durchschnitt': [
    'my average monthly income',
    'what do i earn on average',
    'was my salary lower than usual',
  ],
  'einkommen.schwankung': [
    'how stable is my income',
    'does my income vary a lot',
    'how much does my pay fluctuate',
  ],
  'vertrag.jahreskosten': [
    'what does netflix cost me per year',
    'yearly cost of my phone contract',
    'my insurance per year',
  ],
  'abos.liste': [
    'show me my subscriptions',
    'which contracts am i running',
    'list of my active subscriptions',
  ],
  'abos.summe': [
    'what do all my subscriptions cost together',
    'monthly total of my subscriptions',
    'my subscriptions combined',
  ],
  'vertraege.teurer': [
    'which subscriptions got more expensive',
    'any price increases in my contracts',
    'which contracts cost more now',
  ],
  'fixkosten.monatlich': [
    'how high are my fixed costs',
    'my fixed monthly expenses',
    'what do i pay fixed each month',
  ],
  'fixkosten.anteil': [
    'what share of my income is fixed costs',
    'how much of my salary is already committed',
    'fixed cost ratio of my income',
  ],
  'schulden.restschuld': [
    'how much do i still owe',
    'my outstanding debt',
    'current state of my loans',
  ],
  'raten.offen': [
    'how many instalments are left',
    'remaining payments on my financing',
    'when is my instalment plan done',
  ],
  'leistbarkeit.anschaffung': [
    'can i afford a 3000 vacation',
    'is a 1500 purchase feasible for me',
    'can i buy a laptop for 1200',
  ],
  'budget.aktion': [
    'create a budget of 200 for groceries',
    'set my leisure budget to 150',
    'increase the shopping budget by 40',
    'delete the budget for cinema',
  ],
  'szenario.kombination': [
    'what if i sell my car and take the train instead',
    'run the numbers on a raise plus higher rent',
    'play through me quitting and starting something new',
  ],
  'ausgaben.durchschnitt': [
    'what does that cost me each month on average',
    'monthly burden from these costs',
    'average monthly spend on that',
  ],
  'ausgaben.anteil': [
    'how big a slice of everything is that',
    'what portion of my costs goes there',
    'what percentage of the whole is that',
  ],
  'ausgaben.jeVorgang': [
    'how pricey is one shop there on average',
    'what do i drop per visit',
    'typical size of a single payment there',
  ],
  'ausgaben.extremwert': [
    'when did i pay the most for that',
    'which month was the priciest',
    'what was my single biggest expense',
  ],
  'ausgaben.trend': [
    'is that getting more or less over time',
    'is it going up or down',
    'how does that run across the months',
  ],
  'vergleich.haendler': [
    'which of the two shops costs me more',
    'put the two merchants side by side',
    'who is pricier of the two',
  ],
  'vergleich.kategorie': [
    'which of the two areas costs me more',
    'put the two areas side by side',
    'which pot is bigger',
  ],
  'vergleich.zeitraum': [
    'has that grown since back then',
    'do i pay more today than before for that',
    'difference to the same period before',
  ],
  'budget.status': [
    'how are my budgets doing',
    'am i over budget',
    'which budgets are blown',
  ],
  'budget.rest': [
    'how much budget is left',
    'what remains in my grocery budget',
    'remaining budget this month',
  ],
  'budget.tagesrate': [
    'how much can i spend per day',
    'my daily budget until month end',
    'daily allowance so the budget lasts',
  ],
  'forecast.monatsende': [
    'where will my balance land at month end',
    'will my money last until the end of the month',
    'projected balance end of month',
  ],
  'forecast.horizont': [
    'my balance in three months',
    'where am i financially in half a year',
    'when will my account run low',
  ],
  'konto.saldo': [
    'how much is in my current account',
    'what is the balance of my savings account',
    'how much money do i have on that account',
    'show me the balance of my checking account',
    'what is on my credit card',
    'balance of my savings account please',
    'how much is left on the account',
    'what does that account hold right now',
  ],
  'konto.gesamt': [
    'how much money do i have in total',
    'what is on all my accounts together',
    'total balance across my accounts',
    'how much cash do i have altogether',
    'sum of all my account balances',
    'how much liquid money do i have right now',
    'what do all my accounts add up to',
    'how much do i own in cash and balances',
  ],
  'verfuegbar.bisGehalt': [
    'what can i still spend until payday',
    'how much is free until my next salary',
    'will i make it to payday',
  ],
  [LUECKE_KLASSE]: [
    'how do i get rich quickly',
    'what is the best way to save',
    'which investment do you recommend',
    'what would you do in my place',
    'how should i split money with my partner',
    'how much house can i afford',
    'what should my day rate be as a freelancer',
    'what if i quit my job',
    'is buying better than renting for me',
    'which insurance do i really need',
  ],
};
