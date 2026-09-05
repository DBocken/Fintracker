/**
 * Lesezugriff auf die Identität — ohne die Provider-Komponente.
 *
 * Der Hook lag zuvor in `components/providers/AuthProvider.tsx`, weil er dort
 * neben seinem Provider entstanden ist. Damit musste jeder Leser eine
 * Komponentendatei importieren — auch das ViewModel des Einstiegs, das
 * lediglich wissen will, ob jemand angemeldet ist. Genau daran ist
 * `check:layers` (`feature-application-ohne-ui`) hängengeblieben, und zu
 * Recht: Eine zweite Präsentation müsste sonst die alte Oberfläche
 * mitschleppen, nur damit ein Hook noch auflöst.
 *
 * Der Provider bleibt Komponente (er IST eine), der Lesezugriff nicht —
 * dieselbe Trennung wie bei `useLocalEncryption` (AGENTS.md §3, „Wohin ein Typ
 * gehört").
 *
 * Nach aussen gibt es weiterhin **nur** die eigene `Identity` und den Status,
 * keine Anbieter-Typen: Das ist die Bedingung dafür, dass der Anbieter
 * getauscht werden kann, ohne jede Aufrufstelle anzufassen (WP 2.1).
 */
import { createContext, useContext } from 'react';
import type { Identity } from '@/lib/identity';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export type AuthContextValue = {
  identity: Identity | null;
  status: AuthStatus;
};

export const AuthContext = createContext<AuthContextValue>({
  identity: null,
  status: 'loading',
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
