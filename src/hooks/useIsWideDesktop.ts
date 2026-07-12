import { useEffect, useState } from "react";

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
 * nicht eine generische Funktion verwenden.
 */
export function useIsWideDesktop(): boolean {
  const query = "(min-width: 1024px)";
  const [wide, setWide] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia(query).matches;
  });
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(query);
    const onChange = () => setWide(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return wide;
}
