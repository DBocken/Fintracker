/**
 * Service-Tests der Stufe 3 — das Modell ist gemockt (kein Download in
 * Tests); geprüft werden Opt-in, Cache-Verhalten und der Vertrag mit der
 * reinen Logik (Präfix, Kleinschreibung, Quantisierung).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const embedAufrufe: string[][] = [];
vi.mock('@huggingface/transformers', () => ({
  pipeline: vi.fn(async () => {
    return async (texte: string[]) => {
      embedAufrufe.push(texte);
      const d = 4;
      const data = new Float32Array(texte.length * d);
      texte.forEach((t, i) => {
        // Deterministisch aus dem Text, L2-normiert.
        const roh = [t.length % 7, (t.charCodeAt(0) ?? 1) % 5, 1, (t.length % 3) + 1];
        const n = Math.sqrt(roh.reduce((s, x) => s + x * x, 0));
        roh.forEach((x, j) => {
          data[i * d + j] = x / n;
        });
      });
      return { dims: [texte.length, d], data };
    };
  }),
}));

import {
  istSemantikAktiv,
  setzeSemantikAktiv,
  semantikVorschlaegeFuer,
  _resetSemantikCache,
} from '../semantic-intent-service';
import { clearLocalKvStore } from '../idb-kv';

const PARAPHRASEN = {
  'konto.gesamt': ['wie viel geld habe ich', 'gesamtsaldo aller konten'],
  'ausgaben.gesamt': ['was habe ich ausgegeben', 'summe meiner ausgaben'],
} as const;

beforeEach(async () => {
  _resetSemantikCache();
  embedAufrufe.length = 0;
  localStorage.clear();
  await clearLocalKvStore();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('semantic-intent-service', () => {
  it('sollte das Opt-in als Geräte-Flag führen', () => {
    expect(istSemantikAktiv()).toBe(false);
    setzeSemantikAktiv(true);
    expect(istSemantikAktiv()).toBe(true);
    setzeSemantikAktiv(false);
    expect(istSemantikAktiv()).toBe(false);
  });

  it('sollte die Frage mit query-Präfix und Kleinschreibung einbetten — exakt wie die Fixture', async () => {
    await semantikVorschlaegeFuer('Wie VIEL Geld habe ich', PARAPHRASEN);
    const frageBatch = embedAufrufe[embedAufrufe.length - 1];
    expect(frageBatch).toEqual(['query: wie viel geld habe ich']);
  });

  it('sollte die Paraphrasen-Matrix nur EINMAL rechnen und danach aus IndexedDB lesen', async () => {
    await semantikVorschlaegeFuer('erste frage', PARAPHRASEN);
    const aufrufeNachErster = embedAufrufe.length;
    await semantikVorschlaegeFuer('zweite frage', PARAPHRASEN);
    // Zweiter Aufruf: nur die Frage selbst, keine Paraphrasen mehr.
    expect(embedAufrufe.length).toBe(aufrufeNachErster + 1);

    // Und nach einem Modul-Reset (neuer Seitenaufruf) kommt die Matrix aus
    // IndexedDB — wieder nur ein Embed-Aufruf für die Frage.
    _resetSemantikCache();
    const vorher = embedAufrufe.length;
    await semantikVorschlaegeFuer('dritte frage', PARAPHRASEN);
    expect(embedAufrufe.length).toBe(vorher + 1);
  });

  it('sollte bei geänderten Paraphrasen die Matrix neu rechnen', async () => {
    await semantikVorschlaegeFuer('frage', PARAPHRASEN);
    _resetSemantikCache();
    const vorher = embedAufrufe.length;
    await semantikVorschlaegeFuer('frage', {
      ...PARAPHRASEN,
      'konto.gesamt': ['wie viel geld habe ich', 'NEUE paraphrase'],
    });
    // Mehr als nur die Frage: die Klassen wurden neu eingebettet.
    expect(embedAufrufe.length).toBeGreaterThan(vorher + 1);
  });

  it('sollte Vorschläge in der Form der reinen Logik liefern', async () => {
    const v = await semantikVorschlaegeFuer('wie viel geld habe ich', PARAPHRASEN);
    for (const x of v) {
      expect(typeof x.klasse).toBe('string');
      expect(x.score).toBeGreaterThanOrEqual(0);
      expect(x.score).toBeLessThanOrEqual(1.0001);
    }
  });
});
