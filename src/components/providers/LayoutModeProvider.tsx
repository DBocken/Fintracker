import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { LAYOUT_MODE_MOBILE_QUERY } from "@/lib/breakpoints";

/**
 * Darstellungsmodus der App — die *Mount-Autorität* für Desktop- vs.
 * Mobile-Präsentation. Bewusst NICHT „Skin" genannt: „Skin" ist bereits die
 * Farbwelt (`src/skins`), hier geht es um die Layout-/Interaktionsstruktur.
 *
 * Anders als das bisherige CSS-Doppelrendering (`hidden lg:block` / `lg:hidden`,
 * beide Bäume mounten) ist dies ein echter JS-Schalter: der Orchestrator einer
 * Seite mountet genau EINE Variante → keine doppelten Queries, kein toter Baum.
 */
export type LayoutMode = "desktop" | "mobile";

type LayoutModeContextValue = {
  mode: LayoutMode;
  /** true, wenn der Modus per Override (URL/Präferenz) erzwungen ist, nicht per Viewport/Plattform. */
  isForced: boolean;
};

const LayoutModeContext = createContext<LayoutModeContextValue>({
  mode: "desktop",
  isForced: false,
});

/** Persistierte „Modus erzwingen"-Präferenz (spätere Einstellung). */
const OVERRIDE_STORAGE_KEY = "layout-mode-override";

function isLayoutMode(value: unknown): value is LayoutMode {
  return value === "mobile" || value === "desktop";
}

/**
 * Expliziter Override, falls vorhanden — gewinnt immer:
 * 1. URL-Parameter `?layout=mobile|desktop` (Deep-Links + deterministische Tests)
 * 2. persistierte Nutzer-Präferenz (`localStorage`)
 */
function readOverride(): LayoutMode | null {
  if (typeof window === "undefined") return null;
  try {
    const param = new URLSearchParams(window.location.search).get("layout");
    if (isLayoutMode(param)) return param;
  } catch {
    // ungültige URL — ignorieren
  }
  try {
    const stored = localStorage.getItem(OVERRIDE_STORAGE_KEY);
    if (isLayoutMode(stored)) return stored;
  } catch {
    // localStorage nicht verfügbar — ignorieren
  }
  return null;
}

function matchesMobileViewport(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(LAYOUT_MODE_MOBILE_QUERY).matches;
}

export default function LayoutModeProvider({ children }: { children: React.ReactNode }) {
  const [viewportIsMobile, setViewportIsMobile] = useState(matchesMobileViewport);

  // Live auf Viewport-Änderungen reagieren (Resize, Geräterotation).
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(LAYOUT_MODE_MOBILE_QUERY);
    const onChange = () => setViewportIsMobile(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const value = useMemo<LayoutModeContextValue>(() => {
    const override = readOverride();
    if (override) return { mode: override, isForced: true };
    // Native App (Capacitor) ist immer mobil, unabhängig vom Fenster.
    if (Capacitor.isNativePlatform()) return { mode: "mobile", isForced: false };
    return { mode: viewportIsMobile ? "mobile" : "desktop", isForced: false };
  }, [viewportIsMobile]);

  return <LayoutModeContext.Provider value={value}>{children}</LayoutModeContext.Provider>;
}

export function useLayoutMode(): LayoutModeContextValue {
  return useContext(LayoutModeContext);
}
