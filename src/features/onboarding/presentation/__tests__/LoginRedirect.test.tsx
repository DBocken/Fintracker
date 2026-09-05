import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { readOnboardingDraft } from '../../data/onboarding-draft-store';
import LoginRedirect from '../LoginRedirect';

function renderRedirect() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginRedirect />} />
        <Route path="/willkommen/:step" element={<div>Anmeldeschritt</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LoginRedirect', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('[REGRESSION] sollte auf den Anmelde-Schritt führen, nicht auf die Lebenssituation', () => {
    // Beim Router-Umbau leitete `/login` auf `/willkommen` — und der
    // Wiederaufsetzpunkt eines anonym gestarteten Nutzers ist die
    // Lebenssituation. Wer sich anmelden wollte, bekam eine Frage nach
    // seinem Lebensabschnitt.
    renderRedirect();
    expect(screen.getByText('Anmeldeschritt')).toBeInTheDocument();
    expect(readOnboardingDraft()).toEqual({ step: 'anmeldung', path: 'account' });
  });
});
