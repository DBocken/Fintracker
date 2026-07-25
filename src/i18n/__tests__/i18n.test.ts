import { describe, it, expect, beforeEach } from 'vitest';
import { lookupTranslation, resolveInitialLocale } from '../I18nProvider';

beforeEach(() => {
  window.localStorage.clear();
});

describe('lookupTranslation', () => {
  it('resolves a nested key for the given locale', () => {
    expect(lookupTranslation('de', 'common.save')).toBe('Speichern');
    expect(lookupTranslation('en', 'common.save')).toBe('Save');
  });

  it('returns undefined for a missing key', () => {
    expect(lookupTranslation('de', 'common.does.not.exist')).toBeUndefined();
  });

  it('returns undefined when the path points to a non-string node', () => {
    expect(lookupTranslation('de', 'common')).toBeUndefined();
  });
});

describe('resolveInitialLocale', () => {
  it('prefers a stored locale', () => {
    window.localStorage.setItem('ausgabentracker_locale_v1', 'en');
    expect(resolveInitialLocale()).toBe('en');
  });

  it('[REGRESSION] ignores an invalid stored locale and falls back deterministically', () => {
    // Hedgte frueher auf `expect(['de','en']).toContain(...)`, weil das Ergebnis
    // an jsdoms `navigator.language` (en-US) hing. `vitest.setup.ts` pinnt die
    // Browsersprache jetzt auf de-DE — diese Assertion ist der Nachweis dafuer.
    window.localStorage.setItem('ausgabentracker_locale_v1', 'fr');
    expect(resolveInitialLocale()).toBe('de');
  });
});

describe('i18n Coverage - Full App Translation', () => {
  it('[REGRESSION] sollte alle Coach-Texte in beiden Sprachen haben', () => {
    const coachKeys = [
      'coach.topActionToday',
      'coach.nextPayday',
      'coach.whenToday',
      'coach.whenTomorrow',
      'coach.whenInDays',
      'coach.upcomingCharges',
      'coach.noUpcomingCharges',
    ];

    coachKeys.forEach(key => {
      expect(lookupTranslation('de', key)).toBeDefined();
      expect(lookupTranslation('en', key)).toBeDefined();
    });
  });

  it('[REGRESSION] sollte Accessibility-Labels in beiden Sprachen haben', () => {
    const a11yKeys = [
      'a11y.languageSelect',
      'a11y.profileOpen',
      'a11y.login',
      'a11y.logout',
    ];

    a11yKeys.forEach(key => {
      expect(lookupTranslation('de', key)).toBeDefined();
      expect(lookupTranslation('en', key)).toBeDefined();
    });
  });

  it('sollte Helper-Funktionen für dynamische Strings unterstützen', () => {
    expect(lookupTranslation('de', 'common.pluralTransaction')).toBeDefined();
    expect(lookupTranslation('de', 'common.singularTransaction')).toBeDefined();
  });

  it('[REGRESSION] sollte alle Einkommens-Texte ("Woher kommt mein Geld?") in beiden Sprachen haben', () => {
    const incomeKeys = [
      'income.title',
      'income.subtitle',
      'income.kpiTotal',
      'income.kpiStreams',
      'income.kpiLargestShare',
      'income.diversificationConcentrated',
      'income.diversificationModerate',
      'income.diversificationDiversified',
      'income.cadenceRegular',
      'income.cadenceIrregular',
      'income.trendUp',
      'income.trendDown',
      'income.trendFlat',
      'income.breakdownTitle',
      'income.overTimeTitle',
      'income.streamsTitle',
      'income.emptyTitle',
      'income.emptyDesc',
      'income.noIncome',
      'income.monthlyAvg',
      'income.lastReceived',
      'income.showAll',
      'income.period12Months',
      'income.periodAll',
      'income.periodSelectorLabel',
      'nav.items.income',
      'nav.subtitles.income',
      'analysisDataService.otherInflows',
    ];

    incomeKeys.forEach((key) => {
      expect(lookupTranslation('de', key)).toBeDefined();
      expect(lookupTranslation('en', key)).toBeDefined();
    });
  });

  it('[REGRESSION] sollte alle Creator-Paket-Texte in allen drei Sprachen (de/en/tlh) haben', () => {
    // tlh hat KEINEN Fallback in lookupTranslation — ein fehlender Key erscheint
    // roh im UI. Deshalb prüft dieser Test bewusst auch tlh.
    const creatorKeys = [
      'upsell.features.creatorPack.eyebrow',
      'upsell.features.creatorPack.title',
      'upsell.features.creatorPack.benefit1',
      'upsell.features.creatorPack.benefit2',
      'upsell.features.creatorPack.benefit3',
      'income.radar.title',
      'income.radar.description',
      'income.radar.confidenceHigh',
      'income.radar.confidenceMedium',
      'income.radar.confidenceLow',
      'income.radar.overdue',
      'income.radar.empty',
      'income.radar.expectedOn',
      'income.share.buttonLabel',
      'income.share.dialogTitle',
      'income.share.dialogDescription',
      'income.share.cardTitle',
      'income.share.cardOther',
      'income.share.cardStreamsCount',
      'income.share.formatStory',
      'income.share.formatSquare',
      'income.share.exportButton',
      'income.share.privacyNote',
      'income.stress.sectionTitle',
      'income.stress.sectionDescription',
      'income.stress.rowAria',
      'income.stress.dialogTitle',
      'income.stress.scenarioName',
      'income.stress.lowestBalance',
      'income.stress.daysBelowBuffer',
      'income.stress.firstBreachShift',
      'income.stress.shiftDays',
      'income.stress.shiftNone',
      'income.stress.notInForecast',
      'income.stress.deepDiveCta',
      'income.stress.loading',
      'income.tax.title',
      'income.tax.hintLine',
      'income.tax.reserveTotalLabel',
      'income.tax.disclaimer',
      'income.tax.settingsLink',
      'income.wrapped.entryButton',
      'income.wrapped.title',
      'income.wrapped.partialNote',
      'income.wrapped.introTitle',
      'income.wrapped.introHint',
      'income.wrapped.totalTitle',
      'income.wrapped.totalCount',
      'income.wrapped.bestMonthTitle',
      'income.wrapped.growthTitle',
      'income.wrapped.growthValue',
      'income.wrapped.loyalTitle',
      'income.wrapped.loyalValue',
      'income.wrapped.diversityTitle',
      'income.wrapped.finalTitle',
      'income.wrapped.close',
      'income.wrapped.progressAria',
      'income.wrapped.noDataTitle',
      'income.wrapped.noDataDesc',
      'settings.taxReserve.title',
      'settings.taxReserve.description',
      'settings.taxReserve.label',
      'settings.taxReserve.saved',
      'settings.taxReserve.saveError',
      'coachService.recommendations.taxReserveTitle',
      'coachService.recommendations.taxReserveMessage',
      'coachService.recommendations.taxReserveReason',
      'coachService.recommendations.taxReserveCta',
    ];

    creatorKeys.forEach((key) => {
      expect(lookupTranslation('de', key), `de:${key}`).toBeDefined();
      expect(lookupTranslation('en', key), `en:${key}`).toBeDefined();
      expect(lookupTranslation('tlh', key), `tlh:${key}`).toBeDefined();
    });
  });
});
