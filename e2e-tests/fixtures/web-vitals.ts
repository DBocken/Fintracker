import type { Page } from "@playwright/test";

/**
 * Eine Messung, zwei Nutzer: das Slice-Gate
 * (`vertical-slice-performance.spec.ts`) und die Flächenprüfung
 * (`all-screens-performance.spec.ts`).
 *
 * Bewusst hier und nicht zweimal kopiert: Zwei Fassungen des Sammelfensters
 * oder der `hadRecentInput`-Regel würden zwei verschiedene Zahlen liefern, und
 * dann wäre nicht mehr entscheidbar, welche stimmt.
 */
export type WebVitals = { lcp: number; cls: number };

/** Sammelfenster in ms. LCP/CLS sind kurz nach Load final (keine Nutzer-Eingabe). */
const COLLECT_WINDOW_MS = 2000;

export async function collectWebVitals(page: Page): Promise<WebVitals> {
  return page.evaluate(
    (windowMs) =>
      new Promise<WebVitals>((resolve) => {
        let lcp = 0;
        let cls = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) lcp = entry.startTime;
        }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const shift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
            // Verschiebungen unmittelbar nach einer Eingabe zählen nicht: Die
            // hat der Nutzer selbst ausgelöst und erwartet sie.
            if (!shift.hadRecentInput) cls += shift.value ?? 0;
          }
        }).observe({ type: "layout-shift", buffered: true });
        setTimeout(() => resolve({ lcp, cls }), windowMs);
      }),
    COLLECT_WINDOW_MS,
  );
}

/**
 * LCP-Budget in ms — hängt am Ziel: `preview` ist der Produktions-Build und
 * damit das Gate des Plans (§5/§7), `dev` nur eine Rückmeldung, weil Vite
 * on-the-fly transformiert.
 */
export const lcpBudgetMs = () => (process.env.E2E_TARGET === "preview" ? 2500 : 4000);

/** CLS ist buildunabhängig — dasselbe Budget in beiden Läufen. */
export const CLS_BUDGET = 0.1;
