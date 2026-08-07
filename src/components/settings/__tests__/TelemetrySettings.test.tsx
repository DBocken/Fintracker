import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithI18n } from '@/test-utils/render';
import { TelemetrySettings } from '../TelemetrySettings';
import { readQueue, recordTelemetryEvent } from '@/services/telemetry-service';

/**
 * WP-11.2 — Der Opt-in-Schalter.
 *
 * `decision-log` F-1 verlangt Opt-in. Das ist keine Beschriftungsfrage: Der
 * Schalter muss aus starten, und das Ausschalten muss auch das Gesammelte
 * betreffen — sonst wäre der Widerruf nur eine Pause.
 */

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('TelemetrySettings', () => {
  it('[SECURITY] sollte in der Voreinstellung ausgeschaltet sein', () => {
    renderWithI18n(<TelemetrySettings />, 'de');
    expect(screen.getByRole('switch', { name: 'Anonyme Nutzungsdaten' })).not.toBeChecked();
    expect(screen.getByText('Ausgeschaltet')).toBeInTheDocument();
  });

  it('sollte auf Englisch dieselbe Aussage treffen', () => {
    renderWithI18n(<TelemetrySettings />, 'en');
    expect(screen.getByRole('switch', { name: 'Anonymous usage data' })).not.toBeChecked();
    expect(screen.getByText('Off')).toBeInTheDocument();
  });

  it('sollte benennen, was gesendet wird UND was nicht', () => {
    // „Anonymisiert" ist ein Wort, das alles und nichts heissen kann. Die
    // Entscheidung soll auf einer Tatsache beruhen, nicht auf einem Adjektiv.
    renderWithI18n(<TelemetrySettings />, 'de');
    expect(screen.getByText('Welche Bereiche geöffnet wurden')).toBeInTheDocument();
    expect(screen.getByText('Beträge, Salden und Umsätze')).toBeInTheDocument();
    expect(screen.getByText('Empfänger, Verwendungszwecke, IBANs')).toBeInTheDocument();
  });

  it('sollte die Zustimmung speichern', async () => {
    renderWithI18n(<TelemetrySettings />, 'de');
    await userEvent.click(screen.getByRole('switch', { name: 'Anonyme Nutzungsdaten' }));

    expect(screen.getByRole('switch', { name: 'Anonyme Nutzungsdaten' })).toBeChecked();
    expect(JSON.parse(localStorage.getItem('fintracker_feature_flags_v1') ?? '{}')).toEqual({
      telemetry: true,
    });
  });

  it('[SECURITY][REGRESSION] sollte beim Ausschalten auch das Gesammelte wegwerfen', async () => {
    // Ein Schalter, der nur den kuenftigen Versand stoppt, haette die alten
    // Ereignisse beim naechsten Einschalten mitgeschickt.
    renderWithI18n(<TelemetrySettings />, 'de');
    const toggle = screen.getByRole('switch', { name: 'Anonyme Nutzungsdaten' });

    await userEvent.click(toggle);
    recordTelemetryEvent({ type: 'screen_view', route: '/dashboard' });
    expect(readQueue()).toHaveLength(1);

    await userEvent.click(toggle);

    expect(readQueue()).toEqual([]);
    expect(toggle).not.toBeChecked();
  });

  it('sollte den Widerruf erst anbieten, wenn es etwas zu widerrufen gibt', async () => {
    renderWithI18n(<TelemetrySettings />, 'de');
    expect(screen.queryByRole('button', { name: /widerrufen/i })).toBeNull();

    await userEvent.click(screen.getByRole('switch', { name: 'Anonyme Nutzungsdaten' }));

    expect(screen.getByRole('button', { name: /widerrufen/i })).toBeInTheDocument();
  });
});
