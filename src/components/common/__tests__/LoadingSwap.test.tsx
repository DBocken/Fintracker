import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { renderWithI18n } from '@/test-utils/render';
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

/**
 * Zentraler Helfer statt `render` (AGENTS.md §5): Die Komponente benennt ihren
 * Ladezustand seit WP-8.4 selbst und braucht dafür den I18n-Kontext.
 *
 * Der Wechsel läuft über ZUSTAND und nicht über `rerender`. `renderWithI18n`
 * setzt den Provider innerhalb des Aufrufs; ein `rerender(<LoadingSwap …/>)`
 * ersetzt den ganzen Baum und wirft ihn damit weg — die Komponente stünde
 * ohne Kontext da. Ausserdem ist das der echte Hergang: In der App bleibt der
 * Baum stehen und nur das Flag kippt.
 */
let setLoadingExternally: ((value: boolean) => void) | null = null;

function Harness({ initial }: { initial: boolean }) {
  const [loading, setLoading] = useState(initial);
  setLoadingExternally = setLoading;
  return (
    <LoadingSwap loading={loading} skeleton={<span>Lädt</span>}>
      <span>Inhalt</span>
    </LoadingSwap>
  );
}

function setup(loading: boolean, locale: 'de' | 'en' = 'de') {
  const view = renderWithI18n(<Harness initial={loading} />, locale);
  return {
    ...view,
    setLoading: (value: boolean) => act(() => setLoadingExternally?.(value)),
  };
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
    const { setLoading } = setup(true);
    await screen.findByText('Lädt');

    // Daten treffen unmittelbar nach dem Skeleton ein.
    setLoading(false);
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
    const { setLoading } = setup(true);
    await screen.findByText('Lädt');

    setLoading(false);

    // Ueber den gesamten Uebergang hinweg pruefen, nicht nur einmal.
    await waitFor(
      () => expect(screen.queryByText('Inhalt')).toBeInTheDocument(),
      { timeout: SKELETON_MIN_VISIBLE_MS + 1000 },
    );
    expect(screen.queryByText('Lädt')).not.toBeInTheDocument();
  });

  it('sollte das Skelett für die Sprachausgabe benennen (WP-8.4)', async () => {
    // Ein Skelett ist rein visuell — eine Sprachausgabe sieht nur leere
    // Kästen. Die Entsprechung steht in LoadingSwap selbst und nicht in den
    // Aufrufstellen: sonst hat sie, wer daran denkt.
    setup(true);
    await screen.findByText('Lädt');
    expect(screen.getByText('Wird geladen…')).toBeInTheDocument();
  });

  it('should name the skeleton for screen readers in English (WP-8.4)', async () => {
    setup(true, 'en');
    await screen.findByText('Lädt');
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('sollte im Inhaltszustand nichts mehr ansagen (WP-8.4)', () => {
    // Gegenprobe: Eine Dauer-Ansage "wird geladen" waere schlimmer als keine.
    setup(false);
    expect(screen.queryByText('Wird geladen…')).not.toBeInTheDocument();
  });

  it('sollte bei reduced-motion denselben Inhalt liefern', () => {
    // Die Überblendung entfällt, die Auskunft nicht.
    reduceMock.mockReturnValue(true);
    setup(false);
    expect(screen.getByText('Inhalt')).toBeInTheDocument();
  });
});
