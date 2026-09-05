/**
 * ViewModel der Einstellungen (WP 6.5b).
 *
 * `EnhancedSettings.tsx` hielt bis WP 6.5b sieben Datenzugriffe selbst (zwei
 * lesende Abfragen, fünf Schreibvorgänge) und `CategoryManager.tsx` einen
 * achten (den Kategorie-Vorschlag). Die Zusicherungen sind beim Umzug dieselben
 * geblieben; dieser Test hält sie an ihrem neuen Ort fest — allen voran die,
 * die eine falsche Auskunft verhindert: Ein Lesefehler der Kategorien darf NIE
 * als „0 Kategorien" durchgehen, sonst legt die Nutzerin Duplikate zu
 * Kategorien an, die es längst gibt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createHookWrapper } from '@/test-utils/render';

const getUserSettings = vi.fn();
const updateUserSettings = vi.fn();
const getHierarchicalCategories = vi.fn();
const saveCategory = vi.fn();
const updateCategory = vi.fn();
const recategorizeTransactions = vi.fn();
const restoreCategorization = vi.fn();
const getCategoryPreview = vi.fn();
const getTopCategorySuggestion = vi.fn();
const deleteCategory = vi.fn();
const showSuccess = vi.fn();
const showError = vi.fn();

vi.mock('@/services/transaction-service', () => ({
  getUserSettings: () => getUserSettings(),
  updateUserSettings: (input: unknown) => updateUserSettings(input),
  getHierarchicalCategories: () => getHierarchicalCategories(),
  saveCategory: (input: unknown) => saveCategory(input),
  updateCategory: (input: unknown) => updateCategory(input),
  recategorizeTransactions: () => recategorizeTransactions(),
  restoreCategorization: (input: unknown) => restoreCategorization(input),
  getCategoryPreview: (id: string) => getCategoryPreview(id),
  getTopCategorySuggestion: () => getTopCategorySuggestion(),
}));

vi.mock('@/services/category-service', () => ({
  deleteCategory: (id: string) => deleteCategory(id),
}));

vi.mock('@/utils/toast', () => ({
  showSuccess: (msg: string) => showSuccess(msg),
  showError: (msg: string) => showError(msg),
}));

import type { HierarchicalCategory, Transaction, UserSettings } from '@/types';
import { useSettingsOverview } from '../use-settings-overview';

const EINSTELLUNGEN: UserSettings = {
  user_id: 'u1',
  auto_confirm_mapping: false,
  retention_months: 12,
  enable_subcategories: true,
};

const LEBENSMITTEL: HierarchicalCategory = {
  id: 'food',
  user_id: 'u1',
  name: 'Lebensmittel',
  color: '#2e7d72',
  icon: '🛒',
  filters: [],
  parent_id: null,
};

const BUCHUNG = { id: 't1', description: 'Rewe', amount: -12.5 } as Transaction;

function erfolgreichesLaden() {
  getUserSettings.mockResolvedValue(EINSTELLUNGEN);
  getHierarchicalCategories.mockResolvedValue([LEBENSMITTEL]);
  getTopCategorySuggestion.mockResolvedValue(null);
}

describe('useSettingsOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sollte Einstellungen und Kategorien als ein Modell liefern', async () => {
    erfolgreichesLaden();
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useSettingsOverview(), { wrapper });

    await waitFor(() => expect(result.current.categories).toEqual([LEBENSMITTEL]));
    expect(result.current.retentionMonths).toBe(12);
    expect(result.current.autoConfirmMapping).toBe(false);
    expect(result.current.hasLoadError).toBe(false);
  });

  it('[REGRESSION] sollte einen Lesefehler der Kategorien melden statt „0 Kategorien" zu behaupten', async () => {
    getUserSettings.mockResolvedValue(EINSTELLUNGEN);
    getHierarchicalCategories.mockRejectedValue(new Error('IndexedDB nicht erreichbar'));
    getTopCategorySuggestion.mockResolvedValue(null);
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useSettingsOverview(), { wrapper });

    await waitFor(() => expect(result.current.hasLoadError).toBe(true));
  });

  it('sollte auch einen Lesefehler der Einstellungen als Fehler der ganzen Fläche melden', async () => {
    getUserSettings.mockRejectedValue(new Error('IndexedDB nicht erreichbar'));
    getHierarchicalCategories.mockResolvedValue([LEBENSMITTEL]);
    getTopCategorySuggestion.mockResolvedValue(null);
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useSettingsOverview(), { wrapper });

    await waitFor(() => expect(result.current.hasLoadError).toBe(true));
  });

  it('sollte den Kategorie-Vorschlag mitliefern, damit die Verwaltung ihn nicht selbst abfragt', async () => {
    getUserSettings.mockResolvedValue(EINSTELLUNGEN);
    getHierarchicalCategories.mockResolvedValue([LEBENSMITTEL]);
    getTopCategorySuggestion.mockResolvedValue({ category: LEBENSMITTEL, affectedCount: 7 });
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useSettingsOverview(), { wrapper });

    await waitFor(() => expect(result.current.categorySuggestion?.affectedCount).toBe(7));
  });

  it('sollte die Aufbewahrungsdauer speichern', async () => {
    erfolgreichesLaden();
    updateUserSettings.mockResolvedValue(EINSTELLUNGEN);
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useSettingsOverview(), { wrapper });
    await waitFor(() => expect(result.current.categories).toEqual([LEBENSMITTEL]));

    act(() => result.current.setRetentionMonths(24));

    await waitFor(() => expect(updateUserSettings).toHaveBeenCalledWith({ retention_months: 24 }));
  });

  it('sollte die automatische Bestätigung speichern', async () => {
    erfolgreichesLaden();
    updateUserSettings.mockResolvedValue(EINSTELLUNGEN);
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useSettingsOverview(), { wrapper });
    await waitFor(() => expect(result.current.categories).toEqual([LEBENSMITTEL]));

    act(() => result.current.setAutoConfirmMapping(true));

    await waitFor(() => expect(updateUserSettings).toHaveBeenCalledWith({ auto_confirm_mapping: true }));
  });

  it('sollte eine neue Kategorie anlegen und eine bestehende aktualisieren', async () => {
    erfolgreichesLaden();
    saveCategory.mockResolvedValue(LEBENSMITTEL);
    updateCategory.mockResolvedValue(LEBENSMITTEL);
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useSettingsOverview(), { wrapper });
    await waitFor(() => expect(result.current.categories).toEqual([LEBENSMITTEL]));

    act(() => result.current.saveCategory({ name: 'Neu' }));
    await waitFor(() => expect(saveCategory).toHaveBeenCalled());
    expect(updateCategory).not.toHaveBeenCalled();

    act(() => result.current.saveCategory({ id: 'food', name: 'Lebensmittel' }));
    await waitFor(() => expect(updateCategory).toHaveBeenCalled());
  });

  it('sollte die Auswahl nach dem Speichern zurücksetzen', async () => {
    erfolgreichesLaden();
    updateCategory.mockResolvedValue(LEBENSMITTEL);
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useSettingsOverview(), { wrapper });
    await waitFor(() => expect(result.current.categories).toEqual([LEBENSMITTEL]));

    act(() => result.current.selectCategory('food'));
    await waitFor(() => expect(result.current.preview.category).toEqual(LEBENSMITTEL));

    act(() => result.current.saveCategory({ id: 'food', name: 'Lebensmittel' }));

    await waitFor(() => expect(result.current.preview.category).toBeNull());
  });

  it('sollte die Auswahl über die stabile ID auflösen, nicht über den Anzeigenamen', async () => {
    erfolgreichesLaden();
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useSettingsOverview(), { wrapper });
    await waitFor(() => expect(result.current.categories).toEqual([LEBENSMITTEL]));

    act(() => result.current.selectCategory('food'));

    await waitFor(() => expect(result.current.preview.category?.name).toBe('Lebensmittel'));
  });

  it('sollte die Vorschau der betroffenen Buchungen laden', async () => {
    erfolgreichesLaden();
    // Die Vorschau liefert seit der Behebung den PLAN der Aktion, nicht eine
    // Liste: Die Beispiele sind gekappt, die Zahlen daneben sind vollstaendig.
    getCategoryPreview.mockResolvedValue({
      beispiele: [BUCHUNG],
      anzahlHinzu: 1,
      anzahlEntzug: 0,
      anzahlGesamt: 1,
    });
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useSettingsOverview(), { wrapper });
    await waitFor(() => expect(result.current.categories).toEqual([LEBENSMITTEL]));

    act(() => result.current.selectCategory('food'));
    await act(async () => {
      await result.current.loadPreview();
    });

    expect(getCategoryPreview).toHaveBeenCalledWith('food');
    expect(result.current.preview.transactions).toEqual([BUCHUNG]);
    expect(result.current.preview.anzahlHinzu).toBe(1);
    expect(result.current.preview.anzahlGesamt).toBe(1);
  });

  it('[REGRESSION] sollte die Zahlen des Plans durchreichen, nicht die Laenge der Beispiele', async () => {
    // Der Befund: Die Flaeche rechnete "und {n} weitere" aus der Laenge einer
    // bei 50 abgeschnittenen Liste — also hoechstens "und 40 weitere", ob nun
    // 41 oder 4.100 Buchungen betroffen waren. Beispiele und Zahlen muessen
    // getrennt durchgereicht werden.
    erfolgreichesLaden();
    getCategoryPreview.mockResolvedValue({
      beispiele: [BUCHUNG],
      anzahlHinzu: 4100,
      anzahlEntzug: 12,
      anzahlGesamt: 5000,
    });
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useSettingsOverview(), { wrapper });
    await waitFor(() => expect(result.current.categories).toEqual([LEBENSMITTEL]));

    act(() => result.current.selectCategory('food'));
    await act(async () => {
      await result.current.loadPreview();
    });

    expect(result.current.preview.transactions).toHaveLength(1);
    expect(result.current.preview.anzahlHinzu).toBe(4100);
    expect(result.current.preview.anzahlEntzug).toBe(12);
    expect(result.current.preview.anzahlGesamt).toBe(5000);
  });

  it('sollte ohne ausgewählte Kategorie keine Vorschau laden, sondern darum bitten', async () => {
    erfolgreichesLaden();
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useSettingsOverview(), { wrapper });
    await waitFor(() => expect(result.current.categories).toEqual([LEBENSMITTEL]));

    await act(async () => {
      await result.current.loadPreview();
    });

    expect(getCategoryPreview).not.toHaveBeenCalled();
    expect(showError).toHaveBeenCalled();
  });

  it('sollte eine Kategorie löschen', async () => {
    erfolgreichesLaden();
    deleteCategory.mockResolvedValue({ deletedBudgets: 0, deletedRules: 0 });
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useSettingsOverview(), { wrapper });
    await waitFor(() => expect(result.current.categories).toEqual([LEBENSMITTEL]));

    act(() => result.current.deleteCategory('food'));

    await waitFor(() => expect(deleteCategory).toHaveBeenCalledWith('food'));
    expect(showSuccess).toHaveBeenCalled();
  });

  it('sollte die Sammel-Neukategorisierung mit Ergebnis und Rückgängig-Vorrat abschließen', async () => {
    erfolgreichesLaden();
    recategorizeTransactions.mockResolvedValue({
      total: 10,
      assigned: 7,
      unassigned: 3,
      changed: 7,
      undo: [{ id: 't1', category_id: null, auto_mapped: false }],
    });
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useSettingsOverview(), { wrapper });
    await waitFor(() => expect(result.current.categories).toEqual([LEBENSMITTEL]));
    expect(result.current.bulk.status).toBe('idle');
    expect(result.current.bulk.canUndo).toBe(false);

    act(() => result.current.recategorize());

    await waitFor(() => expect(result.current.bulk.status).toBe('completed'));
    expect(result.current.bulk.results).toEqual({ total: 10, assigned: 7, unassigned: 3 });
    expect(result.current.bulk.canUndo).toBe(true);
  });

  it('sollte nach einem Fehler der Sammel-Neukategorisierung nicht „fertig" behaupten', async () => {
    erfolgreichesLaden();
    recategorizeTransactions.mockRejectedValue(new Error('Speicher nicht erreichbar'));
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useSettingsOverview(), { wrapper });
    await waitFor(() => expect(result.current.categories).toEqual([LEBENSMITTEL]));

    act(() => result.current.recategorize());

    await waitFor(() => expect(showError).toHaveBeenCalled());
    expect(result.current.bulk.status).toBe('idle');
    expect(result.current.bulk.results).toBeNull();
  });

  it('sollte die Sammeländerung mit den vorgehaltenen Vorwerten zurücknehmen', async () => {
    erfolgreichesLaden();
    const vorwerte = [{ id: 't1', category_id: null, auto_mapped: false }];
    recategorizeTransactions.mockResolvedValue({
      total: 1,
      assigned: 1,
      unassigned: 0,
      changed: 1,
      undo: vorwerte,
    });
    restoreCategorization.mockResolvedValue(1);
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useSettingsOverview(), { wrapper });
    await waitFor(() => expect(result.current.categories).toEqual([LEBENSMITTEL]));

    act(() => result.current.recategorize());
    await waitFor(() => expect(result.current.bulk.canUndo).toBe(true));

    act(() => result.current.undoRecategorization());

    await waitFor(() => expect(restoreCategorization).toHaveBeenCalledWith(vorwerte));
    await waitFor(() => expect(result.current.bulk.canUndo).toBe(false));
  });

  it('sollte ohne Vorwerte nichts zurücknehmen', async () => {
    erfolgreichesLaden();
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useSettingsOverview(), { wrapper });
    await waitFor(() => expect(result.current.categories).toEqual([LEBENSMITTEL]));

    act(() => result.current.undoRecategorization());

    expect(restoreCategorization).not.toHaveBeenCalled();
    expect(showError).toHaveBeenCalled();
  });

  it('sollte beide Bestandsabfragen erneut anstoßen, wenn die Fläche es verlangt', async () => {
    getUserSettings.mockRejectedValue(new Error('IndexedDB nicht erreichbar'));
    getHierarchicalCategories.mockRejectedValue(new Error('IndexedDB nicht erreichbar'));
    getTopCategorySuggestion.mockResolvedValue(null);
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useSettingsOverview(), { wrapper });
    await waitFor(() => expect(result.current.hasLoadError).toBe(true));
    const vorher = getHierarchicalCategories.mock.calls.length;

    act(() => result.current.retry());

    await waitFor(() =>
      expect(getHierarchicalCategories.mock.calls.length).toBeGreaterThan(vorher),
    );
  });
});
