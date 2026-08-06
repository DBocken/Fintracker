import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithI18n } from '@/test-utils/render';
import type { WrappedStats } from '@/lib/income-wrapped';
import WrappedSlides from '../WrappedSlides';

/**
 * WP-7.5 — Signature Moment „Jahresrückblick".
 *
 * Der Rückblick bestand schon; was fehlte, war der **Abschluss**. Er lief auf
 * eine Share-Karte mit Überschrift zu, nicht auf eine Aussage. Jetzt trägt
 * ihn `SignatureMoment` — dieselbe Choreografie und dieselbe Haptik wie bei
 * allen anderen Erfolgsmomenten der App (WP-6.5, WP-7.8), statt einer
 * zweiten, abweichenden Fassung an genau dieser Stelle.
 */

const reduceMock = vi.fn(() => false);
// `importActual` statt eines Voll-Ersatzes: das Modul exportiert auch
// `useMotionSafe`, das SlideShell braucht. Ein Mock ohne diesen Export
// entfernt ihn — die Komponente wirft dann schon beim Rendern.
vi.mock('@/hooks/useReducedMotion', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useReducedMotion')>()),
  useReducedMotion: () => reduceMock(),
}));

vi.mock('@/lib/png-export', () => ({ exportNodeToPng: vi.fn() }));

// Die Teilen-Karte ist hier nicht der Pruefgegenstand: sie braucht eine
// vollstaendige Statistik-Fixture, waehrend dieser Test nur den ABSCHLUSS
// pruefen soll. Ein Mock haelt die Fixture ehrlich klein.
vi.mock('@/components/income/ShareCard', () => ({
  ShareCard: () => <div data-testid="share-card" />,
  default: () => <div data-testid="share-card" />,
}));

afterEach(() => reduceMock.mockReturnValue(false));

const SOURCE = readFileSync(resolve(__dirname, '../WrappedSlides.tsx'), 'utf8');

const STATS = {
  year: 2026,
  total: 48_000,
  bestMonth: { month: '2026-07', amount: 6_200 },
  streamCount: 3,
  diversification: 'moderate',
  fastestGrowingStream: null,
  mostRegularStream: null,
  shareCard: { year: 2026, total: 48_000, streams: [] },
} as unknown as WrappedStats;

/** Klickt bis zur letzten Folie durch. */
async function advanceToFinal() {
  const user = userEvent.setup();
  for (let i = 0; i < 8; i++) {
    await user.keyboard('{ArrowRight}');
  }
}

describe('WrappedSlides — Abschluss (WP-7.5)', () => {
  it('sollte den Abschluss als Signature Moment zeigen', async () => {
    const { container } = renderWithI18n(<WrappedSlides stats={STATS} onClose={vi.fn()} />);
    await advanceToFinal();

    expect(container.querySelector('[data-testid="signature-moment"]')).not.toBeNull();
  });

  it('sollte den Abschluss mit dem Jahr benennen', async () => {
    renderWithI18n(<WrappedSlides stats={STATS} onClose={vi.fn()} />);
    await advanceToFinal();

    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });

  it('sollte sagen, woher die Zahlen kommen', async () => {
    // Ein Rueckblick, der feiert, muss klarmachen, dass er aus echten Daten
    // stammt — sonst liest er sich wie Werbung.
    renderWithI18n(<WrappedSlides stats={STATS} onClose={vi.fn()} />);
    await advanceToFinal();

    expect(screen.getByText(/aus deinen eigenen Zahlen/)).toBeInTheDocument();
  });

  it('sollte keine feste Uebergangsdauer mehr verdrahten', () => {
    // Ein Rueckblick ist eine Folge von Uebergaengen; genau dort faellt eine
    // abweichende Dauer auf. Sie kommt jetzt aus dem Token und wird ueber die
    // Bewegungsstufe aufgeloest.
    expect(SOURCE).not.toContain('duration: 0.35');
    expect(SOURCE).toContain('motionQuality.seconds(MOTION_DURATIONS.default)');
  });

  it('sollte die Zahlen ueber die signature-Dauer hochzaehlen', () => {
    // Bewusst laenger als die Standarddauer: hier soll man beim Zusehen
    // mitgehen koennen.
    expect(SOURCE).toContain('motionQuality.duration(MOTION_DURATIONS.signature)');
  });

  it('sollte bei reduced-motion denselben Abschluss zeigen', async () => {
    // Die Bewegung entfaellt, die Aussage nicht.
    reduceMock.mockReturnValue(true);
    renderWithI18n(<WrappedSlides stats={STATS} onClose={vi.fn()} />);
    await advanceToFinal();

    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });
});
