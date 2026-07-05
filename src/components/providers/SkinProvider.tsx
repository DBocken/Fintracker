import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getUserSettings } from "@/services/transaction-service";
import { applySkinClass, normalizeSkinId, type SkinId } from "@/skins/skins";
import { useLocalEncryption } from "@/components/providers/LocalEncryptionProvider";

type SkinContextValue = {
  current: SkinId;
};

const SkinContext = createContext<SkinContextValue>({ current: 'ruhe' });

export default function SkinProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { enabled, unlocked } = useLocalEncryption();

  // Fast boot: apply last local skin immediately to reduce FOUC
  const [current, setCurrent] = useState<SkinId>(() =>
    normalizeSkinId(typeof localStorage !== "undefined" ? localStorage.getItem("skin") : null),
  );

  useEffect(() => {
    applySkinClass(current);
    // Nur beim Mount — danach steuern die geladenen Einstellungen das Theme.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: settings } = useQuery({
    queryKey: ['userSettings'],
    queryFn: getUserSettings,
  });

  // Bei gesperrtem Tresor schlägt die Query mit LocalEncryptionLockedError fehl
  // und würde ohne Invalidierung nie das gespeicherte Theme liefern (der
  // Provider remountet nicht). Nach dem Entsperren daher neu laden.
  useEffect(() => {
    if (enabled && unlocked) {
      queryClient.invalidateQueries({ queryKey: ['userSettings'] });
    }
  }, [enabled, unlocked, queryClient]);

  useEffect(() => {
    // Solange die Einstellungen nicht geladen sind (z. B. Tresor gesperrt),
    // die lokal gemerkte Skin behalten — ein Fallback auf 'ruhe' würde das
    // eigentliche Theme im localStorage überschreiben.
    if (!settings) return;
    const skin = normalizeSkinId(settings.theme);
    applySkinClass(skin);
    localStorage.setItem("skin", skin);
    setCurrent(skin);
  }, [settings]);

  const value = useMemo(() => ({ current }), [current]);

  return (
    <SkinContext.Provider value={value}>
      {children}
    </SkinContext.Provider>
  );
}

export const useSkin = () => useContext(SkinContext);
