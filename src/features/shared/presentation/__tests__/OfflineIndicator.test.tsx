/**
 * WP-9.3 — Die Verbindungsanzeige.
 *
 * Der Prüfgegenstand ist nicht „zeigt ein Wolkensymbol", sondern die
 * AUSSAGE: In einer local-first App ist offline kein Ausfall. Ein Text, der
 * das Gegenteil nahelegt, wäre schlimmer als gar keiner — er würde einen
 * Ausfall behaupten, den es nicht gibt, und die beste Eigenschaft des
 * Produkts als Mangel darstellen.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithI18n } from '@/test-utils/render';
import OfflineIndicator from '../OfflineIndicator';

function setOnLine(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true });
}

afterEach(() => {
  setOnLine(true);
});

describe('OfflineIndicator (WP-9.3)', () => {
  it('sollte online gar nichts rendern', () => {
    // Ein dauerhaftes „online"-Abzeichen waere Rauschen — der Normalfall
    // braucht keine Meldung.
    setOnLine(true);
    const { container } = renderWithI18n(<OfflineIndicator />);
    expect(container).toBeEmptyDOMElement();
  });

  it('sollte offline ein Zeichen zeigen', () => {
    setOnLine(false);
    renderWithI18n(<OfflineIndicator />);
    expect(screen.getByTestId('offline-indicator')).toBeInTheDocument();
  });

  it('sollte erklaeren, dass die App weiterlaeuft', async () => {
    // Der Kern des Arbeitspakets. Die Anzeige darf keinen Ausfall behaupten.
    setOnLine(false);
    const user = userEvent.setup();
    renderWithI18n(<OfflineIndicator />);

    await user.click(screen.getByTestId('offline-indicator'));

    expect(
      await screen.findByText('Keine Verbindung — die App läuft weiter'),
    ).toBeInTheDocument();
    expect(screen.getByText(/liegen auf diesem Gerät/)).toBeInTheDocument();
  });

  it('sollte benennen, was tatsaechlich ruht', async () => {
    // Ohne diese Liste bliebe die Beruhigung unbelegt — und der Nutzer wuesste
    // nicht, warum die Kurse stehen.
    setOnLine(false);
    const user = userEvent.setup();
    renderWithI18n(<OfflineIndicator />);

    await user.click(screen.getByTestId('offline-indicator'));

    expect(await screen.findByText('Kurse und Marktdaten')).toBeInTheDocument();
    expect(screen.getByText('Bankabgleich')).toBeInTheDocument();
    expect(screen.getByText('Cloud-Abgleich')).toBeInTheDocument();
  });

  it('should explain in English too', async () => {
    setOnLine(false);
    const user = userEvent.setup();
    renderWithI18n(<OfflineIndicator />, 'en');

    await user.click(screen.getByTestId('offline-indicator'));

    expect(await screen.findByText('No connection — the app keeps working')).toBeInTheDocument();
  });

  it('sollte verschwinden, sobald die Verbindung zurueck ist', () => {
    setOnLine(false);
    renderWithI18n(<OfflineIndicator />);
    expect(screen.getByTestId('offline-indicator')).toBeInTheDocument();

    act(() => {
      setOnLine(true);
      window.dispatchEvent(new Event('online'));
    });

    expect(screen.queryByTestId('offline-indicator')).toBeNull();
  });
});
