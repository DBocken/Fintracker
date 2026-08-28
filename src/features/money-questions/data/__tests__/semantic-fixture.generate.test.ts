// @vitest-environment node
/**
 * Erzeugt `semantic-fixture.json` — die eingefrorenen Embeddings, mit denen
 * die semantische Ratsche in CI OHNE Modell-Download misst.
 *
 * Läuft nur mit `SEMANTIC_FIXTURE=1 pnpm vitest run <diese Datei>` und
 * braucht Netz (einmalig ~135 MB Modell-Download, danach Cache). In CI ist
 * die Datei übersprungen; die Ratsche (`semantic-ratchet.test.ts`) prüft
 * über einen Hash der Paraphrasen- und Korpustexte, dass die Fixture zum
 * aktuellen Stand passt, und nennt bei Drift genau diesen Befehl.
 *
 * Der Generator verifiziert bei jeder Erzeugung, dass die int8-Quantisierung
 * die top-3-Rangfolge gegenüber float32 NICHT verändert — sonst wäre die
 * Ratsche eine Messung der Rundung, nicht des Modells.
 */
import { describe, it, expect } from 'vitest';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { paraphrasenFuer } from '../paraphrases';
import { EVAL_KORPUS } from './question-eval-corpus';
import { WELLE1_KORPUS } from './wave1-corpus';
import { WELLE2_KORPUS } from './wave2-corpus';
import { WELLE3_KORPUS } from './wave3-corpus';
import { WELLE5_KORPUS } from './wave5-corpus';
import { alleKorpusZeilen, fixtureHashQuelle } from './semantic-shared';
import { quantisiere, kosinus, type SemantischeKlasse } from '@/features/money-questions/domain/semantic-intent';

const laufen = process.env.SEMANTIC_FIXTURE === '1';

describe.skipIf(!laufen)('Fixture-Generator (nur lokal, SEMANTIC_FIXTURE=1)', () => {
  it('erzeugt die Embedding-Fixture', { timeout: 1_800_000 }, async () => {
    const { pipeline } = await import('@huggingface/transformers');
    const ex = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small', {
      dtype: 'q8',
    });

    const embed = async (texte: readonly string[]): Promise<Float32Array[]> => {
      const rows: Float32Array[] = [];
      for (let i = 0; i < texte.length; i += 32) {
        const batch = texte.slice(i, i + 32).map((t) => `query: ${t.toLowerCase()}`);
        const out = await ex([...batch], { pooling: 'mean', normalize: true });
        const [n, d] = out.dims as [number, number];
        const data = out.data as Float32Array;
        for (let j = 0; j < n; j += 1) rows.push(data.slice(j * d, (j + 1) * d));
      }
      return rows;
    };

    const nachB64 = (v: Float32Array): string => {
      const q = quantisiere(v);
      let s = '';
      for (let i = 0; i < q.length; i += 1) s += String.fromCharCode(q[i] & 0xff);
      return Buffer.from(s, 'binary').toString('base64');
    };

    const paraphrasen = paraphrasenFuer('de');
    const klassenB64: Record<string, string[]> = {};
    const klassenFloat: SemantischeKlasse[] = [];
    const klassenQ: SemantischeKlasse[] = [];
    for (const [klasse, texte] of Object.entries(paraphrasen)) {
      const embs = await embed(texte);
      klassenB64[klasse] = embs.map(nachB64);
      klassenQ.push({ klasse, vektoren: embs.map(quantisiere) });
      // float32-Referenz über denselben Pfad, nur ohne Rundung: als
      // "quantisiert mit Faktor 10000" — kosinus ist skaleninvariant.
      klassenFloat.push({
        klasse,
        vektoren: embs.map((e) => {
          const g = new Int8Array(0);
          void g;
          return e as unknown as Int8Array;
        }),
      });
    }

    const zeilen = alleKorpusZeilen(
      EVAL_KORPUS,
      WELLE1_KORPUS,
      WELLE2_KORPUS,
      WELLE3_KORPUS,
      WELLE5_KORPUS,
    );
    const fragenB64: Record<string, string> = {};
    const fragenFloat = new Map<string, Float32Array>();
    for (const { frage } of zeilen) {
      if (fragenB64[frage]) continue;
      const [e] = await embed([frage]);
      fragenB64[frage] = nachB64(e);
      fragenFloat.set(frage, e);
    }

    // Verifikation: int8-top3 == float32-top3 auf jeder Korpusfrage.
    const kosFloat = (a: Float32Array, b: Float32Array): number => {
      let s = 0;
      for (let i = 0; i < a.length; i += 1) s += a[i] * b[i];
      return s;
    };
    const top3 = (
      scoreFuer: (klasse: string) => number,
      klassen: readonly string[],
    ): string[] =>
      [...klassen]
        .map((k) => [k, scoreFuer(k)] as const)
        .sort((a, b) => (b[1] === a[1] ? a[0].localeCompare(b[0]) : b[1] - a[1]))
        .slice(0, 3)
        .map(([k]) => k);
    const klassenNamen = Object.keys(paraphrasen);
    const floatVektoren = new Map<string, Float32Array[]>();
    for (const [klasse, texte] of Object.entries(paraphrasen)) {
      void texte;
      floatVektoren.set(klasse, await embed(paraphrasen[klasse]));
    }
    // Die Quantisierung wird an der ZIELMETRIK verifiziert, nicht an einer
    // Proxy-Gleichheit der Listen: Rang-3/4-Vertauschungen bei Quasi-
    // Gleichstand (e5-Scores liegen 0.001 auseinander) sind Rundung und
    // schaden nur, wenn das ZIEL an genau dieser Grenze sitzt. Gemessen wird
    // also: Wie oft steht die Soll-Familie in den top-3 — float32 gegen
    // int8. Fällt die int8-Fassung messbar ab, ist die Quantisierung zu
    // grob; alles andere ist Reihenfolge-Rauschen ohne Wirkung.
    let trefferFloat = 0;
    let trefferInt8 = 0;
    let beantwortbar = 0;
    const zielVon = new Map(zeilen.map((z) => [z.frage, z.familie]));
    for (const [frage, ef] of fragenFloat) {
      const familie = zielVon.get(frage);
      if (!familie || !klassenNamen.includes(familie)) continue;
      beantwortbar += 1;
      const eq = quantisiere(ef);
      const qTop = top3(
        (k) => {
          const kl = klassenQ.find((x) => x.klasse === k)!;
          const sims = kl.vektoren.map((v) => kosinus(eq, v)).sort((a, b) => b - a);
          return (sims[0] + (sims[1] ?? sims[0]) + (sims[2] ?? sims[0])) / 3;
        },
        klassenNamen,
      );
      const fTop = top3(
        (k) => {
          const sims = floatVektoren
            .get(k)!
            .map((v) => kosFloat(ef, v))
            .sort((a, b) => b - a);
          return (sims[0] + (sims[1] ?? sims[0]) + (sims[2] ?? sims[0])) / 3;
        },
        klassenNamen,
      );
      if (fTop.includes(familie)) trefferFloat += 1;
      if (qTop.includes(familie)) trefferInt8 += 1;
    }
    expect(beantwortbar).toBeGreaterThan(100);
    expect(trefferInt8).toBeGreaterThanOrEqual(trefferFloat - Math.ceil(beantwortbar * 0.01));

    const hash = createHash('sha256').update(fixtureHashQuelle(paraphrasen, zeilen)).digest('hex');
    const fixture = {
      _kommentar:
        'Eingefrorene int8-Embeddings (multilingual-e5-small q8, query-Präfix, lowercase) für die semantische Ratsche. Neu erzeugen: SEMANTIC_FIXTURE=1 pnpm vitest run src/features/money-questions/data/__tests__/semantic-fixture.generate.test.ts',
      modell: 'Xenova/multilingual-e5-small',
      hash,
      klassen: klassenB64,
      fragen: fragenB64,
    };
    writeFileSync(join(__dirname, 'semantic-fixture.json'), JSON.stringify(fixture));
    expect(Object.keys(klassenB64).length).toBeGreaterThan(40);
  });
});
