import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithI18n } from '@/test-utils/render';
import { DecimalInput } from '../DecimalInput';

/**
 * Das Eingabefeld für Geldbeträge.
 *
 * Es ersetzt `<Input type="number">` für Euro-Beträge. Der Grund ist gemessen,
 * nicht vermutet: Ein `type="number"`-Feld liefert in einem deutschen Browser
 * für „12,50" den Wert `"1250"` und für „1.234,56" den Wert `"1.23456"` — es
 * verstümmelt die Eingabe, BEVOR irgendein Parser sie sieht. Kein noch so
 * guter Parser kann das danach reparieren.
 *
 * Deshalb `type="text"` mit `inputMode="decimal"`: Der Rohtext überlebt, und
 * `parseGermanNumber` liest ihn korrekt.
 *
 * Die Schnittstelle gibt eine ZAHL nach außen, keinen Text. Hielte das
 * Formular den Rohstring, müsste jede Aufrufstelle beim Absenden selbst richtig
 * parsen — und genau das ist der Fehler, den dieses Feld verhindern soll.
 */
describe('DecimalInput', () => {
  it('sollte einen Betrag mit deutschem Dezimalkomma liefern', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithI18n(<DecimalInput aria-label="Betrag" value={null} onChange={onChange} />);

    await user.type(screen.getByLabelText('Betrag'), '12,50');
    expect(onChange).toHaveBeenLastCalledWith(12.5);
  });

  it('[REGRESSION] sollte den deutschen Tausenderpunkt als Tausender lesen', async () => {
    // Mit `type="number"` wurde daraus 1,20 € — gemessen in Chromium (de-DE).
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithI18n(<DecimalInput aria-label="Betrag" value={null} onChange={onChange} />);

    await user.type(screen.getByLabelText('Betrag'), '1.200');
    expect(onChange).toHaveBeenLastCalledWith(1200);
  });

  it('[REGRESSION] sollte Tausenderpunkt UND Dezimalkomma zugleich lesen', async () => {
    // Mit `type="number"` wurde daraus 1,23 €.
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithI18n(<DecimalInput aria-label="Betrag" value={null} onChange={onChange} />);

    await user.type(screen.getByLabelText('Betrag'), '1.234,56');
    expect(onChange).toHaveBeenLastCalledWith(1234.56);
  });

  it('sollte kein `type="number"` verwenden', () => {
    // Der Kern der Sache: Dieses Feld darf nie zu dem werden, was es ersetzt.
    renderWithI18n(<DecimalInput aria-label="Betrag" value={null} onChange={vi.fn()} />);
    const feld = screen.getByLabelText('Betrag');
    expect(feld).toHaveAttribute('type', 'text');
    expect(feld).toHaveAttribute('inputmode', 'decimal');
  });

  it('sollte eine leere Eingabe als `null` melden, nicht als 0', async () => {
    // 0 € und „nichts eingetragen" sind verschiedene Aussagen. Wer sie
    // gleichsetzt, kann eine abbezahlte Schuld nicht von einer unausgefüllten
    // unterscheiden.
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithI18n(<DecimalInput aria-label="Betrag" value={42} onChange={onChange} />);

    await user.clear(screen.getByLabelText('Betrag'));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('sollte eine unlesbare Eingabe als `null` melden statt zu werfen', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithI18n(<DecimalInput aria-label="Betrag" value={null} onChange={onChange} />);

    await user.type(screen.getByLabelText('Betrag'), 'abc');
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('sollte den Tippvorgang nicht stören', async () => {
    // Wer „1," getippt hat, ist mitten in der Eingabe. Würde das Feld den Text
    // hier normalisieren, spränge der Cursor und die Ziffer danach landete
    // falsch.
    const user = userEvent.setup();
    renderWithI18n(<DecimalInput aria-label="Betrag" value={null} onChange={vi.fn()} />);
    const feld = screen.getByLabelText('Betrag');

    await user.type(feld, '1,');
    expect(feld).toHaveValue('1,');
  });

  it('sollte einen von außen gesetzten Betrag deutsch anzeigen', async () => {
    renderWithI18n(<DecimalInput aria-label="Betrag" value={1234.5} onChange={vi.fn()} />);
    expect(screen.getByLabelText('Betrag')).toHaveValue('1234,5');
  });

  it('sollte `null` als leeres Feld anzeigen', () => {
    renderWithI18n(<DecimalInput aria-label="Betrag" value={null} onChange={vi.fn()} />);
    expect(screen.getByLabelText('Betrag')).toHaveValue('');
  });

  it('sollte bilingual funktionieren', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithI18n(<DecimalInput aria-label="Amount" value={null} onChange={onChange} />, 'en');

    await user.type(screen.getByLabelText('Amount'), '12,50');
    expect(onChange).toHaveBeenLastCalledWith(12.5);
  });
});
