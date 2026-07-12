import { useMediaQuery } from "./useMediaQuery";

/**
 * true ab dem `lg`-Breakpoint (min-width: 1024px) — Schwelle für Master-Detail-Split.
 * SSR-/Test-sicher: kein `matchMedia` verfügbar → false.
 * Reagiert live auf Größenänderungen.
 *
 * **Breakpoint-Landschaft:**
 * - `useIsMobile()` = < 640px (Tailwind `sm`) — reine Mobil-Ansicht
 * - `useIsWideDesktop()` = ≥ 1024px (Tailwind `lg`) — Master-Detail-Split
 * - Zwischen 640–1024px: Tablet-Übergangszone, meist mit Mobile-Layout (bis Detail nötig ist)
 *
 * **Warum keine generische `useBreakpoint(px)`-API?**
 * Zwei feste semantische Hooks (`useIsMobile`, `useIsWideDesktop`) genügen für unsere
 * Layouts und verhindern Breakpoint-Wildwuchs. Neue responsive Weichen sollten auf einer
 * dieser beiden aufbauen oder (intern) ein drittes semantisches Breakpoint hinzufügen,
 * nicht eine generische Funktion verwenden. (Intern teilen sich beide Hooks denselben
 * `useMediaQuery`-Baustein — das ist Implementierungsdetail, keine öffentliche API.)
 */
export function useIsWideDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}
