/**
 * Service-Tests der Stufe 3 — das Modell ist gemockt (kein Download in
 * Tests); geprüft werden Opt-in, Cache-Verhalten und der Vertrag mit der
 * reinen Logik (Präfix, Kleinschreibung, Quantisierung).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const embedAufrufe: string[][] = [];
vi.mock('@huggingface/transformers', () => ({
  // `env` trägt den Cache-Schlüssel — der Service setzt ihn ausdrücklich,
  // damit Status und Löschen denselben Namen benutzen wie die Bibliothek.
  env: { cacheKey: '' },
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
  modellStatus,
  modellLoeschen,
  SEMANTIK_CACHE_KEY,
  SEMANTIK_MODELL_ID,
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


/**
 * Cache-Storage-Doppel: jsdom kennt `caches` nicht. Nachgebildet wird nur,
 * was der Status und das Löschen benutzen — Schlüssel, Köpfe, Löschen.
 */
class CacheDoppel {
  eintraege = new Map<string, Response>();
  async keys() {
    return [...this.eintraege.keys()].map((url) => new Request(url));
  }
  async match(anfrage: Request | string) {
    return this.eintraege.get(typeof anfrage === 'string' ? anfrage : anfrage.url);
  }
  async delete(anfrage: Request | string) {
    return this.eintraege.delete(typeof anfrage === 'string' ? anfrage : anfrage.url);
  }
}

function installiereCache(dateien: { url: string; bytes: number | null }[]) {
  const doppel = new CacheDoppel();
  for (const d of dateien) {
    doppel.eintraege.set(
      d.url,
      new Response('', { headers: d.bytes === null ? {} : { 'content-length': String(d.bytes) } }),
    );
  }
  const speicher = new Map<string, CacheDoppel>([[SEMANTIK_CACHE_KEY, doppel]]);
  Object.defineProperty(globalThis, 'caches', {
    configurable: true,
    value: {
      has: async (k: string) => speicher.has(k),
      open: async (k: string) => {
        if (!speicher.has(k)) speicher.set(k, new CacheDoppel());
        return speicher.get(k)!;
      },
      delete: async (k: string) => speicher.delete(k),
    },
  });
  return { doppel, speicher };
}

const URL_MODELL = `https://huggingface.co/${SEMANTIK_MODELL_ID}/resolve/main/onnx/model_quantized.onnx`;
const URL_TOKENIZER = `https://huggingface.co/${SEMANTIK_MODELL_ID}/resolve/main/tokenizer.json`;

describe('Modell-Status und Löschen', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis as Record<string, unknown>, 'caches');
  });

  it('sollte OHNE Cache „nicht installiert" melden statt zu raten', async () => {
    installiereCache([]);
    const status = await modellStatus();
    expect(status.installiert).toBe(false);
    expect(status.dateien).toBe(0);
  });

  it('sollte den Installationsstand aus dem CACHE lesen, nicht aus einem Merker', async () => {
    // Das Flag behauptet „an" — der Cache ist trotzdem leer. Ein Merker
    // würde hier „installiert" sagen; der Browser räumt aber unter
    // Speicherdruck, ohne zu fragen.
    setzeSemantikAktiv(true);
    installiereCache([]);
    expect((await modellStatus()).installiert).toBe(false);
  });

  it('sollte Dateien zählen und die Grösse aus content-length summieren', async () => {
    installiereCache([
      { url: URL_MODELL, bytes: 118_000_000 },
      { url: URL_TOKENIZER, bytes: 17_000_000 },
    ]);
    const status = await modellStatus();
    expect(status.installiert).toBe(true);
    expect(status.dateien).toBe(2);
    expect(status.bytes).toBe(135_000_000);
    expect(status.unvollstaendig).toBe(false);
  });

  it('sollte eine fehlende Längenangabe als UNVOLLSTÄNDIG ausweisen, statt sie zu verschweigen', async () => {
    installiereCache([
      { url: URL_MODELL, bytes: 118_000_000 },
      { url: URL_TOKENIZER, bytes: null },
    ]);
    const status = await modellStatus();
    expect(status.bytes).toBe(118_000_000);
    expect(status.unvollstaendig).toBe(true);
  });

  it('sollte fremde Einträge im selben Cache NICHT mitzählen', async () => {
    installiereCache([
      { url: URL_MODELL, bytes: 118_000_000 },
      { url: 'https://huggingface.co/Xenova/ein-anderes-modell/resolve/main/model.onnx', bytes: 999 },
    ]);
    expect((await modellStatus()).dateien).toBe(1);
  });

  it('sollte beim Löschen die Modelldateien entfernen und die Stufe AUSSCHALTEN', async () => {
    const { doppel } = installiereCache([
      { url: URL_MODELL, bytes: 118_000_000 },
      { url: URL_TOKENIZER, bytes: 17_000_000 },
    ]);
    setzeSemantikAktiv(true);

    await modellLoeschen();

    expect(doppel.eintraege.size).toBe(0);
    // Bliebe das Opt-in an, lüde die nächste Frage 135 MB still erneut.
    expect(istSemantikAktiv()).toBe(false);
    expect((await modellStatus()).installiert).toBe(false);
  });

  it('sollte beim Löschen fremde Einträge im selben Cache in Ruhe lassen', async () => {
    const fremd = 'https://huggingface.co/Xenova/ein-anderes-modell/resolve/main/model.onnx';
    const { doppel } = installiereCache([
      { url: URL_MODELL, bytes: 1 },
      { url: fremd, bytes: 1 },
    ]);
    await modellLoeschen();
    expect([...doppel.eintraege.keys()]).toEqual([fremd]);
  });

  it('sollte ohne Cache-Zugriff nicht werfen — die Fläche darf daran nicht scheitern', async () => {
    Reflect.deleteProperty(globalThis as Record<string, unknown>, 'caches');
    await expect(modellStatus()).resolves.toMatchObject({ installiert: false });
    await expect(modellLoeschen()).resolves.toBeUndefined();
  });
});
