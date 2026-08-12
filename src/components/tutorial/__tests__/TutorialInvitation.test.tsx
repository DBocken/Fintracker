import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithI18n } from '@/test-utils/render';
import TutorialInvitation from '../TutorialInvitation';

describe('TutorialInvitation', () => {
  it('sollte einladen, wenn ein Kapitel bereitsteht', () => {
    renderWithI18n(
      <TutorialInvitation chapter="transactions" here onStart={vi.fn()} onDismiss={vi.fn()} />,
      'de',
    );
    expect(screen.getByText('Soll ich es dir zeigen?')).toBeInTheDocument();
  });

  it('sollte auf Englisch dieselbe Einladung zeigen', () => {
    renderWithI18n(
      <TutorialInvitation chapter="transactions" here onStart={vi.fn()} onDismiss={vi.fn()} />,
      'en',
    );
    expect(screen.getByText('Shall I show you around?')).toBeInTheDocument();
  });

  it('sollte schweigen, wenn kein Kapitel bereitsteht', () => {
    renderWithI18n(
      <TutorialInvitation chapter={null} here onStart={vi.fn()} onDismiss={vi.fn()} />,
      'de',
    );
    expect(screen.queryByText('Soll ich es dir zeigen?')).not.toBeInTheDocument();
  });

  it('sollte die Führung starten', async () => {
    const onStart = vi.fn();
    renderWithI18n(
      <TutorialInvitation chapter="transactions" here onStart={onStart} onDismiss={vi.fn()} />,
      'de',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Zeig es mir' }));
    expect(onStart).toHaveBeenCalled();
  });

  it('[REGRESSION] sollte einen Bereichswechsel ankündigen, statt ihn zu verschweigen', async () => {
    // Befund „springt wahllos auf andere Seiten": Der Streifen schwebt über
    // JEDER Seite, das nächste Kapitel gehört aber oft zu einer anderen.
    // „Eine kurze Führung durch diesen Bereich" war dann schlicht unwahr —
    // und der Klick riss die Seite ohne Vorwarnung weg.
    renderWithI18n(
      <TutorialInvitation
        chapter="transactions"
        here={false}
        onStart={vi.fn()}
        onDismiss={vi.fn()}
      />,
      'de',
    );
    expect(screen.queryByText('Eine kurze Führung durch diesen Bereich.')).not.toBeInTheDocument();
    expect(screen.getByText(/Buchungen/)).toBeInTheDocument();
  });

  it('[REGRESSION] sollte nicht im Layoutfluss liegen', async () => {
    // WP-10.3: Als eingeschobener Streifen ueber der ganzen Huelle war die
    // Einladung mit 0,073 der groesste Posten im CLS-Budget von /dashboard
    // (Budget 0,1) — sie schob Kopfzeile, Navigation und Inhalt gemeinsam nach
    // unten. Eine schwebende Ebene verschiebt nichts. Wer diese Klassen
    // entfernt, holt die Verschiebung zurueck, ohne dass ein Test rot wird —
    // deshalb steht sie hier.
    renderWithI18n(
      <TutorialInvitation chapter="transactions" here onStart={vi.fn()} onDismiss={vi.fn()} />,
      'de',
    );
    const frame = screen.getByTestId('tutorial-invitation');
    expect(frame.className).toContain('fixed');
    // Der Rahmen darf die Bedienung darunter nicht abfangen …
    expect(frame.className).toContain('pointer-events-none');
    // … der Streifen selbst muss aber anklickbar bleiben.
    const bar = frame.firstElementChild;
    expect(bar?.className).toContain('pointer-events-auto');
  });

  it('sollte das Wegklicken dem Host melden, ohne die Führung zu starten', async () => {
    // Das Verbergen selbst gehört dem Host (Befund A-2, Hinweisebenen-Präsenz)
    // und ist in TutorialHost.test.tsx abgesichert.
    const onStart = vi.fn();
    const onDismiss = vi.fn();
    renderWithI18n(
      <TutorialInvitation chapter="transactions" here onStart={onStart} onDismiss={onDismiss} />,
      'de',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Nicht jetzt' }));
    expect(onStart).not.toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
