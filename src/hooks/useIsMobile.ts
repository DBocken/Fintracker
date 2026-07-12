import { useMediaQuery } from "./useMediaQuery";

/** Tailwind `sm`-Breakpoint: darunter gilt die Ansicht als „mobil". */
const MOBILE_QUERY = "(max-width: 639px)";

/**
 * true, wenn der Viewport schmaler als der `sm`-Breakpoint ist. SSR-/Test-sicher
 * (kein `matchMedia` → false) und reagiert live auf Größenänderungen.
 */
export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_QUERY);
}
