import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { useQueryClient } from "@tanstack/react-query";
import { localEncryption } from "@/services/local-crypto";
import { useI18n } from "@/i18n/useI18n";
import { identityFromSubject, type Identity } from "@/lib/identity";

/**
 * Die Naht zum Identitätsanbieter (WP 2.1).
 *
 * Nach aussen gibt dieser Provider **nur** die eigene `Identity` und den
 * Status — keine Supabase-Typen. Das ist die Bedingung dafür, dass Phase 7
 * den Anbieter tauschen kann, ohne jede Aufrufstelle anzufassen: Wer hier
 * `Session`/`User` exportiert, verteilt ein Anbieterdetail über die ganze App.
 *
 * `session` gab es hier früher ebenfalls im Kontext — gelesen hat es **kein
 * einziger** Konsument (nachgezählt bei WP 2.1). Ein ungenutzter Export ist
 * keine Schnittstelle, sondern eine Einladung.
 */
type AuthContextValue = {
  identity: Identity | null;
  status: "loading" | "authenticated" | "unauthenticated";
};

const AuthContext = createContext<AuthContextValue>({
  identity: null,
  status: "loading",
});

/**
 * Liest die Identität aus einer Anbieter-Sitzung.
 *
 * Bewusst strukturell typisiert statt über `Session`/`User`: Der Typ
 * beschreibt, was wir **brauchen**, nicht was Supabase liefert — damit bleibt
 * die Datei frei von Anbieter-Typen (Akzeptanzkriterium WP 2.1).
 */
function identityFromSession(
  session:
    | {
        user?: {
          id?: string | null;
          email?: string | null;
          user_metadata?: Record<string, unknown> | null;
        } | null;
      }
    | null
    | undefined,
): Identity | null {
  const nutzer = session?.user;
  if (!nutzer) return null;
  return identityFromSubject({
    subject: nutzer.id,
    email: nutzer.email,
    claims: nutzer.user_metadata,
  });
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");
  const queryClient = useQueryClient();
  const { t } = useI18n();

  const clearCaches = useCallback(() => {
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        showError(t('auth.sessionCheckError'));
        setStatus("unauthenticated");
        return;
      }
      setIdentity(identityFromSession(data.session));
      setStatus(data.session ? "authenticated" : "unauthenticated");
    });

    const { data } = supabase.auth.onAuthStateChange((event, currentSession) => {
      const prevUserId = identity?.userId || null;
      const nextIdentity = identityFromSession(currentSession);
      const nextUserId = nextIdentity?.userId || null;

      setIdentity(nextIdentity);

      if (event === "SIGNED_IN") {
        // Bei Nutzerwechsel oder Anmeldung: Cache leeren
        if (prevUserId !== nextUserId) clearCaches();
        setStatus("authenticated");
        showSuccess(t('auth.loginSuccess'));
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
    // t bewusst nicht in Deps: würde den Auth-Listener bei jedem Sprachwechsel neu abonnieren.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity?.userId, queryClient, clearCaches]);

  return (
    <AuthContext.Provider value={{ identity, status }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

export default AuthProvider;
