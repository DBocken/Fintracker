import { useState } from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderWithI18n } from '@/test-utils/render';
import type { Transaction } from '@/types';
import { asTransactionId } from '@/lib/ids';
import { TransactionDayList } from '../TransactionDayList';

/**
 * WP-6.6 — Live-Reorganisation bei Filterwechsel.
 *
 * Greift ein Filter, sortiert sich die Liste sichtbar um, statt neu
 * aufzupoppen. Die Zuordnung „welche Zeile ist welche" läuft über die stabile
 * Transaktions-ID (React-Key), nicht über die Position — genau das macht
 * Objektkontinuität aus.
 *
 * Geprüft wird hier die Identitätserhaltung: dass ein Filterwechsel dieselben
 * DOM-Knoten weiterverwendet, statt sie zu verwerfen und neu zu bauen. Das ist
 * die Voraussetzung jeder Layout-Animation und — anders als die Bewegung
 * selbst — in jsdom belastbar prüfbar (Framer Motion misst dort nichts, weil
 * alle Elemente die Größe 0 haben).
 */

const reduceMock = vi.fn(() => false);
vi.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => reduceMock(),
}));

vi.mock('@/components/providers/GentleModeProvider', () => ({
  useGentleMode: () => ({ enabled: false }),
}));
vi.mock('@/services/account-service', () => ({ getAccounts: vi.fn() }));

afterEach(() => reduceMock.mockReturnValue(false));

function tx(p: Omit<Partial<Transaction>, 'id'> & { date: string; amount: number; id: string }): Transaction {
  return {
    payee: p.payee ?? 'Test',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: true,
    ...p,
    id: asTransactionId(p.id),
  };
}

const NOW = new Date('2026-07-03T12:00:00');

const ALL = [
  tx({ id: 'a', date: '2026-07-03', amount: -23.4, payee: 'Lieferando' }),
  tx({ id: 'b', date: '2026-07-03', amount: -53.16, payee: 'Rewe' }),
  tx({ id: 'c', date: '2026-07-02', amount: -12.5, payee: 'Aldi' }),
];

/** Wie nach einem Filter, der „Rewe" ausschließt — beide Tage bleiben. */
const FILTERED = [ALL[0], ALL[2]];

/** Wie nach einem Filter, der den gesamten Vortag ausschließt. */
const ONLY_TODAY = [ALL[0], ALL[1]];

/**
 * Harness mit echtem Filterwechsel statt `rerender`: `rerender` aus
 * @testing-library/react ersetzt den ganzen Baum und verliert dabei den
 * I18nProvider aus `renderWithI18n`. Ein Zustandswechsel per Klick ist
 * ausserdem naeher an dem, was die App tut — der Filter ist dort auch ein
 * State-Update und kein Prop-Tausch von aussen.
 */
function Harness() {
  const [view, setView] = useState<'all' | 'filtered' | 'onlyToday'>('all');
  return (
    <>
      <button type="button" onClick={() => setView('filtered')}>
        Filter anwenden
      </button>
      <button type="button" onClick={() => setView('onlyToday')}>
        Nur heute
      </button>
      <TransactionDayList
        transactions={view === 'filtered' ? FILTERED : view === 'onlyToday' ? ONLY_TODAY : ALL}
        categories={[]}
        accounts={[]}
        hiddenTransactions={new Set()}
        onOpenDetails={vi.fn()}
        endingBalance={1240}
        now={NOW}
      />
    </>
  );
}

function rowFor(payee: string): HTMLElement {
  return screen.getByText(payee).closest('li') as HTMLElement;
}

async function applyFilter() {
  await userEvent.click(screen.getByRole('button', { name: 'Filter anwenden' }));
}

describe('TransactionDayList — Live-Reorganisation (WP-6.6)', () => {
  it('sollte ueberlebende Zeilen beim Filtern als DIESELBEN Knoten behalten', async () => {
    // Der Kern des Arbeitspakets: „die Aldi-Buchung ist noch da, nur weiter
    // oben" — nicht „hier ist eine neue Liste". Ein neuer Knoten haette keine
    // Vorher-Position, aus der sich animieren liesse.
    renderWithI18n(<Harness />);
    const before = rowFor('Aldi');

    await applyFilter();

    expect(rowFor('Aldi')).toBe(before);
  });

  it('sollte weggefilterte Zeilen entfernen', async () => {
    renderWithI18n(<Harness />);
    expect(screen.getByText('Rewe')).toBeInTheDocument();

    await applyFilter();

    // AnimatePresence blendet aus; ohne laufende Animation (jsdom misst
    // nichts) ist der Knoten unmittelbar fort.
    await waitFor(() => expect(screen.queryByText('Rewe')).not.toBeInTheDocument());
  });

  it('sollte bei reduced-motion dieselbe Liste zeigen', () => {
    // Die Bewegung entfaellt, der Inhalt nicht. Ein Reduced-Motion-Nutzer
    // bekommt keine kuerzere Liste.
    reduceMock.mockReturnValue(true);
    renderWithI18n(<Harness />);

    for (const payee of ['Lieferando', 'Rewe', 'Aldi']) {
      expect(screen.getByText(payee)).toBeInTheDocument();
    }
  });

  it('sollte beide Tage behalten, solange jeder noch einen Eintrag hat', async () => {
    renderWithI18n(<Harness />);
    await applyFilter();

    expect(screen.getByText(/^Heute · /)).toBeInTheDocument();
    expect(screen.getByText(/^Gestern · /)).toBeInTheDocument();
  });

  it('sollte einen vollstaendig weggefilterten Tag entfernen', async () => {
    // Nicht nur die Zeile geht, sondern die ganze Tagesgruppe samt Kopfzeile —
    // sonst bliebe ein leerer Tag mit Kontostand stehen.
    renderWithI18n(<Harness />);
    expect(screen.getByText(/^Gestern · /)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Nur heute' }));

    await waitFor(() => expect(screen.queryByText(/^Gestern · /)).not.toBeInTheDocument());
    expect(screen.getByText(/^Heute · /)).toBeInTheDocument();
  });

  it('sollte die semantische Listenstruktur erhalten', () => {
    // motion.li muss ein <li> bleiben — sonst verliert die Liste ihre
    // Vorlesbarkeit, und WP-6.6 haette WP-6.10 kaputtgemacht.
    renderWithI18n(<Harness />);
    expect(rowFor('Aldi').tagName).toBe('LI');
    expect(rowFor('Aldi').closest('ul')).not.toBeNull();
  });
});
