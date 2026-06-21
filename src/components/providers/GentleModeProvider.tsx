import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { getUserSettings, updateUserSettings } from "@/services/transaction-service";

type GentleModeContextValue = {
  enabled: boolean;
  toggle: () => void;
};

const GentleModeContext = createContext<GentleModeContextValue>({
  enabled: false,
  toggle: () => {},
});

export default function GentleModeProvider({ children }: { children: React.ReactNode }) {
  const initialApplied = useRef(false);

  // Fast boot: apply last local setting immediately
  useEffect(() => {
    if (initialApplied.current) return;
    const local = localStorage.getItem("gentleMode") === "true";
    applyGentleMode(local);
    initialApplied.current = true;
  }, []);

  const { data: settings } = useQuery({
    queryKey: ['userSettings'],
    queryFn: getUserSettings,
  });

  const enabled = settings?.gentle_mode ?? false;

  useEffect(() => {
    applyGentleMode(enabled);
    localStorage.setItem("gentleMode", enabled ? "true" : "false");
  }, [enabled]);

  const toggle = useCallback(async () => {
    try {
      await updateUserSettings({ gentle_mode: !enabled });
    } catch (error) {
      console.error("Failed to toggle gentle mode:", error);
    }
  }, [enabled]);

  const value = useMemo(() => ({ enabled, toggle }), [enabled, toggle]);

  return (
    <GentleModeContext.Provider value={value}>
      {children}
    </GentleModeContext.Provider>
  );
}

export const useGentleMode = () => useContext(GentleModeContext);

function applyGentleMode(enabled: boolean) {
  if (enabled) {
    document.documentElement.classList.add("gentle-mode");
  } else {
    document.documentElement.classList.remove("gentle-mode");
  }
}
