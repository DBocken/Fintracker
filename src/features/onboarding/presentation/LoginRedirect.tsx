/**
 * Der Altpfad `/login`, umgeleitet in den Anmelde-Schritt des Einstiegs.
 *
 * Eine eigene Komponente und keine blosse `<Navigate to="/willkommen/anmeldung">`,
 * weil der Entwurf VOR der Umleitung stehen muss: Ohne ihn beschneidet
 * `resolveStartStep` den Sprung — die Anmeldung setzt den Konto-Weg voraus,
 * und der ist ohne Entwurf nicht gewählt.
 */

import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { enterOnboardingAtSignIn } from '../data/onboarding-restart';

export default function LoginRedirect() {
  // Im Initialisierer statt in einem Effekt: Die Umleitung rendert sofort,
  // ein Effekt liefe erst danach — und dann wäre der Entwurf zu spät da.
  useState(() => {
    enterOnboardingAtSignIn();
    return null;
  });

  return <Navigate to="/willkommen/anmeldung" replace />;
}
