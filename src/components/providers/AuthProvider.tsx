import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { useQueryClient } from "@tanstack/react-query";
import { localEncryption } from "@/services/local-crypto";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  status: "loading" | "authenticated" | "unauthenticated";
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  status: "loading",
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");
  const queryClient = useQueryClient();

  const clearCaches = useCallback(() => {
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        showError("Anmeldung konnte nicht geprüft werden");
        setStatus("unauthenticated");
        return;
      }
      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
      setStatus(data.session ? "authenticated" : "unauthenticated");
    });

    const { data } = supabase.auth.onAuthStateChange((event, currentSession) => {
      const prevUserId = user?.id || null;
      const nextUserId = currentSession?.user?.id || null;

      setSession(currentSession ?? null);
      setUser(currentSession?.user ?? null);

      if (event === "SIGNED_IN") {
        // Bei Nutzerwechsel oder Anmeldung: Cache leeren
        if (prevUserId !== nextUserId) clearCaches();
        setStatus("authenticated");
        showSuccess("Erfolgreich angemeldet");
      } else if (event === "SIGNED_OUT") {
        clearCaches();
        localEncryption.lock();
        setStatus("unauthenticated");
      } else if (event === "INITIAL_SESSION") {
        // Beim Initialisieren bei abweichender User-ID ebenfalls cache leeren
        if (prevUserId !== nextUserId) clearCaches();
        setStatus(currentSession ? "authenticated" : "unauthenticated");
      }
    });

    return () => {
      data.subscription.unsubscribe();
      mounted = false;
    };
  }, [user?.id, queryClient, clearCaches]);

  return (
    <AuthContext.Provider value={{ session, user, status }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

export default AuthProvider;