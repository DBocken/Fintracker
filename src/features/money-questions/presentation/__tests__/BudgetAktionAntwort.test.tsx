import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';
import type { Budget } from '@/lib/budget-types';
import type { BudgetAktionsVorschlag, QuestionAnswer } from '@/lib/question-registry';

/**
 * Die Tests, die das Versprechen des Pakets tragen: **Ohne Klick wird
 * nichts geschrieben**, und was geschrieben wurde, lässt sich zurücknehmen.
 */
const saveBudget = vi.fn();
const deleteBudget = vi.fn();
vi.mock('@/services/budget-service', () => ({
  saveBudget: (b: Partial<Budget>) => saveBudget(b),
  deleteBudget: (id: string) => deleteBudget(id),
}));

import { BudgetAktionAntwort } from '../BudgetAktionAntwort';

const BESTEHEND: Budget = {
  id: 'b-1',
  name: 'Freizeit',
  category_id: 'c-freizeit',
  limit: 100,
} as Budget;

const ANTWORT = {
  art: 'aktion',
  wert: 150,
  anzahl: 1,
  aussage: { key: 'x', params: {} },
  deepLink: '/budgets',
  deepLinkArt: 'kontext',
} as unknown as QuestionAnswer;

function render(vorschlag: BudgetAktionsVorschlag, locale: 'de' | 'en' = 'de') {
  return renderWithProviders(
    <BudgetAktionAntwort
      antwort={ANTWORT}
      vorschlag={vorschlag}
      budgets={[BESTEHEND]}
      aussage="Budget für Freizeit ändern?"
    />,
    { locale, query: true },
  );
}

const AENDERN: BudgetAktionsVorschlag = {
  art: 'aendern',
  kategorieId: 'c-freizeit',
  name: 'Freizeit',
  vorher: 100,
  nachher: 150,
  budgetId: 'b-1',
};

beforeEach(() => {
  saveBudget.mockReset().mockResolvedValue({ ...BESTEHEND, limit: 150 });
  deleteBudget.mockReset().mockResolvedValue(undefined);
});

describe('BudgetAktionAntwort', () => {
  it.each([
    ['de' as const, 'Zum Bestätigen', 'Bestätigen'],
    ['en' as const, 'Please confirm', 'Confirm'],
  ])('sollte die Vorschau mit Vorher und Nachher zeigen (%s)', (locale, titel, knopf) => {
    render(AENDERN, locale);

    expect(screen.getByText(titel)).toBeInTheDocument();
    // Die GRÖSSE der Änderung ist sichtbar, nicht nur ihr Ergebnis.
    expect(screen.getByText(/100,00.*→.*150,00/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: new RegExp(knopf) })).toBeInTheDocument();
  });

  it('[REGRESSION] sollte ohne Bestätigen-Klick NICHTS schreiben', () => {
    // Das Versprechen des ganzen Pakets: Die Vorschau allein verändert nichts.
    render(AENDERN);

    expect(saveBudget).not.toHaveBeenCalled();
    expect(deleteBudget).not.toHaveBeenCalled();
  });

  it('sollte erst auf Klick schreiben und danach Rückgängig anbieten', async () => {
    render(AENDERN);

    fireEvent.click(screen.getByRole('button', { name: /Bestätigen/ }));

    await waitFor(() => expect(saveBudget).toHaveBeenCalledTimes(1));
    expect(saveBudget).toHaveBeenCalledWith(expect.objectContaining({ id: 'b-1', limit: 150 }));
    expect(await screen.findByText('Budget „Freizeit" ist geändert.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rückgängig/ })).toBeInTheDocument();
  });

  it('sollte eine Änderung auf den alten Stand zurücknehmen', async () => {
    render(AENDERN);
    fireEvent.click(screen.getByRole('button', { name: /Bestätigen/ }));
    await screen.findByRole('button', { name: /Rückgängig/ });

    fireEvent.click(screen.getByRole('button', { name: /Rückgängig/ }));

    // Der Schnappschuss kommt zurück — das ALTE Limit, nicht das neue.
    await waitFor(() => expect(saveBudget).toHaveBeenCalledTimes(2));
    expect(saveBudget).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'b-1', limit: 100 }));
    expect(await screen.findByText(/Zurückgenommen/)).toBeInTheDocument();
  });

  it('sollte ein angelegtes Budget beim Rückgängig wieder löschen', async () => {
    saveBudget.mockResolvedValue({ id: 'b-neu', name: 'Essen', category_id: 'c-essen', limit: 200 });
    render({ art: 'anlegen', kategorieId: 'c-essen', name: 'Essen', nachher: 200 });

    fireEvent.click(screen.getByRole('button', { name: /Bestätigen/ }));
    await screen.findByRole('button', { name: /Rückgängig/ });
    fireEvent.click(screen.getByRole('button', { name: /Rückgängig/ }));

    await waitFor(() => expect(deleteBudget).toHaveBeenCalledWith('b-neu'));
  });

  it('sollte ein gelöschtes Budget beim Rückgängig wiederherstellen', async () => {
    render({
      art: 'loeschen',
      kategorieId: 'c-freizeit',
      name: 'Freizeit',
      vorher: 100,
      budgetId: 'b-1',
    });

    fireEvent.click(screen.getByRole('button', { name: /Bestätigen/ }));
    await waitFor(() => expect(deleteBudget).toHaveBeenCalledWith('b-1'));
    fireEvent.click(await screen.findByRole('button', { name: /Rückgängig/ }));

    await waitFor(() => expect(saveBudget).toHaveBeenCalledWith(BESTEHEND));
  });

  it('sollte Abbrechen ohne jeden Schreibzugriff erledigen', async () => {
    render(AENDERN);

    fireEvent.click(screen.getByRole('button', { name: /Abbrechen/ }));

    expect(await screen.findByText(/Zurückgenommen/)).toBeInTheDocument();
    expect(saveBudget).not.toHaveBeenCalled();
    expect(deleteBudget).not.toHaveBeenCalled();
  });

  it('[ZUSTAND /fragen:fehler] sollte einen Schreibfehler benennen', async () => {
    saveBudget.mockRejectedValue(new Error('IndexedDB weg'));
    render(AENDERN);

    fireEvent.click(screen.getByRole('button', { name: /Bestätigen/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Das hat nicht geklappt. Es wurde nichts geändert.',
    );
  });
});
