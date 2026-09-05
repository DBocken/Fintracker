/**
 * Der gemeinsame Detailschritt — geprüft werden die beiden Regeln, die elf
 * Flächen sonst jede für sich neu treffen müssten.
 *
 * 1. Öffnen legt einen Verlaufseintrag an, Schliessen ersetzt ihn. Sonst
 *    schliesst die Android-Zurücktaste den Schritt nicht, sondern verlässt die
 *    Fläche — auf einem Telefon der häufigste Handgriff überhaupt.
 * 2. Fremde Adressparameter bleiben stehen. Sonst löschen Detailschritt und
 *    Filterspiegelung einander gegenseitig.
 */

import { describe, it, expect } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useNavigate, useSearchParams } from 'react-router-dom';
import { I18nProvider } from '@/i18n/I18nProvider';
import DetailSchritt from '../DetailSchritt';
import { useDetailParam } from '../useDetailParam';

function Flaeche({ wert = 'lage' }: { wert?: string }) {
  const { oeffnen } = useDetailParam(wert);
  return (
    <>
      <button type="button" onClick={oeffnen}>
        Mehr zu deiner Lage
      </button>
      <DetailSchritt wert={wert} titel="Deine Lage im Detail">
        <p>Alles Weitere</p>
      </DetailSchritt>
    </>
  );
}

function rendere(startAdresse = '/coach') {
  let navigate: ReturnType<typeof useNavigate> | null = null;
  let params: URLSearchParams | null = null;

  function Sonde() {
    navigate = useNavigate();
    [params] = useSearchParams();
    return null;
  }

  render(
    <I18nProvider initialLocale="de">
      <MemoryRouter initialEntries={[startAdresse]}>
        <Sonde />
        <Flaeche />
      </MemoryRouter>
    </I18nProvider>,
  );

  return {
    zurueck: () => act(() => navigate?.(-1)),
    adresse: () => params!,
  };
}

describe('Detailschritt', () => {
  it('[MOBILE] sollte alles Weitere erst nach dem Öffnen zeigen', async () => {
    const user = userEvent.setup();
    rendere();

    expect(screen.queryByText('Alles Weitere')).toBeNull();

    await user.click(screen.getByRole('button', { name: /Mehr zu deiner Lage/ }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Alles Weitere');
    expect(screen.getByText('Deine Lage im Detail')).toBeInTheDocument();
  });

  it('[REGRESSION] [MOBILE] sollte den Schritt in den Verlauf legen, damit die Zurücktaste ihn schliesst', async () => {
    // Geprüft über den Router, nicht über `window.history`: Die Testumgebung
    // fährt einen MemoryRouter, der `window.location` gar nicht anfasst. Die
    // Zurücktaste des Geräts landet im selben Router-Verlauf.
    const user = userEvent.setup();
    const { zurueck } = rendere();

    await user.click(screen.getByRole('button', { name: /Mehr zu deiner Lage/ }));
    await screen.findByRole('dialog');

    zurueck();

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('[REGRESSION] sollte fremde Adressparameter beim Öffnen stehen lassen', async () => {
    // Der Befund: Auf /transactions spiegelt ein Effekt den Filterzustand in
    // die Adresse und baut sie dabei komplett neu. Ein Detailschritt, der das
    // ebenso täte, löschte den Filter — und umgekehrt. Beide Seiten müssen
    // zusammenführen.
    const user = userEvent.setup();
    const { adresse } = rendere('/transactions?range=30d&q=rewe');

    await user.click(screen.getByRole('button', { name: /Mehr zu deiner Lage/ }));
    await screen.findByRole('dialog');

    expect(adresse().get('detail')).toBe('lage');
    expect(adresse().get('range')).toBe('30d');
    expect(adresse().get('q')).toBe('rewe');
  });

  it('sollte beim Schliessen nur den eigenen Schlüssel entfernen', async () => {
    const user = userEvent.setup();
    const { adresse, zurueck } = rendere('/transactions?range=30d');

    await user.click(screen.getByRole('button', { name: /Mehr zu deiner Lage/ }));
    await screen.findByRole('dialog');
    zurueck();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    expect(adresse().get('detail')).toBeNull();
    expect(adresse().get('range')).toBe('30d');
  });

  it('sollte einen fremden Detailwert nicht als den eigenen lesen', async () => {
    // Eine Fläche kann mehrere Schritte haben. `?detail=summen` darf den
    // Schritt `lage` nicht öffnen — sonst stünde in einer geteilten Adresse
    // etwas anderes, als sie zeigt.
    rendere('/coach?detail=summen');

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('sollte einen adressierten Schritt sofort offen zeigen', async () => {
    rendere('/coach?detail=lage');

    expect(await screen.findByRole('dialog')).toHaveTextContent('Alles Weitere');
  });
});
