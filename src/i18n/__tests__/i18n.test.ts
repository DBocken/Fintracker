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
