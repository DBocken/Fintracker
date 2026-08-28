import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithI18n } from '@/test-utils/render';
import { AccountFormDialog } from '../AccountFormDialog';
import type { Account } from '@/types';

// Radix' Select misst seine Breite über ResizeObserver, den jsdom nicht kennt.
globalThis.ResizeObserver ||= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

function renderDialog(
  { account = null, onSave = vi.fn() }: { account?: Account | null; onSave?: (data: Partial<Account>) => void } = {},
  locale: 'de' | 'en' = 'de',
) {
  // `renderWithI18n` hat selbst einen Vorgabewert für die Sprache; ein
  // ausdrückliches `undefined` von hier aus würde ihn treffen — deshalb wird
  // der Wert hier bereits festgelegt und nie weitergereicht, ohne gesetzt zu
  // sein.
  const view = renderWithI18n(
    <AccountFormDialog
      open
      onOpenChange={() => {}}
      account={account}
      accounts={[]}
      onSave={onSave}
      isLoading={false}
    />,
    locale,
  );
  return { onSave, ...view };
}

function makeAccount(overrides: Partial<Account>): Account {
  return {
    id: 'acc-1',
    user_id: 'local',
    name: 'Konto',
    type: 'checking',
    currency: 'EUR',
    color: '#1d5c54',
    icon: '🏦',
    is_budget_pool_member: true,
    order_index: 0,
    ...overrides,
  };
}

describe('AccountFormDialog – Budget-Pool-Switch', () => {
  // Gleiche Fehlerklasse wie die axe-critical `button-name`-Befunde aus dem
  // WP-4.6-Gate: das Label stand daneben, war aber nicht via htmlFor/id mit
  // dem Switch verknüpft — der Switch hatte keinen zugänglichen Namen.
  it('[REGRESSION] sollte den Budget-Pool-Switch über sein Label benennen (Deutsch)', () => {
    renderDialog({}, 'de');
    expect(screen.getByRole('switch', { name: 'Budget-Pool Mitglied' })).toBeInTheDocument();
  });

  it('[REGRESSION] sollte den Budget-Pool-Switch über sein Label benennen (Englisch)', () => {
    renderDialog({}, 'en');
    expect(screen.getByRole('switch', { name: 'Budget pool member' })).toBeInTheDocument();
  });
});

describe('AccountFormDialog – Geschäftskonto-Switch', () => {
  describe('Normal Behavior', () => {
    it('sollte den Geschäftskonto-Switch anzeigen (Deutsch)', () => {
      renderDialog({}, 'de');
      expect(screen.getByText('Geschäftskonto')).toBeInTheDocument();
    });

    it('sollte den Geschäftskonto-Switch anzeigen (Englisch)', () => {
      renderDialog({}, 'en');
      expect(screen.getByText('Business account')).toBeInTheDocument();
    });

    it('sollte is_business=true speichern, wenn der Switch aktiviert wird', () => {
      const onSave = vi.fn();
      renderDialog({ onSave });

      fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Firmenkonto' } });
      fireEvent.click(screen.getByRole('switch', { name: 'Geschäftskonto' }));
      fireEvent.submit(screen.getByRole('switch', { name: 'Geschäftskonto' }).closest('form')!);

      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ is_business: true }));
    });

    it('sollte den Switch aus einem bestehenden Geschäftskonto vorbelegen', () => {
      renderDialog({ account: makeAccount({ is_business: true }) });
      expect(screen.getByRole('switch', { name: 'Geschäftskonto' })).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('Edge Cases', () => {
    it('sollte Bestandskonten ohne Flag als privat vorbelegen (undefined ≙ false)', () => {
      renderDialog({ account: makeAccount({}) });
      expect(screen.getByRole('switch', { name: 'Geschäftskonto' })).toHaveAttribute('aria-checked', 'false');
    });

    it('sollte is_business=false speichern, wenn der Switch aus bleibt', () => {
      const onSave = vi.fn();
      renderDialog({ onSave });

      fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Privatkonto' } });
      fireEvent.submit(screen.getByRole('switch', { name: 'Geschäftskonto' }).closest('form')!);

      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ is_business: false }));
    });
  });
});

describe('AccountFormDialog – Währungsauswahl (VE-1, EUR-only)', () => {
  // Der Dialog bot USD, GBP und CHF an, obwohl KEINE Aggregation die
  // Kontowährung liest (`grep -c currency` in analysis-data.ts, budget-logic.ts,
  // forecast.ts ist jeweils 0). Ein so angelegtes Dollar-Konto schickt seine
  // Buchungen 1:1 als Euro in Einnahmen, Ausgaben, Budgets, Prognose, EÜR und
  // Finanzgesundheit — stille Falschzahlen über die normale Oberfläche
  // erreichbar. Was die App nicht verrechnen kann, gehört nicht in die Auswahl
  // (ADR `docs/architecture/currency-eur-only.md`, Preis-Punkt 3).
  it('[REGRESSION] sollte für ein neues Konto ausschließlich EUR anbieten (Deutsch)', async () => {
    const user = userEvent.setup();
    renderDialog({}, 'de');

    await user.click(screen.getByRole('combobox', { name: 'Währung' }));

    const options = await screen.findAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['EUR (€)']);
  });

  it('[REGRESSION] sollte für ein neues Konto ausschließlich EUR anbieten (Englisch)', async () => {
    const user = userEvent.setup();
    renderDialog({}, 'en');

    await user.click(screen.getByRole('combobox', { name: 'Currency' }));

    const options = await screen.findAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['EUR (€)']);
    expect(screen.queryByRole('option', { name: /USD|GBP|CHF/ })).toBeNull();
  });

  // Der Fall, der ohne Sorgfalt still kaputtgeht: Ein `<Select>` mit einem
  // Wert, für den es keinen `SelectItem` gibt, zeigt einen LEEREN Auslöser —
  // der Nutzer sieht ein unausgefülltes Pflichtfeld und wählt EUR. Damit
  // würde das Zurücknehmen des Angebots die Bestandsdaten ändern, statt sie
  // nur nicht mehr zu vermehren. Deshalb bleibt die bereits gespeicherte
  // Fremdwährung genau dieses Kontos wählbar.
  it('[REGRESSION] sollte die gespeicherte Fremdwährung eines Bestandskontos anzeigen', () => {
    renderDialog({ account: makeAccount({ currency: 'USD' }) });

    expect(screen.getByRole('combobox', { name: 'Währung' })).toHaveTextContent('USD');
  });

  it('[REGRESSION] sollte die Fremdwährung eines Bestandskontos beim Speichern nicht auf EUR ändern', () => {
    const onSave = vi.fn();
    renderDialog({ account: makeAccount({ currency: 'USD' }), onSave });

    fireEvent.submit(screen.getByRole('switch', { name: 'Geschäftskonto' }).closest('form')!);

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ currency: 'USD' }));
  });

  it('sollte bei einem Bestands-Fremdwährungskonto EUR und die eigene Währung anbieten, sonst nichts', async () => {
    const user = userEvent.setup();
    renderDialog({ account: makeAccount({ currency: 'USD' }) });

    await user.click(screen.getByRole('combobox', { name: 'Währung' }));

    const options = await screen.findAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['EUR (€)', 'USD']);
  });

  it('sollte benennen, dass eine Fremdwährung nicht umgerechnet wird', () => {
    renderDialog({ account: makeAccount({ currency: 'USD' }) });

    expect(screen.getByText(/nicht umrechnen/i)).toBeInTheDocument();
  });

  it('sollte den Hinweis bei einem Euro-Konto nicht zeigen', () => {
    renderDialog({ account: makeAccount({ currency: 'EUR' }) });

    expect(screen.queryByText(/nicht umrechnen/i)).toBeNull();
  });
});

describe('AccountFormDialog – Dezimaleingaben (AGENTS.md §8)', () => {
  // Die Felder waren `<Input type="number">`. In einem deutschen Browser
  // (Chromium, `de-DE`) liefert so ein Feld für getipptes „12,50" den Wert
  // „1250" — das Komma wird geschluckt, BEVOR irgendein Parser es sieht. Der
  // Eröffnungssaldo eines Kontos ist der Nullpunkt jeder späteren Rechnung;
  // ein Faktor 100 dort verzieht alles, was darauf aufbaut.
  it('[REGRESSION] sollte „1234,56" als Eröffnungssaldo 1234,56 speichern, nicht als 123456', () => {
    const onSave = vi.fn();
    renderDialog({ onSave });

    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Girokonto' } });
    fireEvent.change(screen.getByLabelText(/Kontostand am Anfang/i), { target: { value: '1234,56' } });
    fireEvent.submit(screen.getByRole('switch', { name: 'Geschäftskonto' }).closest('form')!);

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ opening_balance: 1234.56 }));
  });

  it('[REGRESSION] sollte den Tausenderpunkt in „1.200" nicht als Komma lesen', () => {
    const onSave = vi.fn();
    renderDialog({ onSave });

    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Girokonto' } });
    fireEvent.change(screen.getByLabelText(/Kontostand am Anfang/i), { target: { value: '1.200' } });
    fireEvent.submit(screen.getByRole('switch', { name: 'Geschäftskonto' }).closest('form')!);

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ opening_balance: 1200 }));
  });

  it('sollte ein leeres Saldofeld als 0 speichern und kein Saldo-Datum setzen', () => {
    const onSave = vi.fn();
    renderDialog({ onSave });

    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Girokonto' } });
    fireEvent.submit(screen.getByRole('switch', { name: 'Geschäftskonto' }).closest('form')!);

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ opening_balance: 0, opening_balance_date: null }),
    );
  });

  it('sollte die manuelle Saldo-Korrektur centgenau übernehmen', () => {
    const onSave = vi.fn();
    renderDialog({ account: makeAccount({}), onSave });

    fireEvent.change(screen.getByLabelText(/Aktueller Kontostand/i), {
      target: { value: '2500,75' },
    });
    fireEvent.submit(screen.getByRole('switch', { name: 'Geschäftskonto' }).closest('form')!);

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ live_balance_amount: 2500.75, live_balance_type: 'manual' }),
    );
  });
});

describe('IBAN-Prüfsumme', () => {
  it('sollte eine prüfsummenungültige IBAN benennen, statt sie stillschweigend zu übernehmen', async () => {
    // Eine vertippte IBAN ist syntaktisch einwandfrei. Sie bricht nichts
    // sichtbar — sie sorgt nur dafür, dass interne Überträge nie erkannt
    // werden, und zwar wortlos. Genau dafür gibt es die Prüfsumme.
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText(/IBAN/i), 'DE89370400440532013001');

    // Geprüft wird der Text, den der Nutzer WIRKLICH sieht: Vorgabe ist der
    // Sprachstil `everyday`, dessen Overlay „Prüfsumme" durch „Tippfehler"
    // ersetzt. Auf den Fachbegriff zu prüfen hiesse, eine Fassung zu testen,
    // die standardmäßig niemand zu Gesicht bekommt.
    expect(screen.getByText(/Tippfehler/i)).toBeInTheDocument();
  });

  it('sollte bei gültiger IBAN keine Warnung zeigen', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText(/IBAN/i), 'DE89 3704 0044 0532 0130 00');

    expect(screen.queryByText(/Tippfehler/i)).not.toBeInTheDocument();
  });

  it('sollte während der Eingabe noch nicht warnen', async () => {
    // Ein Feld, das beim dritten Zeichen rot wird, erzieht dazu, die Warnung
    // zu ignorieren. Gewarnt wird erst, wenn die Eingabe lang genug ist, um
    // überhaupt eine IBAN sein zu können.
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText(/IBAN/i), 'DE89 3704');

    expect(screen.queryByText(/Tippfehler/i)).not.toBeInTheDocument();
  });

  it('sollte das Speichern NICHT blockieren', async () => {
    // Das Feld ist optional und dient dem Erkennen von Überträgen, nicht dem
    // Auslösen einer Zahlung. Wer eine Kontonummer aus einem Land ohne IBAN
    // notiert, soll das dürfen — die App sagt, was sie weiß, und entscheidet
    // nicht an seiner Stelle. Für den Zahlungsweg gilt das Gegenteil:
    // `buildGirocodePayload` wirft bei ungültiger IBAN.
    const user = userEvent.setup();
    const { onSave } = renderDialog();

    await user.type(screen.getByLabelText(/Name/i), 'Auslandskonto');
    await user.type(screen.getByLabelText(/IBAN/i), 'DE89370400440532013001');
    fireEvent.submit(screen.getByRole('button', { name: /speichern|anlegen/i }).closest('form')!);

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ iban: 'DE89370400440532013001' }),
    );
  });

  it('sollte die Warnung auch auf Englisch zeigen', async () => {
    const user = userEvent.setup();
    renderDialog({}, 'en');

    await user.type(screen.getByLabelText(/IBAN/i), 'DE89370400440532013001');

    expect(screen.getByText(/typo/i)).toBeInTheDocument();
  });
});
