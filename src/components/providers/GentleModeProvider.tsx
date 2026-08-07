import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { getUserSettings, updateUserSettings } from "@/services/transaction-service";
import { gentleLevelFromLegacy, parseGentleLevel, type GentleLevel } from "@/lib/gentle-mode";

type GentleModeContextValue = {
  /** Wie viel gerade sichtbar ist. `0` ist aus, `3` verdeckt alles. */
  level: GentleLevel;
  /**
   * Ist der Modus überhaupt an? Für rein visuelle Abschwächungen, die keinen
   * Betrag betreffen (ruhigere Farben, weniger Alarm) — Beträge entscheiden
   * über ihre Klasse, nicht über dieses Flag.
   */
  enabled: boolean;
  setLevel: (level: GentleLevel) => void;
};

const GentleModeContext = createContext<GentleModeContextValue>({
  level: 0,
  enabled: false,
  setLevel: () => {},
});

export default function GentleModeProvider({ children }: { children: React.ReactNode }) {
  const initialApplied = useRef(false);

  // Fast boot: apply last local setting immediately
  useEffect(() => {
    if (initialApplied.current) return;
    applyGentleMode(parseGentleLevel(localStorage.getItem(FAST_BOOT_KEY)));
    initialApplied.current = true;
  }, []);

  const { data: settings } = useQuery({
    queryKey: ['userSettings'],
    queryFn: getUserSettings,
  });

  // `gentle_mode` steht nur noch für den Fall hier, dass die Migration in
  // `local-settings-service` noch nicht gelaufen ist (erster Start nach dem
  // Update, Einstellungen aus einem Backup). Geschrieben wird das Feld nie mehr.
  const level = settings?.gentle_level ?? gentleLevelFromLegacy(settings?.gentle_mode);

  useEffect(() => {
    applyGentleMode(level);
    localStorage.setItem(FAST_BOOT_KEY, String(level));
  }, [level]);

  const setLevel = useCallback(async (next: GentleLevel) => {
    try {
      await updateUserSettings({ gentle_level: next });
    } catch (error) {
      console.error("Failed to change gentle mode level:", error);
    }
  }, []);

  const value = useMemo(
    () => ({ level, enabled: level > 0, setLevel }),
    [level, setLevel],
  );

  return (
    <GentleModeContext.Provider value={value}>
      {children}
    </GentleModeContext.Provider>
  );
}

export const useGentleMode = () => useContext(GentleModeContext);

/**
 * Schnellstart-Wert. Der Schlüssel bleibt, obwohl er heute eine Stufe und
 * keinen Schalter mehr hält: Ein neuer Schlüssel hiesse, dass jeder
 * Bestandsnutzer beim ersten Start nach dem Update einen Wimpernschlag lang
 * unverdeckte Beträge sähe. `parseGentleLevel` liest den alten Wert mit.
 */
const FAST_BOOT_KEY = "gentleMode";

function applyGentleMode(level: GentleLevel) {
  document.documentElement.classList.toggle("gentle-mode", level > 0);
}
