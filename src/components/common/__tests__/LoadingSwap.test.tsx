import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { LoadingSwap } from '../LoadingSwap';
import { SKELETON_MIN_VISIBLE_MS } from '@/lib/loading-choreography';

/**
 * WP-7.3 — Ladeverhalten (Liquid Loading).
 *
 * Die Zeitrechnung selbst hat eigene Tests in
 * `lib/__tests__/loading-choreography.test.ts`. Hier wird geprüft, dass die
 * Komponente sie auch tatsächlich durchführt — der Teil, den die reine
 * Funktion nicht abdecken kann.
 *
 * Bewusst mit ECHTEN Timern: `AnimatePresence` im Modus `wait` mountet den
 * Nachfolger erst, wenn die Exit-Animation des Vorgängers durch ist, und die
 * läuft über `requestAnimationFrame`. Mit Fake-Timern endet sie nie, und der
 * Inhalt erschiene im Test niemals. Die Wartezeiten sind mit 150/300 ms klein
 * genug, dass das den Lauf nicht spürbar verlängert.
 */

const reduceMock = vi.fn(() => false);
vi.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => reduceMock(),
}));

function setup(loading: boolean) {
  return render(
    <LoadingSwap loading={loading} skeleton={<span>Lädt</span>}>
      <span>Inhalt</span>
    </LoadingSwap>,
  );
}

beforeEach(() => {
  reduceMock.mockReturnValue(false);
});

describe('LoadingSwap (WP-7.3)', () => {
  it('sollte bei kurzem Laden kein Skeleton zeigen', () => {
    // Der Kern: ein Skeleton, das 40 ms aufblitzt, ist ein Zucken, kein
    // Ladezustand.
    setup(true);
    expect(screen.queryByText('Lädt')).not.toBeInTheDocument();
    expect(screen.queryByText('Inhalt')).not.toBeInTheDocument();
  });

  it('sollte nach der Verzögerung das Skeleton zeigen', async () => {
    setup(true);

    expect(await screen.findByText('Lädt')).toBeInTheDocument();
  });

  it('sollte bei sofort fertigen Daten direkt den Inhalt zeigen', () => {
    setup(false);
    expect(screen.getByText('Inhalt')).toBeInTheDocument();
    expect(screen.queryByText('Lädt')).not.toBeInTheDocument();
  });

  it('sollte ein gezeigtes Skeleton die Mindestdauer stehen lassen', async () => {
    const { rerender } = setup(true);
    await screen.findByText('Lädt');

    // Daten treffen unmittelbar nach dem Skeleton ein.
    rerender(
      <LoadingSwap loading={false} skeleton={<span>Lädt</span>}>
        <span>Inhalt</span>
      </LoadingSwap>,
    );
    // Es bleibt zunächst stehen — sonst entstünde dasselbe Zucken am anderen Ende.
    expect(screen.getByText('Lädt')).toBeInTheDocument();

    // ... und weicht erst, wenn die Mindestdauer um ist.
    expect(
      await screen.findByText('Inhalt', undefined, {
        timeout: SKELETON_MIN_VISIBLE_MS + 1000,
      }),
    ).toBeInTheDocument();
  });

  it('sollte Skeleton und Inhalt nie gleichzeitig zeigen', async () => {
    // `mode="wait"`: beide gleichzeitig ergäben eine doppelte Darstellung
    // derselben Sache — genau das Flimmern, das hier beseitigt wird.
    const { rerender } = setup(true);
    await screen.findByText('Lädt');

    rerender(
      <LoadingSwap loading={false} skeleton={<span>Lädt</span>}>
        <span>Inhalt</span>
      </LoadingSwap>,
    );

    // Ueber den gesamten Uebergang hinweg pruefen, nicht nur einmal.
    await waitFor(
      () => expect(screen.queryByText('Inhalt')).toBeInTheDocument(),
      { timeout: SKELETON_MIN_VISIBLE_MS + 1000 },
    );
    expect(screen.queryByText('Lädt')).not.toBeInTheDocument();
  });

  it('sollte bei reduced-motion denselben Inhalt liefern', () => {
    // Die Überblendung entfällt, die Auskunft nicht.
    reduceMock.mockReturnValue(true);
    setup(false);
    expect(screen.getByText('Inhalt')).toBeInTheDocument();
  });
});
