import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { translations, SUPPORTED_LOCALES, DEFAULT_LOCALE } from '../translations';

/**
 * Vollständige Key-Parität über ALLE auswählbaren Locales.
 *
 * Ersetzt die Klammer-Ebenen-Heuristik aus `scripts/check-i18n.mjs`, die nie
 * auslösen konnte: ihr Regex stoppte am ersten `},` und verglich damit für jede
 * Sprache dieselben ~24 Zeilen des `onboarding`-Namespace. Zusätzlich war jene
 * Prüfung diff-basiert und sah Altbestand grundsätzlich nicht.
 *
 * Ein fehlender Key ist hier kein Schönheitsfehler: `t('backup.collections')`
 * ohne Fallback rendert bei fehlendem Eintrag den rohen Schlüssel auf den
 * Bildschirm.
 */

function resolve(locale: string, key: string): unknown {
  let node: unknown = (translations as Record<string, unknown>)[locale];
  for (const part of key.split('.')) {
    if (node === undefined || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

/** Alle Blatt-Keys (Pfad-Notation) eines Teilbaums. */
function leafKeys(node: unknown, prefix = ''): string[] {
  if (typeof node === 'string') return [prefix];
  if (node === null || typeof node !== 'object') return [];
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
    leafKeys(v, prefix ? `${prefix}.${k}` : k),
  );
}

describe('Locale-Parität (de = Referenz)', () => {
  const reference = leafKeys(translations[DEFAULT_LOCALE]);

  it('sollte einen nicht-trivialen Referenzbaum haben', () => {
    // Schützt davor, dass ein kaputter Walk die Prüfung stillschweigend leert.
    expect(reference.length).toBeGreaterThan(3000);
  });

  it('sollte jeden deutschen Key in allen auswählbaren Locales als String haben', () => {
    const missing: string[] = [];
    for (const locale of SUPPORTED_LOCALES) {
      for (const key of reference) {
        if (typeof resolve(locale, key) !== 'string') missing.push(`${key} @ ${locale}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('[REGRESSION] sollte Keys ohne t()-Fallback in allen Locales haben', () => {
    // Diese sechs Keys fehlten in `ru`. Da die Aufrufstellen KEINEN Fallback
    // übergeben, rendert `t()` bei fehlendem Eintrag den rohen Schlüssel —
    // russische Nutzer sahen wörtlich "backup.collections" auf dem Bildschirm
    // (BackupManager.tsx, BankCallbackPage.tsx).
    const keys = [
      'backup.collections',
      'backup.selectedFile',
      'backup.restoreSummary',
      'backup.restoreMergeNote',
      'bankCallback.unsafeAuthLink',
      'bankCallback.authLinkLabel',
    ];
    for (const key of keys) {
      for (const locale of SUPPORTED_LOCALES) {
        expect(typeof resolve(locale, key), `${key} @ ${locale}`).toBe('string');
      }
    }
  });

  it('[REGRESSION] sollte den Namespace replacementPlanService kennen', () => {
    // Der Namespace fehlte komplett; `t('replacementPlanService.notFound', 'Ersatzplan
    // nicht gefunden')` lieferte deshalb in JEDER Sprache den deutschen Fallback.
    for (const locale of SUPPORTED_LOCALES) {
      expect(typeof resolve(locale, 'replacementPlanService.notFound')).toBe('string');
    }
  });

  it('sollte keine Keys enthalten, die Deutsch nicht kennt', () => {
    const known = new Set(reference);
    const extra: string[] = [];
    for (const locale of SUPPORTED_LOCALES) {
      for (const key of leafKeys(translations[locale])) {
        if (!known.has(key)) extra.push(`${key} @ ${locale}`);
      }
    }
    expect(extra).toEqual([]);
  });
});

describe('Doppelte Namespaces', () => {
  /**
   * Ein zweimal vergebener Schlüssel im Objektliteral ist gültiges JavaScript:
   * der spätere gewinnt, der frühere verschwindet lautlos. Dieser Test liest
   * deshalb die QUELLE, nicht das ausgewertete Objekt — im Objekt ist der
   * Fehler per Definition nicht mehr sichtbar.
   *
   * Das ist genau einmal passiert: ein neuer `categories`-Block kollidierte mit
   * dem bestehenden Namespace des Kategorie-Auswählers und war in allen
   * Sprachen wirkungslos. Die Paritätsprüfung sah nichts, weil beide Seiten
   * denselben überlebenden Block verglichen.
   */
  it('[REGRESSION] sollte je Locale keinen Namespace doppelt definieren', () => {
    // Pfad ueber cwd statt import.meta.url: unter vitest/jsdom ist letzteres
    // keine file:-URL.
    const source = readFileSync(`${process.cwd()}/src/i18n/translations.ts`, 'utf8');
    const lines = source.split('\n');

    const localeStarts: Array<{ locale: string; line: number }> = [];
    lines.forEach((line, index) => {
      const match = line.match(/^ {2}(de|en|tlh|ru): \{$/);
      if (match) localeStarts.push({ locale: match[1], line: index });
    });
    expect(localeStarts.length).toBe(4);

    const duplicates: string[] = [];
    localeStarts.forEach(({ locale, line }, i) => {
      const end = i + 1 < localeStarts.length ? localeStarts[i + 1].line : lines.length;
      const seen = new Set<string>();
      for (let n = line + 1; n < end; n++) {
        const match = lines[n].match(/^ {4}(\w+): [{'"[]/);
        if (!match) continue;
        if (seen.has(match[1])) duplicates.push(`${locale}.${match[1]} (Zeile ${n + 1})`);
        seen.add(match[1]);
      }
    });

    expect(duplicates).toEqual([]);
  });
});
