import { useCallback, useEffect, useState } from 'react';
import {
  isFeatureEnabled,
  parseOverrides,
  userSettableOverrides,
  type FeatureFlagKey,
  type FeatureFlagOverrides,
} from '@/lib/feature-flags';

/**
 * React-Anbindung der Feature-Flags (WP-11.1).
 *
 * Bewusst `localStorage` und nicht IndexedDB: Ein Flag muss gelesen werden
 * können, BEVOR die verschlüsselte Ablage entsperrt ist — sonst liesse sich
 * ausgerechnet ein Not-Aus für einen Fehler beim Entsperren nicht ziehen. Es
 * stehen keine Finanzdaten darin, nur Wahrheitswerte.
 *
 * Der `storage`-Ereignishorcher hält zwei offene Tabs zusammen. Ohne ihn wäre
 * der Widerruf der Telemetrie in einem Tab im anderen wirkungslos, und dort
 * liefe die Aufzeichnung weiter — genau der Fall, in dem das Versprechen zählt.
 */

const STORAGE_KEY = 'fintracker_feature_flags_v1';

function read(): FeatureFlagOverrides {
  try {
    return parseOverrides(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'));
  } catch {
    return {};
  }
}

export function useFeatureFlags() {
  const [overrides, setOverrides] = useState<FeatureFlagOverrides>(read);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) setOverrides(read());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setFlag = useCallback((key: FeatureFlagKey, enabled: boolean) => {
    setOverrides((current) => {
      // `userSettableOverrides` filtert hier ein zweites Mal: Was eine Person
      // nicht selbst setzen darf, darf auch nicht ueber diesen Weg in den
      // Speicher — sonst waere der Not-Aus ueber die Einstellungen aushebelbar.
      const next = userSettableOverrides({ ...current, [key]: enabled });
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Speicher gesperrt: Die Auswahl gilt fuer diese Sitzung.
      }
      return next;
    });
  }, []);

  const isEnabled = useCallback(
    (key: FeatureFlagKey) => isFeatureEnabled(key, overrides),
    [overrides],
  );

  return { isEnabled, setFlag, overrides };
}
