import { describe, it, expect } from 'vitest';
import { translations, SUPPORTED_LOCALES } from '../translations';
import { SUPPORTED_WORDINGS } from '../wording';
import { overlayFor } from '../overlays';

/**
 * [SECURITY]-naher Wächter für die RDG-Grenze im Schulden-Modul.
 *
 * `docs/RDG_TEXTREGELN.md`: Das Rechtsdienstleistungsgesetz verbietet
 * individuelle Rechtsberatung ohne Zulassung. Die App informiert, strukturiert,
 * rechnet und motiviert — sie berät nicht rechtlich.
 *
 * Der Test läuft über den Basisbaum UND über jeden Overlay-Wert. Die
 * Alltagssprache ist hier das gefährlichere Register: aus „Forderungen können
 * nach 3 Jahren verjähren" wird beim Vereinfachen schnell „Nach 3 Jahren ist
 * die Schuld weg" — genau die verbotene Einzelfallaussage.
 *
 * Die Phrasenliste ist bewusst deutsch: RDG ist deutsches Recht und der
 * deutsche Text ist die exponierte Fläche. Die strukturelle Brückenprüfung
 * läuft dagegen über alle Locales.
 */

const DEBT_NAMESPACES = ['debts', 'debtService', 'debtDetectionService'] as const;

/** Individuelle Handlungsempfehlung mit Rechtscharakter — immer verboten. */
const FORBIDDEN: Array<[RegExp, string]> = [
  [/musst du nicht zahlen|nicht zahlen musst/i, 'Zahlungspflicht im Einzelfall verneint'],
  [/\bwiderspri(ch|ng)/i, 'Aufforderung zum Widerspruch'],
  [/\bist verjährt|sind verjährt/i, 'Verjährung im Einzelfall festgestellt'],
  [/(ist|sind) unzulässig/i, 'Rechtmäßigkeit im Einzelfall bewertet'],
  [/für deinen Fall|in deinem Fall/i, 'Prüfung „für deinen Fall" versprochen'],
];

function leafEntries(node: unknown, prefix = ''): Array<[string, string]> {
  if (typeof node === 'string') return [[prefix, node]];
  if (node === null || typeof node !== 'object') return [];
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
    leafEntries(v, prefix ? `${prefix}.${k}` : k),
  );
}

/** Alle Schulden-Strings aus Basis und Overlays, mit Herkunftsangabe. */
function debtStrings(): Array<{ where: string; key: string; value: string; locale: string }> {
  const out: Array<{ where: string; key: string; value: string; locale: string }> = [];
  for (const locale of SUPPORTED_LOCALES) {
    const tree = (translations as Record<string, Record<string, unknown>>)[locale];
    for (const ns of DEBT_NAMESPACES) {
      for (const [key, value] of leafEntries(tree?.[ns], ns)) {
        out.push({ where: `Basis/${locale}`, key, value, locale });
      }
    }
    for (const wording of SUPPORTED_WORDINGS) {
      const overlay = overlayFor(wording, locale) as Record<string, unknown> | undefined;
      if (!overlay) continue;
      for (const ns of DEBT_NAMESPACES) {
        for (const [key, value] of leafEntries(overlay[ns], ns)) {
          out.push({ where: `${wording}/${locale}`, key, value, locale });
        }
      }
    }
  }
  return out;
}

describe('[SECURITY] RDG-Grenze in Schulden-Texten', () => {
  it('sollte einen nicht-leeren Prüfkorpus haben', () => {
    // Sonst wäre ein grüner Lauf bedeutungslos.
    expect(debtStrings().length).toBeGreaterThan(50);
  });

  it('sollte keine individuelle Rechtsberatung enthalten', () => {
    const violations: string[] = [];
    for (const { where, key, value, locale } of debtStrings()) {
      if (locale !== 'de') continue; // Phrasenliste ist deutschsprachig
      for (const [pattern, reason] of FORBIDDEN) {
        if (pattern.test(value)) violations.push(`${where} ${key}: ${reason} — "${value}"`);
      }
    }
    expect(violations).toEqual([]);
  });
});
