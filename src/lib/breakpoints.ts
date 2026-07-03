/**
 * EINE Quelle der Wahrheit für die Layout-relevanten Breakpoints.
 *
 * Zuvor waren zwei Schwellen im Umlauf, die leicht verwechselt wurden:
 * `useIsMobile` prüfte 639px (sm), während die eigentlichen Layout-Umschaltungen
 * (Desktop-Raster vs. Mobile-Story) faktisch bei lg (1024px) passierten. Beides
 * sind unterschiedliche Anliegen und bleiben getrennt — aber ab hier definiert.
 */

/**
 * Mount-Autorität für den Darstellungsmodus (LayoutMode): Viewports bis
 * einschließlich dieser Breite gelten als `mobile`, darüber als `desktop`.
 * Entspricht der lg-Grenze (Tailwind lg = 1024px), an der Dashboard/Transactions/
 * Coach heute faktisch zwischen dichtem Raster und Mobile-Ansicht umschalten.
 */
export const LAYOUT_MODE_MAX_MOBILE = 1023;

/**
 * Feinjustierung innerhalb einer einzelnen Komponente (Mikro-Layout), NICHT der
 * Mount-Schalter. Entspricht dem Tailwind-sm-Breakpoint. `useIsMobile` nutzt
 * diese Schwelle unverändert weiter.
 */
export const MICRO_NARROW_MAX = 639;

/** `matchMedia`-Query für den LayoutMode-Mount-Schalter. */
export const LAYOUT_MODE_MOBILE_QUERY = `(max-width: ${LAYOUT_MODE_MAX_MOBILE}px)`;

/** `matchMedia`-Query für das Mikro-Layout (useIsMobile). */
export const MICRO_NARROW_QUERY = `(max-width: ${MICRO_NARROW_MAX}px)`;
