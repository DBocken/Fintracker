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

describe('useTutorialRun', () => {
  it('sollte das erste ausformulierte Kapitel als nächstes anbieten', async () => {
    const { result } = renderRun();
    await waitFor(() => expect(result.current.upcoming).toBe('transactions'));
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
    act(() => result.current.next());
    act(() => result.current.next()); // letzter Schritt → Kapitel fertig

    await waitFor(async () => {
      expect((await getLocalUserSettings()).tutorial_completed_chapters).toContain('transactions');
    });
    expect(result.current.active).toBe(false);
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

  it('sollte ein Kapitel ohne ausformulierte Schritte gar nicht erst starten', async () => {
    const { result } = renderRun();
    await waitFor(() => expect(result.current.upcoming).toBe('transactions'));
    // `euer` hat noch keinen Text — kein Fehler, nur nichts zu zeigen.
    act(() => result.current.start('euer'));
    expect(result.current.active).toBe(false);
  });

  it('sollte „alles freigeschaltet" nicht durch einen Kapitelabschluss verengen', async () => {
    // unlocked_features ist nicht gesetzt = Achse nicht in Gebrauch. Ein
    // abgeschlossenes Kapitel darf daraus keine einelementige Liste machen.
    const { result } = renderRun();
    await waitFor(() => expect(result.current.upcoming).toBe('transactions'));

    act(() => result.current.start());
    act(() => result.current.next());
    act(() => result.current.next());

    await waitFor(async () => {
      expect((await getLocalUserSettings()).tutorial_completed_chapters).toContain('transactions');
    });
    expect((await getLocalUserSettings()).unlocked_features ?? null).toBeNull();
  });
});
