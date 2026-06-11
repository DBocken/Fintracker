import { useCallback, useEffect, useState } from "react";
import {
  type FeatureFlag,
  isFeatureEnabled,
  setFeatureEnabled,
} from "@/lib/feature-flags";

const EVENT_NAME = "fintracker:flag-changed";

/**
 * Reaktiver Zugriff auf ein lokales Feature-Flag. Änderungen (auch in anderen
 * Komponenten oder Browser-Tabs) aktualisieren alle Verbraucher.
 */
export function useFeatureFlag(flag: FeatureFlag): [boolean, (enabled: boolean) => void] {
  const [enabled, setEnabled] = useState(() => isFeatureEnabled(flag));

  useEffect(() => {
    const sync = () => setEnabled(isFeatureEnabled(flag));
    window.addEventListener(EVENT_NAME, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT_NAME, sync);
      window.removeEventListener("storage", sync);
    };
  }, [flag]);

  const set = useCallback(
    (value: boolean) => {
      setFeatureEnabled(flag, value);
      setEnabled(value);
      window.dispatchEvent(new Event(EVENT_NAME));
    },
    [flag],
  );

  return [enabled, set];
}
