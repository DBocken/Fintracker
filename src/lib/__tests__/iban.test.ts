import { describe, expect, it } from 'vitest';
import { isValidIban, normalizeIban } from '../iban';

/**
 * Die Prüfsumme lag bis hierher in `services/letter-parser-service.ts` — einer
 * reinen Funktion ohne I/O in einem OCR-Service. Genau der Fall, den AGENTS.md
 * §3 („Wohin ein Typ gehört") benennt: Wer sie von weiter unten braucht, hätte
 * nur den Weg nach oben. Und wer sie aus einer Komponente rufen wollte, zöge
 * den ganzen Briefparser mit.
 */

describe('normalizeIban', () => {
  it('sollte Leerzeichen entfernen und großschreiben', () => {
    expect(normalizeIban('de89 3704 0044 0532 0130 00')).toBe('DE89370400440532013000');
  });

  it('sollte für leere Eingaben null liefern', () => {
    expect(normalizeIban(null)).toBeNull();
    expect(normalizeIban(undefined)).toBeNull();
    expect(normalizeIban('   ')).toBeNull();
  });

  it('sollte NICHT prüfen, sondern nur vereinheitlichen', () => {
    // Trennung mit Absicht: Der Fingerprint gruppiert auch über eine IBAN,
    // die der Nutzer nie eingetippt hat (Bank-Sync). Normalisieren darf
    // deshalb nie verwerfen — das Urteil fällt `isValidIban`.
    expect(normalizeIban('DE89370400440532013001')).toBe('DE89370400440532013001');
  });
});

describe('isValidIban (Mod-97)', () => {
  it('sollte gültige IBANs annehmen', () => {
    expect(isValidIban('DE89370400440532013000')).toBe(true);
    expect(isValidIban('DE89 3704 0044 0532 0130 00')).toBe(true);
    expect(isValidIban('DE02120300000000202051')).toBe(true);
  });

  it('sollte eine vertauschte Ziffernfolge erkennen', () => {
    // Der eigentliche Zweck der Prüfsumme: Ein Zahlendreher ist syntaktisch
    // einwandfrei und trotzdem eine fremde Kontonummer.
    expect(isValidIban('DE89370400440532013000')).toBe(true);
    expect(isValidIban('DE89370400440532010300')).toBe(false);
  });

  it('sollte falsche Prüfziffern und Längen abweisen', () => {
    expect(isValidIban('DE89370400440532013001')).toBe(false);
    expect(isValidIban('DE8937040044053201300')).toBe(false);
    expect(isValidIban('XX00')).toBe(false);
  });

  it('sollte Kleinschreibung und Gruppierung tolerieren', () => {
    expect(isValidIban('de89 3704 0044 0532 0130 00')).toBe(true);
  });

  it('sollte eine IBAN eines Landes ohne Längeneintrag über Mod-97 beurteilen', () => {
    // Die Längentabelle ist ein billiger Vorfilter, kein Zulassungsregister.
    // Für ein nicht eingetragenes Land entscheidet allein die Prüfsumme —
    // sonst wäre jede gültige norwegische IBAN „ungültig".
    expect(isValidIban('NO9386011117947')).toBe(true);
    expect(isValidIban('NO9386011117948')).toBe(false);
  });

  it('sollte leere und offensichtlich fremde Eingaben abweisen', () => {
    expect(isValidIban('')).toBe(false);
    expect(isValidIban('Sparkasse Musterstadt')).toBe(false);
    expect(isValidIban('1234567890')).toBe(false);
  });
});
