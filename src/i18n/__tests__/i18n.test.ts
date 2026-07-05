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

  it('ignores an invalid stored locale and falls back', () => {
    window.localStorage.setItem('ausgabentracker_locale_v1', 'fr');
    // jsdom navigator.language is typically en-US → resolves to 'en', else default 'de'
    expect(['de', 'en']).toContain(resolveInitialLocale());
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
});
