import { describe, expect, it, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

import { createHookWrapper } from '@/test-utils/render';
import { useTutorialRun } from '../useTutorialRun';
import { getLocalUserSettings, updateLocalUserSettings } from '@/services/local-settings-service';
import { localEncryption } from '@/services/local-crypto';
import { collectDataReadiness } from '@/services/data-readiness-service';
import type { DataReadiness } from '@/lib/tutorial-sequence';

const ready: DataReadiness = {
  transactionCount: 180,
  monthsOfHistory: 3,
  categorizedMonths: 3,
  accountCount: 2,
  hasSalaryDetected: true,
  hasRecurringDetected: true,
  hasBudget: true,
  hasDebt: true,
  hasOccasion: true,
  hasAssetsBeyondAccounts: true,
  hasDeductibleCategory: true,
  businessMode: false,
  hasPortfolio: true,
  hasPremiumAccess: false,
};

vi.mock('@/services/data-readiness-service', () => ({
  collectDataReadiness: vi.fn(),
}));

beforeEach(() => {
  localStorage.clear();
  localEncryption.lock();
  vi.mocked(collectDataReadiness).mockResolvedValue(ready);
});

function renderRun() {
  return renderHook(() => useTutorialRun(), { wrapper: createHookWrapper().wrapper });
}

/**
 * Klickt das laufende Kapitel bis zum Ende durch. Bewusst über `stepCount`
 * statt mit fester Zahl: Wächst ein Kapitel, soll der Test das Verhalten
 * prüfen und nicht die Schrittzahl von gestern.
 */
function finishChapter(result: { current: { stepCount: number; next: () => void } }) {
  const total = result.current.stepCount;
  for (let i = 0; i < total; i += 1) act(() => result.current.next());
}

describe('useTutorialRun', () => {
  it('sollte das erste ausformulierte Kapitel als nächstes anbieten', async () => {
    const { result } = renderRun();
    await waitFor(() => expect(result.current.upcoming).toBe('transactions'));
  });

  it('sollte alle jetzt lehrbaren Kapitel nennen, nicht nur das erste', async () => {
    // Die Einladung schwebt über jeder Seite und muss das Kapitel DIESER
    // Seite anbieten können. Mit nur einem Kapitel in der Hand bliebe ihr
    // nur, wegzuspringen — genau der gemeldete Befund.
    const { result } = renderRun();
    await waitFor(() => expect(result.current.teachable.length).toBeGreaterThan(1));
    expect(result.current.teachable[0]).toBe(result.current.upcoming);
    expect(result.current.teachable).toContain('city');
    // Nur Kapitel mit ausformuliertem Text — `source` hat keine Schritte.
    expect(result.current.teachable).not.toContain('source');
  });

  it('sollte ohne Datengrundlage nichts anbieten', async () => {
    vi.mocked(collectDataReadiness).mockResolvedValue({
      ...ready,
      transactionCount: 0,
      categorizedMonths: 0,
    });
    const { result } = renderRun();
    // Kein Kapitel hat etwas zu zeigen — eine Führung ins Leere wäre schlimmer
    // als keine.
    await waitFor(() => expect(result.current.upcoming).toBeNull());
  });

  it('sollte abgeschlossene Kapitel überspringen', async () => {
    await updateLocalUserSettings({ tutorial_completed_chapters: ['source', 'transactions'] });
    const { result } = renderRun();
    await waitFor(() => expect(result.current.upcoming).toBe('categories'));
  });

  it('sollte durch die Schritte eines Kapitels führen', async () => {
    const { result } = renderRun();
    await waitFor(() => expect(result.current.upcoming).toBe('transactions'));

    act(() => result.current.start());
    expect(result.current.active).toBe(true);
    expect(result.current.stepIndex).toBe(0);

    act(() => result.current.next());
    expect(result.current.stepIndex).toBe(1);

    act(() => result.current.back());
    expect(result.current.stepIndex).toBe(0);
  });

  it('sollte am Ende des Kapitels dieses als abgeschlossen festhalten', async () => {
    const { result } = renderRun();
    await waitFor(() => expect(result.current.upcoming).toBe('transactions'));

    act(() => result.current.start());
    finishChapter(result);

    await waitFor(async () => {
      expect((await getLocalUserSettings()).tutorial_completed_chapters).toContain('transactions');
    });
    expect(result.current.active).toBe(false);
  });

  it('sollte in einer Folge nach dem Kapitel mit dem nächsten weitermachen', async () => {
    // Das zusammenhängende Tutorial: Ohne diesen Übergang wären 24 Kapitel
    // 24 Einzelstarts, und nach jedem müsste der Nutzer selbst wissen, wo es
    // weitergeht — genau die Arbeit, die eine Führung abnehmen soll.
    const { result } = renderRun();
    await waitFor(() => expect(result.current.upcoming).toBe('transactions'));

    act(() => result.current.startSeries(['transactions', 'dashboard']));
    expect(result.current.chapter).toBe('transactions');
    expect(result.current.remaining).toBe(1);
    // Damit die Darstellung am Kapitelende sagen kann, WOHIN „weiter" führt,
    // statt nur pauschal „Weiter" anzubieten.
    expect(result.current.nextChapter).toBe('dashboard');

    finishChapter(result);

    expect(result.current.chapter).toBe('dashboard');
    expect(result.current.stepIndex).toBe(0);
    expect(result.current.remaining).toBe(0);
    expect(result.current.active).toBe(true);

    // Den Schreibvorgang des abgeschlossenen Kapitels abwarten: Er läuft
    // asynchron weiter und landete sonst erst im nächsten Test — nach dessen
    // `localStorage.clear()`, und der sähe dann fremden Fortschritt.
    await waitFor(async () => {
      expect((await getLocalUserSettings()).tutorial_completed_chapters).toContain('transactions');
    });
  });

  it('sollte am Ende einer Folge schließen und alle Kapitel als abgeschlossen halten', async () => {
    const { result } = renderRun();
    await waitFor(() => expect(result.current.upcoming).toBe('transactions'));

    act(() => result.current.startSeries(['transactions', 'dashboard']));
    finishChapter(result);
    finishChapter(result);

    expect(result.current.active).toBe(false);
    await waitFor(async () => {
      const done = (await getLocalUserSettings()).tutorial_completed_chapters ?? [];
      expect(done).toContain('transactions');
      expect(done).toContain('dashboard');
    });
  });

  it('sollte ein Kapitel ohne Text aus der Folge streichen statt daran hängen zu bleiben', async () => {
    const { result } = renderRun();
    await waitFor(() => expect(result.current.upcoming).toBe('transactions'));

    act(() => result.current.startSeries(['source', 'dashboard']));
    expect(result.current.chapter).toBe('dashboard');
  });

  it('sollte beim Abbrechen nichts als abgeschlossen werten', async () => {
    const { result } = renderRun();
    await waitFor(() => expect(result.current.upcoming).toBe('transactions'));

    act(() => result.current.start());
    act(() => result.current.end());

    expect(result.current.active).toBe(false);
    expect((await getLocalUserSettings()).tutorial_completed_chapters ?? []).not.toContain(
      'transactions',
    );
  });

  it('[REGRESSION] sollte per finishAndEnd das laufende Kapitel abschließen, aber die Folge nicht fortsetzen', async () => {
    // Der Unterschied zu `end`: Das eben gesehene Kapitel zählt trotzdem als
    // abgeschlossen — nur die Fortsetzung entfällt. Ohne diese dritte
    // Möglichkeit hätte man am Kapitelende nur „automatisch weiter" oder
    // „auch das Gesehene zählt nicht".
    const { result } = renderRun();
    await waitFor(() => expect(result.current.upcoming).toBe('transactions'));

    act(() => result.current.startSeries(['transactions', 'dashboard']));
    expect(result.current.remaining).toBe(1);

    act(() => result.current.finishAndEnd());

    expect(result.current.active).toBe(false);
    expect(result.current.chapter).toBeNull();
    await waitFor(async () => {
      expect((await getLocalUserSettings()).tutorial_completed_chapters).toContain('transactions');
    });
    // Das zweite Kapitel der Folge wurde NICHT gestartet.
    expect((await getLocalUserSettings()).tutorial_completed_chapters ?? []).not.toContain(
      'dashboard',
    );
  });

  it('sollte ein Kapitel ohne ausformulierte Schritte gar nicht erst starten', async () => {
    const { result } = renderRun();
    await waitFor(() => expect(result.current.upcoming).toBe('transactions'));
    // `source` hat bewusst keine Schritte (der Dialog IST das Kapitel) —
    // kein Fehler, nur nichts zu zeigen.
    act(() => result.current.start('source'));
    expect(result.current.active).toBe(false);
  });

  it('sollte „alles freigeschaltet" nicht durch einen Kapitelabschluss verengen', async () => {
    // unlocked_features ist nicht gesetzt = Achse nicht in Gebrauch. Ein
    // abgeschlossenes Kapitel darf daraus keine einelementige Liste machen.
    const { result } = renderRun();
    await waitFor(() => expect(result.current.upcoming).toBe('transactions'));

    act(() => result.current.start());
    finishChapter(result);

    await waitFor(async () => {
      expect((await getLocalUserSettings()).tutorial_completed_chapters).toContain('transactions');
    });
    expect((await getLocalUserSettings()).unlocked_features ?? null).toBeNull();
  });
});
