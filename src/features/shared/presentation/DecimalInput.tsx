import { forwardRef, useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { parseGermanNumber } from '@/lib/money';

/**
 * Eingabefeld für Dezimalzahlen in deutscher Schreibweise — Geldbeträge,
 * Zinssätze, Mengen.
 *
 * Ersetzt `<Input type="number">` überall dort, wo eine Dezimalzahl eingegeben
 * wird. Benannt nach dem Mechanismus und nicht nach „Geld", weil derselbe
 * Fehler jedes Dezimalfeld trifft: Ein Zinssatz „5,5" wird in einem
 * `type="number"`-Feld zu **55 %**, ein „0,75" zu **75 %** — gemessen, nicht
 * vermutet.
 *
 * Ein `type="number"`-Feld in einem deutschen Browser (Chromium, `de-DE`)
 * liefert:
 *
 *   getippt „12,50"     -> .value "1250"      (Faktor 100 zu viel)
 *   getippt „1.200"     -> .value "1.200"     (parseFloat: 1,2)
 *   getippt „1.234,56"  -> .value "1.23456"
 *
 * Der Browser verstümmelt die Eingabe, BEVOR irgendein Parser sie sieht. Kein
 * noch so guter Parser repariert das danach. `type="text"` mit
 * `inputMode="decimal"` lässt den Rohtext überleben — die Zifferntastatur auf
 * dem Mobilgerät bleibt dabei erhalten.
 *
 * **Die Schnittstelle gibt eine ZAHL nach außen, keinen Text.** Hielte das
 * Formular den Rohstring, müsste jede Aufrufstelle beim Absenden selbst richtig
 * parsen — und genau dieser Schritt ist es, der in `DebtFormDialog`,
 * `ReceivableFormDialog` und anderswo mit `parseFloat` falsch gemacht wurde.
 * Was man nicht in die Hand bekommt, kann man nicht falsch anfassen.
 *
 * `null` heißt „nichts eingetragen" und ist ausdrücklich nicht `0`: Eine
 * abbezahlte Schuld über 0 € und eine unausgefüllte Zeile sind verschiedene
 * Aussagen.
 */
export interface DecimalInputProps
  extends Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> {
  /** Der Wert, oder `null` für ein leeres Feld. */
  value: number | null;
  /** Meldet den gelesenen Wert — `null`, wenn das Feld leer oder unlesbar ist. */
  onChange: (value: number | null) => void;
}

/** Zeigt eine Zahl in deutscher Schreibweise, ohne Tausendertrennung. */
function toGermanText(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '';
  return String(value).replace('.', ',');
}

export const DecimalInput = forwardRef<HTMLInputElement, DecimalInputProps>(function DecimalInput(
  { value, onChange, ...props },
  ref,
) {
  // Der Rohtext lebt hier, damit Tippen ungestört bleibt: „1," ist ein
  // gültiger Zwischenstand, den keine Normalisierung anfassen darf — sonst
  // springt der Cursor und die naechste Ziffer landet an der falschen Stelle.
  const [text, setText] = useState(() => toGermanText(value));

  // Von aussen gesetzte Werte uebernehmen, aber nur wenn sie wirklich etwas
  // anderes bedeuten als der aktuelle Text. Ohne diesen Vergleich wuerde jedes
  // `onChange` den Text zurueckschreiben und dabei „1," zu „1" glaetten.
  useEffect(() => {
    if ((parseGermanNumber(text) ?? null) !== value) {
      setText(toGermanText(value));
    }
    // `text` bewusst nicht in den Abhaengigkeiten: Dieser Effekt reagiert auf
    // Aenderungen VON AUSSEN, nicht auf das eigene Tippen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Input
      {...props}
      ref={ref}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      onChange={(event) => {
        const raw = event.target.value;
        setText(raw);
        onChange(raw.trim() === '' ? null : parseGermanNumber(raw));
      }}
    />
  );
});
