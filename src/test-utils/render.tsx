import type { ReactElement, ReactNode } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '@/i18n/I18nProvider';
import type { Locale } from '@/i18n/translations';
import { DEFAULT_WORDING, WORDING_STORAGE_KEY, type Wording } from '@/i18n/wording';

const LOCALE_STORAGE_KEY = 'ausgabentracker_locale_v1';

/**
 * Setzt Sprache und Sprachstil auf BEIDEN Wegen: localStorage UND Provider-Prop.
 *
 * Das ist kein Gürtel-und-Hosenträger, sondern nötig, weil Komponenten ihre
 * Texte über den Provider beziehen, `serviceT`-gestützter Code (services/, lib/)
 * aber direkt aus localStorage liest. Wird nur einer der beiden Wege gesetzt,
 * läuft ein Teil des Tests im anderen Register bzw. in der anderen Sprache als
 * der Rest — eine der schwerer auffindbaren Testfehlerquellen.
 */
function pinI18n(locale: Locale, wording: Wording) {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  window.localStorage.setItem(WORDING_STORAGE_KEY, wording);
}

/**
 * Zentraler Render-Helfer für i18n-Tests.
 */
export function renderWithI18n(
  ui: ReactElement,
  locale: Locale = 'de',
  wording: Wording = DEFAULT_WORDING,
) {
  pinI18n(locale, wording);
  return render(
    <I18nProvider initialLocale={locale} initialWording={wording}>
      {ui}
    </I18nProvider>,
  );
}

export interface RenderProvidersOptions {
  locale?: Locale;
  /** Sprachstil (Alltags-/Fachsprache). Default: der Produktions-Standard. */
  wording?: Wording;
  /** MemoryRouter ergänzen (Default an). */
  router?: boolean;
  /**
   * Startadresse des MemoryRouter — für Flächen, die ihren Zustand aus der
   * Abfragezeichenkette lesen (`?view=`, `?detail=`). Ohne das musste jede
   * solche Datei den Router selbst aufbauen und damit die zentral fixierte
   * Provider-Reihenfolge nachbauen (AGENTS §5: Helfer nur zentral).
   */
  initialEntries?: string[];
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
  {
    locale = 'de',
    wording = DEFAULT_WORDING,
    router = true,
    query = false,
    initialEntries,
  }: RenderProvidersOptions = {},
) {
  pinI18n(locale, wording);
  let tree = ui;
  if (router) tree = <MemoryRouter initialEntries={initialEntries}>{tree}</MemoryRouter>;
  // Bei `query: true` wird der Client mit zurueckgegeben, damit Tests
  // Cache-Invalidierung zusichern koennen (WP 6.3b) — vorher war er im
  // Closure gefangen und genau diese Zusicherung nicht formulierbar.
  let client: QueryClient | undefined;
  if (query) {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    tree = <QueryClientProvider client={client}>{tree}</QueryClientProvider>;
  }
  return {
    ...render(
      <I18nProvider initialLocale={locale} initialWording={wording}>
        {tree}
      </I18nProvider>,
    ),
    queryClient: client,
  };
}

export interface HookWrapperOptions {
  locale?: Locale;
  wording?: Wording;
}

export interface HookWrapperResult {
  wrapper: (props: { children: ReactNode }) => ReactElement;
  /** Frischer QueryClient der Wrapper-Instanz — z.B. zum Spyen auf `invalidateQueries`. */
  queryClient: QueryClient;
}

/**
 * Wrapper-Helfer für `renderHook()` bei Application-/Feature-Hooks, die
 * `useI18n()` UND React-Query (`useQuery`/`useMutation`) benötigen. Liefert
 * den `QueryClient` zurück, damit Tests eigene Assertions (z.B. Spies auf
 * `invalidateQueries`) daran hängen können, statt einen neuen Client zu bauen.
 */
export function createHookWrapper({
  locale = 'de',
  wording = DEFAULT_WORDING,
}: HookWrapperOptions = {}): HookWrapperResult {
  pinI18n(locale, wording);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nProvider initialLocale={locale} initialWording={wording}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </I18nProvider>
  );
  return { wrapper, queryClient };
}
