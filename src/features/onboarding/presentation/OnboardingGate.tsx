/**
 * Die Schranke vor der App.
 *
 * Sie ersetzt den zweiten `<BrowserRouter>`, der bis hierher den Landing-Screen
 * getragen hat: Der Einstieg ist jetzt eine Route wie jede andere, und die
 * Schranke leitet nur dorthin um. Das ist der Unterschied, an dem der
 * OAuth-Rückweg hängt — ein zweiter Router hätte die Rückkehradresse nicht
 * gekannt.
 */

import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useOnboardingStatus } from '../application/use-onboarding-status';

export default function OnboardingGate({ children }: { children: ReactNode }) {
  const { loading, required } = useOnboardingStatus();
  const location = useLocation();

  // Kurzer, textloser Zwischenzustand — dasselbe Muster wie der Ladezustand in
  // `App.tsx`, damit die App nicht für einen Wimpernschlag aufblitzt.
  if (loading) return <div className="min-h-screen bg-background" />;
  if (required && !location.pathname.startsWith('/willkommen')) {
    return <Navigate to="/willkommen" replace />;
  }
  return <>{children}</>;
}
