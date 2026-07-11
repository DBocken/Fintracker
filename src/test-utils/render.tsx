import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '@/i18n/I18nProvider';
import type { Locale } from '@/i18n/translations';

const LOCALE_STORAGE_KEY = 'ausgabentracker_locale_v1';

/**
 * Zentraler Render-Helfer für i18n-Tests.
 *
 * Setzt localStorage UND übergibt `initialLocale`, damit sowohl Komponenten,
 * die die Startsprache über `initialLocale` beziehen, als auch solche, die
 * `localStorage` lesen (z. B. die eToro-Tabs), dieselbe Sprache sehen.
 */
export function renderWithI18n(ui: ReactElement, locale: Locale = 'de') {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  return render(<I18nProvider initialLocale={locale}>{ui}</I18nProvider>);
}

export interface RenderProvidersOptions {
  locale?: Locale;
  /** MemoryRouter ergänzen (Default an). */
  router?: boolean;
  /** QueryClientProvider mit retry-freiem Client ergänzen (Default aus). */
  query?: boolean;
}

/**
 * Render-Helfer mit fixierter Provider-Reihenfolge:
 * I18nProvider (außen) → QueryClientProvider → MemoryRouter → ui.
 * `router: false` überspringt den Router, `query: true` ergänzt react-query.
 */
export function renderWithProviders(
  ui: ReactElement,
  { locale = 'de', router = true, query = false }: RenderProvidersOptions = {},
) {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  let tree = ui;
  if (router) tree = <MemoryRouter>{tree}</MemoryRouter>;
  if (query) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    tree = <QueryClientProvider client={client}>{tree}</QueryClientProvider>;
  }
  return render(<I18nProvider initialLocale={locale}>{tree}</I18nProvider>);
}
