import { useEffect, useState } from "react";

/** Tailwind `sm`-Breakpoint: darunter gilt die Ansicht als „mobil". */
const MOBILE_QUERY = "(max-width: 639px)";

/**
 * true, wenn der Viewport schmaler als der `sm`-Breakpoint ist. SSR-/Test-sicher
 * (kein `matchMedia` → false) und reagiert live auf Größenänderungen.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia(MOBILE_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
