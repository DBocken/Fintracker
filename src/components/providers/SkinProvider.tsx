import React, { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { getUserSettings } from "@/services/transaction-service";
import { applySkinClass, type SkinId } from "@/skins/skins";

type SkinContextValue = {
  current: SkinId;
};

const SkinContext = createContext<SkinContextValue>({ current: 'legacy' });

function normalizeSkinId(raw?: string | null): SkinId {
  if (!raw) return 'legacy';
  if (raw.startsWith('clean-')) return 'clean'; // backward compatibility
  if (raw === 'clean') return 'clean';
  if (raw === 'neon') return 'neon';
  if (raw === 'legacy') return 'legacy';
  return 'legacy';
}

export default function SkinProvider({ children }: { children: React.ReactNode }) {
  const initialApplied = useRef(false);

  // Fast boot: apply last local skin immediately to reduce FOUC
  useEffect(() => {
    if (initialApplied.current) return;
    const local = normalizeSkinId(localStorage.getItem("skin"));
    applySkinClass(local);
    initialApplied.current = true;
  }, []);

  const { data: settings } = useQuery({
    queryKey: ['userSettings'],
    queryFn: getUserSettings,
  });

  const skin: SkinId = normalizeSkinId(settings?.theme);

  useEffect(() => {
    if (!skin) return;
    applySkinClass(skin);
    localStorage.setItem("skin", skin);
  }, [skin]);

  const value = useMemo(() => ({ current: skin }), [skin]);

  return (
    <SkinContext.Provider value={value}>
      {children}
    </SkinContext.Provider>
  );
}

export const useSkin = () => useContext(SkinContext);