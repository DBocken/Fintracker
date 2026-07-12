import { useEffect, useState } from "react";

/**
 * Interner Baustein für breakpoint-basierte Hooks — kein eigenständiger
 * Public-API-Baustein für Features. Features nutzen die semantischen Hooks
 * `useIsMobile()`/`useIsWideDesktop()` (siehe deren JSDoc "Warum keine
 * generische `useBreakpoint(px)`-API?" — dieselbe Begründung gilt hier).
 *
 * SSR-/Test-sicher: kein `matchMedia` verfügbar → `false`. Reagiert live auf
 * Größenänderungen. Identischer Initializer-/Listener-Mechanik wie die beiden
 * Hooks, die vorher je eine eigene Kopie davon pflegten.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
