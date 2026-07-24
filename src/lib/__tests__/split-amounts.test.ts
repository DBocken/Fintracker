import { describe, it, expect } from 'vitest';
import {
  allocationSign,
  parseSplitAmount,
  openSplitMinor,
  formatSplitAmountInput,
} from '../split-amounts';

describe('allocationSign', () => {
  it('sollte für Ausgaben negativ und für Einnahmen positiv sein', () => {
    expect(allocationSign(-5000)).toBe(-1);
    expect(allocationSign(5000)).toBe(1);
  });

  it('sollte eine Nullbuchung als positiv behandeln', () => {
    expect(allocationSign(0)).toBe(1);
  });
});

describe('parseSplitAmount', () => {
  it('sollte den eingegebenen Betrag mit dem Vorzeichen der Buchung versehen', () => {
    // Ausgabe von 50 €: die Eingabe „12,99" ist ein Ausgaben-Anteil.
    expect(parseSplitAmount('12,99', -5000)).toBe(-1299);
    // Einnahme: dieselbe Eingabe bleibt positiv.
    expect(parseSplitAmount('12,99', 5000)).toBe(1299);
  });

  it('sollte ein vom Nutzer getipptes Minus ignorieren (Vorzeichen kommt aus der Buchung)', () => {
    expect(parseSplitAmount('-12,99', -5000)).toBe(-1299);
    expect(parseSplitAmount('-12,99', 5000)).toBe(1299);
  });

  it('sollte deutsche und englische Dezimaltrenner sowie Tausenderpunkte verstehen', () => {
    expect(parseSplitAmount('12.50', -5000)).toBe(-1250);
    expect(parseSplitAmount('1.234,56', -500000)).toBe(-123456);
  });

  it('sollte leere und ungültige Eingaben als 0 werten', () => {
    expect(parseSplitAmount('', -5000)).toBe(0);
    expect(parseSplitAmount('   ', -5000)).toBe(0);
    expect(parseSplitAmount('abc', -5000)).toBe(0);
  });
});

describe('openSplitMinor', () => {
  it('sollte bei einer Ausgabe den offenen Rest positiv melden', () => {
    // -50 € Buchung, -20 € zugewiesen -> 30 € offen.
    expect(openSplitMinor(-5000, -2000)).toBe(3000);
  });

  it('[REGRESSION] sollte bei Ausgaben Überzuweisung negativ melden (vormals als „offen" beschriftet)', () => {
    // -50 € Buchung, -60 € zugewiesen -> 10 € zu viel.
    expect(openSplitMinor(-5000, -6000)).toBe(-1000);
  });

  it('sollte bei einer Einnahme genauso rechnen', () => {
    expect(openSplitMinor(5000, 2000)).toBe(3000);
    expect(openSplitMinor(5000, 6000)).toBe(-1000);
  });

  it('sollte 0 liefern, wenn der Betrag vollständig aufgeteilt ist', () => {
    expect(openSplitMinor(-5000, -5000)).toBe(0);
  });
});

describe('formatSplitAmountInput', () => {
  it('sollte Cent als deutsche Betrags-Magnitude ohne Vorzeichen ausgeben', () => {
    expect(formatSplitAmountInput(-1299)).toBe('12,99');
    expect(formatSplitAmountInput(1299)).toBe('12,99');
    expect(formatSplitAmountInput(0)).toBe('0,00');
  });

  it('sollte mit parseSplitAmount verlustfrei hin- und zurücklaufen', () => {
    expect(parseSplitAmount(formatSplitAmountInput(-1299), -5000)).toBe(-1299);
  });
});
