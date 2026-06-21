import { useCallback, useEffect, useState } from "react";

/**
 * Ein Set von String-IDs, das in localStorage gespiegelt wird, damit es einen
 * Reload überlebt. Bewusst nur localStorage (keine verschlüsselten Finanzdaten):
 * es speichert lediglich UI-Zustand (z. B. ausgeblendete Buchungen), keine Beträge.
 */
export function usePersistedSet(storageKey: string): [Set<string>, (id: string) => void] {
  const [set, setSet] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem(storageKey);
      const arr = raw ? (JSON.parse(raw) as string[]) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(Array.from(set)));
    } catch {
      /* Speicher voll/blockiert – UI-Zustand ist nicht kritisch. */
    }
  }, [storageKey, set]);

  const toggle = useCallback((id: string) => {
    setSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return [set, toggle];
}
